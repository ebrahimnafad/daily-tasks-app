/**
 * useSync.js — إدارة localStorage + المزامنة مع Neon DB
 *
 * يُصلح المشاكل الحرجة التالية:
 *  ① Race Condition / Overwrite Bug: مقارنة الـ timestamps قبل الكتابة فوق البيانات
 *  ② Midnight Bug: كشف تغيّر التاريخ وتصفير المهام تلقائياً
 *  ③ beforeunload Flush: استخدام sendBeacon لحفظ البيانات عند إغلاق المتصفح
 *  ④ Online Retry: إعادة المحاولة تلقائياً عند عودة الاتصال
 *  ⑤ QuotaExceededError: إشعار المستخدم عند امتلاء ذاكرة المتصفح
 */

import { useState, useEffect, useRef, useCallback } from "react";

// ── LocalStorage helpers ────────────────────────────────────────────────────
// المفاتيح المستخدمة
const KEYS = {
  tasks:      "mhm_tasks",
  checked:    "mhm_checked",
  subChecked: "mhm_sub_checked",
  date:       "mhm_date",
  shift:      "mhm_shift",
  localTs:    "mhm_local_ts",   // وقت آخر تعديل محلي (ISO string)
};

function lsGet(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v !== null ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}

/**
 * حفظ قيمة في localStorage مع معالجة حالة امتلاء الذاكرة.
 * تعيد `true` عند النجاح و `false` عند الفشل.
 * @param {Function} [onQuotaError] - callback يُستدعى عند QuotaExceededError
 */
function lsSet(key, value, onQuotaError) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    if (e.name === "QuotaExceededError" || e.name === "NS_ERROR_DOM_QUOTA_REACHED") {
      console.error("[useSync] localStorage امتلأ:", e);
      onQuotaError?.();
    } else {
      console.error("[useSync] localStorage خطأ:", e);
    }
    return false;
  }
}

export const todayISO = () => new Date().toISOString().split("T")[0];

// ── الـ Hook ────────────────────────────────────────────────────────────────
/**
 * @param {Array}    initialTasks  - المهام الافتراضية تُستخدم فقط إذا لم يوجد شيء في localStorage
 * @param {Function} [onNewDay]    - callback يُستدعى عند اكتشاف يوم جديد (لعرض Toast مثلاً)
 * @param {Function} [onQuota]     - callback يُستدعى عند امتلاء localStorage
 */
export default function useSync(initialTasks, onNewDay, onQuota) {
  // ── التهيئة الكسولة من localStorage ────────────────────────────────────
  const [tasks, setTasksState] = useState(() => lsGet(KEYS.tasks, initialTasks));

  const [checked, setCheckedState] = useState(() => {
    const savedDate = lsGet(KEYS.date, null);
    return savedDate === todayISO() ? lsGet(KEYS.checked, {}) : {};
  });

  const [subChecked, setSubCheckedState] = useState(() => {
    const savedDate = lsGet(KEYS.date, null);
    return savedDate === todayISO() ? lsGet(KEYS.subChecked, {}) : {};
  });

  const [shift, setShiftState] = useState(() => lsGet(KEYS.shift, "morning"));
  const [syncStatus, setSyncStatus] = useState("offline");

  // ── Refs ────────────────────────────────────────────────────────────────
  const dbAvailable    = useRef(false);
  const syncTimer      = useRef(null);
  const isMounted      = useRef(false);   // منع التشغيل عند أول render
  // يحتفظ بأحدث نسخة من البيانات للاستخدام في beforeunload و online retry
  const pendingData    = useRef(null);

  // ── Wrappers تحفظ في localStorage وتُحدّث الـ timestamp ─────────────────
  const persistAndSet = useCallback((stateSetter, lsKey, value) => {
    const resolved = typeof value === "function"
      ? value(/* سنحتاج القيمة الحالية — انظر setTasks/setChecked أدناه */)
      : value;
    // الحفظ في localStorage مع تسجيل وقت التعديل
    lsSet(lsKey, resolved, onQuota);
    lsSet(KEYS.localTs, new Date().toISOString(), onQuota);
    stateSetter(value); // استخدم الـ value الأصلية (قد تكون function updater)
  }, [onQuota]);

  // واجهات عامة للتعديل
  const setTasks = useCallback((v) => {
    setTasksState(prev => {
      const next = typeof v === "function" ? v(prev) : v;
      lsSet(KEYS.tasks, next, onQuota);
      lsSet(KEYS.localTs, new Date().toISOString(), onQuota);
      return next;
    });
  }, [onQuota]);

  const setChecked = useCallback((v) => {
    setCheckedState(prev => {
      const next = typeof v === "function" ? v(prev) : v;
      lsSet(KEYS.checked, next, onQuota);
      lsSet(KEYS.date, todayISO(), onQuota);      // ← دائماً حدّث التاريخ مع checked
      lsSet(KEYS.localTs, new Date().toISOString(), onQuota);
      return next;
    });
  }, [onQuota]);

  const setSubChecked = useCallback((v) => {
    setSubCheckedState(prev => {
      const next = typeof v === "function" ? v(prev) : v;
      lsSet(KEYS.subChecked, next, onQuota);
      lsSet(KEYS.localTs, new Date().toISOString(), onQuota);
      return next;
    });
  }, [onQuota]);

  const setShift = useCallback((v) => {
    setShiftState(v);
    lsSet(KEYS.shift, v, onQuota);
  }, [onQuota]);

  // ── ② Midnight Bug: كشف تغيّر التاريخ كل دقيقة ──────────────────────────
  useEffect(() => {
    const check = () => {
      const stored = lsGet(KEYS.date, null);
      const today  = todayISO();
      if (stored && stored !== today) {
        // يوم جديد! صفّر checked و subChecked تلقائياً
        setCheckedState({});
        setSubCheckedState({});
        lsSet(KEYS.checked,    {}, onQuota);
        lsSet(KEYS.subChecked, {}, onQuota);
        lsSet(KEYS.date,       today, onQuota);
        onNewDay?.(); // أعلم المكون الأب
      }
    };

    const t = setInterval(check, 60_000); // فحص كل دقيقة
    return () => clearInterval(t);
  }, [onNewDay, onQuota]);

  // ── دالة المزامنة الفعلية مع الـ Backend ───────────────────────────────
  const doSync = useCallback(async (t, c, sc) => {
    const today = todayISO();
    try {
      const [tr, dr] = await Promise.all([
        fetch("/api/db?resource=tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tasks: t }),
        }),
        fetch("/api/db?resource=daily", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date: today, checked: c, subChecked: sc }),
        }),
      ]);

      if (!tr.ok || !dr.ok) throw new Error("استجابة غير ناجحة من الـ API");
      setSyncStatus("synced");
      pendingData.current = null; // مسح البيانات المعلّقة بعد النجاح
    } catch {
      setSyncStatus("error");
      // احتفظ بالبيانات لمحاولة إعادة الإرسال عند عودة الاتصال
      pendingData.current = { tasks: t, checked: c, subChecked: sc };
    }
  }, []);

  // ── Debounced Sync: يُطلق المزامنة بعد 1.5 ثانية من آخر تغيير ──────────
  const scheduleSyncToDB = useCallback((t, c, sc) => {
    if (!dbAvailable.current) return;
    clearTimeout(syncTimer.current);
    setSyncStatus("syncing");
    pendingData.current = { tasks: t, checked: c, subChecked: sc };
    syncTimer.current = setTimeout(() => doSync(t, c, sc), 1500);
  }, [doSync]);

  // ── تشغيل الـ Sync عند تغيير البيانات (بتجاهل أول render) ──────────────
  useEffect(() => {
    if (!isMounted.current) { isMounted.current = true; return; }
    scheduleSyncToDB(tasks, checked, subChecked);
  }, [tasks, checked, subChecked, scheduleSyncToDB]);

  // ── ① Race Condition Fix: جلب البيانات من DB مع مقارنة الـ timestamps ──
  useEffect(() => {
    const load = async () => {
      try {
        const today = todayISO();
        const [tr, dr] = await Promise.all([
          fetch("/api/db?resource=tasks"),
          fetch(`/api/db?resource=daily&date=${today}`),
        ]);
        if (!tr.ok || !dr.ok) return;

        const td = await tr.json();
        const dd = await dr.json();
        dbAvailable.current = true;

        // مقارنة الـ timestamps لتحديد أي النسختين أحدث
        const localTs  = lsGet(KEYS.localTs, null);
        const dbTaskTs = td.updatedAt ?? null;
        const dbDayTs  = dd.updatedAt ?? null;

        const localTime  = localTs  ? new Date(localTs).getTime()  : 0;
        const dbTaskTime = dbTaskTs ? new Date(dbTaskTs).getTime() : 0;
        const dbDayTime  = dbDayTs  ? new Date(dbDayTs).getTime()  : 0;

        // ① إذا كانت بيانات الـ DB أحدث من آخر تعديل محلي → استخدمها
        //    إذا كانت البيانات المحلية أحدث → احتفظ بها (ولا تكتب فوقها)
        if (dbTaskTime > localTime && td.tasks?.length) {
          setTasksState(td.tasks);
          lsSet(KEYS.tasks, td.tasks, onQuota);
        }
        if (dbDayTime > localTime) {
          setCheckedState(dd.checked ?? {});
          setSubCheckedState(dd.subChecked ?? {});
          lsSet(KEYS.checked,    dd.checked    ?? {}, onQuota);
          lsSet(KEYS.subChecked, dd.subChecked ?? {}, onQuota);
        }

        setSyncStatus("synced");
      } catch {
        setSyncStatus("offline");
      }
    };
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── ④ Online Retry: إعادة المزامنة عند عودة الاتصال ────────────────────
  useEffect(() => {
    const handleOnline = () => {
      if (!pendingData.current || !dbAvailable.current) return;
      const { tasks: t, checked: c, subChecked: sc } = pendingData.current;
      setSyncStatus("syncing");
      doSync(t, c, sc);
    };
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [doSync]);

  // ── ③ beforeunload Flush: إرسال البيانات قبل إغلاق المتصفح ─────────────
  useEffect(() => {
    const handleBeforeUnload = () => {
      // لا شيء معلّق أو لا يوجد اتصال مؤكد
      if (!pendingData.current || !dbAvailable.current) return;

      const { tasks: t, checked: c, subChecked: sc } = pendingData.current;
      const today = todayISO();

      // sendBeacon يعمل حتى بعد إغلاق الصفحة (لا يحتاج keepalive)
      // API sendBeacon لا يدعم custom headers → نرسل text/plain
      // (الـ Backend يقبل هذا لأن neon يعالج الـ body مباشرةً)
      try {
        navigator.sendBeacon(
          "/api/db?resource=tasks",
          new Blob([JSON.stringify({ tasks: t })], { type: "application/json" })
        );
        navigator.sendBeacon(
          "/api/db?resource=daily",
          new Blob([JSON.stringify({ date: today, checked: c, subChecked: sc })], {
            type: "application/json",
          })
        );
      } catch (e) {
        // sendBeacon قد يفشل في بعض المتصفحات — لا مشكلة، البيانات محفوظة محلياً
        console.warn("[useSync] sendBeacon فشل:", e);
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []); // لا يحتاج dependencies لأنه يقرأ pendingData.current مباشرة (ref)

  // ── تنظيف الـ Timer عند unmount ─────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (syncTimer.current) clearTimeout(syncTimer.current);
    };
  }, []);

  return {
    // State
    tasks, setTasks,
    checked, setChecked,
    subChecked, setSubChecked,
    shift, setShift,
    syncStatus,
    dbAvailable,
  };
}
