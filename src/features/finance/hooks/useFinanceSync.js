/**
 * useFinanceSync.js — إدارة localStorage + المزامنة مع Neon DB للبيانات المالية
 *
 * يتبع نفس نمط useSync.js:
 *  ① Race Condition Fix: مقارنة timestamps
 *  ② Debounced Sync: مزامنة بعد 1.5 ثانية
 *  ③ beforeunload Flush: sendBeacon عند الإغلاق
 *  ④ Online Retry: إعادة المحاولة عند عودة الاتصال
 */

import { useState, useEffect, useRef, useCallback } from "react";

// ── LocalStorage keys ───────────────────────────────────────────────────────
const KEYS = {
  income:      "mhm_fin_income",
  obligations: "mhm_fin_obligations",
  payments:    "mhm_fin_payments",
  goals:       "mhm_fin_goals",
  localTs:     "mhm_fin_local_ts",
};

function lsGet(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v !== null ? JSON.parse(v) : fallback;
  } catch { return fallback; }
}

function lsSet(key, value, onQuota) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    if (e.name === "QuotaExceededError" || e.name === "NS_ERROR_DOM_QUOTA_REACHED") {
      onQuota?.();
    }
    return false;
  }
}

// ── Hook ────────────────────────────────────────────────────────────────────
export default function useFinanceSync(onQuota) {
  const [income,      setIncomeState]      = useState(() => lsGet(KEYS.income, []));
  const [obligations, setObligationsState] = useState(() => lsGet(KEYS.obligations, []));
  const [payments,    setPaymentsState]    = useState(() => lsGet(KEYS.payments, []));
  const [goals,       setGoalsState]       = useState(() => lsGet(KEYS.goals, []));
  const [syncStatus,  setSyncStatus]       = useState("offline");

  const dbAvailable = useRef(false);
  const syncTimer   = useRef(null);
  const isMounted   = useRef(false);
  const pendingData = useRef(null);

  // ── Setters (حفظ محلي + تحديث timestamp) ──────────────────────────────
  const setIncome = useCallback((v) => {
    setIncomeState(prev => {
      const next = typeof v === "function" ? v(prev) : v;
      lsSet(KEYS.income, next, onQuota);
      lsSet(KEYS.localTs, new Date().toISOString(), onQuota);
      return next;
    });
  }, [onQuota]);

  const setObligations = useCallback((v) => {
    setObligationsState(prev => {
      const next = typeof v === "function" ? v(prev) : v;
      lsSet(KEYS.obligations, next, onQuota);
      lsSet(KEYS.localTs, new Date().toISOString(), onQuota);
      return next;
    });
  }, [onQuota]);

  const setPayments = useCallback((v) => {
    setPaymentsState(prev => {
      const next = typeof v === "function" ? v(prev) : v;
      lsSet(KEYS.payments, next, onQuota);
      lsSet(KEYS.localTs, new Date().toISOString(), onQuota);
      return next;
    });
  }, [onQuota]);

  const setGoals = useCallback((v) => {
    setGoalsState(prev => {
      const next = typeof v === "function" ? v(prev) : v;
      lsSet(KEYS.goals, next, onQuota);
      lsSet(KEYS.localTs, new Date().toISOString(), onQuota);
      return next;
    });
  }, [onQuota]);

  // ── دالة المزامنة الفعلية ──────────────────────────────────────────────
  const doSync = useCallback(async (inc, obl, pay, gls) => {
    try {
      const results = await Promise.all([
        fetch("/api/db?resource=income",      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ income: inc }) }),
        fetch("/api/db?resource=obligations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ obligations: obl }) }),
        fetch("/api/db?resource=payments",    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ payments: pay }) }),
        fetch("/api/db?resource=goals",       { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ goals: gls }) }),
      ]);
      if (results.some(r => !r.ok)) throw new Error("API error");
      setSyncStatus("synced");
      pendingData.current = null;
    } catch {
      setSyncStatus("error");
      pendingData.current = { income: inc, obligations: obl, payments: pay, goals: gls };
    }
  }, []);

  // ── Debounced Sync ──────────────────────────────────────────────────────
  const scheduleSync = useCallback((inc, obl, pay, gls) => {
    if (!dbAvailable.current) return;
    clearTimeout(syncTimer.current);
    setSyncStatus("syncing");
    pendingData.current = { income: inc, obligations: obl, payments: pay, goals: gls };
    syncTimer.current = setTimeout(() => doSync(inc, obl, pay, gls), 1500);
  }, [doSync]);

  // ── تشغيل Sync عند تغيير البيانات ───────────────────────────────────
  useEffect(() => {
    if (!isMounted.current) { isMounted.current = true; return; }
    scheduleSync(income, obligations, payments, goals);
  }, [income, obligations, payments, goals, scheduleSync]);

  // ── جلب البيانات من DB عند التحميل (مع مقارنة timestamps) ─────────────
  useEffect(() => {
    const load = async () => {
      try {
        const [incR, oblR, payR, glsR] = await Promise.all([
          fetch("/api/db?resource=income"),
          fetch("/api/db?resource=obligations"),
          fetch("/api/db?resource=payments"),
          fetch("/api/db?resource=goals"),
        ]);
        if (!incR.ok || !oblR.ok || !payR.ok || !glsR.ok) return;

        const [incD, oblD, payD, glsD] = await Promise.all([incR.json(), oblR.json(), payR.json(), glsR.json()]);
        dbAvailable.current = true;

        const localTs  = lsGet(KEYS.localTs, null);
        const localTime = localTs ? new Date(localTs).getTime() : 0;

        // لكل resource: إذا DB أحدث → استخدمها
        const dbTimes = [incD, oblD, payD, glsD].map(d => d.updatedAt ? new Date(d.updatedAt).getTime() : 0);
        const dbNewest = Math.max(...dbTimes);

        if (dbNewest > localTime) {
          if (incD.income?.length)       { setIncomeState(incD.income);           lsSet(KEYS.income, incD.income, onQuota); }
          if (oblD.obligations?.length)  { setObligationsState(oblD.obligations); lsSet(KEYS.obligations, oblD.obligations, onQuota); }
          if (payD.payments?.length)     { setPaymentsState(payD.payments);       lsSet(KEYS.payments, payD.payments, onQuota); }
          if (glsD.goals?.length)        { setGoalsState(glsD.goals);             lsSet(KEYS.goals, glsD.goals, onQuota); }
        }
        setSyncStatus("synced");
      } catch {
        setSyncStatus("offline");
      }
    };
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Online Retry ────────────────────────────────────────────────────────
  useEffect(() => {
    const handle = () => {
      if (!pendingData.current || !dbAvailable.current) return;
      const { income: i, obligations: o, payments: p, goals: g } = pendingData.current;
      setSyncStatus("syncing");
      doSync(i, o, p, g);
    };
    window.addEventListener("online", handle);
    return () => window.removeEventListener("online", handle);
  }, [doSync]);

  // ── beforeunload Flush ──────────────────────────────────────────────────
  useEffect(() => {
    const handle = () => {
      if (!pendingData.current || !dbAvailable.current) return;
      const { income: i, obligations: o, payments: p, goals: g } = pendingData.current;
      try {
        const blob = (d) => new Blob([JSON.stringify(d)], { type: "application/json" });
        navigator.sendBeacon("/api/db?resource=income",      blob({ income: i }));
        navigator.sendBeacon("/api/db?resource=obligations", blob({ obligations: o }));
        navigator.sendBeacon("/api/db?resource=payments",    blob({ payments: p }));
        navigator.sendBeacon("/api/db?resource=goals",       blob({ goals: g }));
      } catch (e) { console.warn("[useFinanceSync] sendBeacon failed:", e); }
    };
    window.addEventListener("beforeunload", handle);
    return () => window.removeEventListener("beforeunload", handle);
  }, []);

  // ── Cleanup ─────────────────────────────────────────────────────────────
  useEffect(() => () => { if (syncTimer.current) clearTimeout(syncTimer.current); }, []);

  return {
    income, setIncome,
    obligations, setObligations,
    payments, setPayments,
    goals, setGoals,
    syncStatus,
  };
}
