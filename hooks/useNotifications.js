/**
 * useNotifications.js — إدارة إشعارات المهام ومواقيت الصلاة
 *
 * يُصلح المشاكل التالية:
 *  ① Stale Prayer Times: إعادة جلب المواقيت عند تغيّر التاريخ (منتصف الليل)
 *  ② تجنّب إشعارات مكرّرة عبر notifiedRefs
 *  ③ تنظيف الـ intervals عند unmount لمنع Memory Leaks
 *  ④ دعم كامل لحالة "لا يوجد Notification API" (SSR / old browsers)
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { todayISO } from "./useSync.js";

// مواقيت الصلاة من aladhan.com — يمكن تمرير المدينة كـ prop لاحقاً
const PRAYER_API = "https://api.aladhan.com/v1/timingsByCity?city=Cairo&country=Egypt&method=5";

// أسماء الصلوات
const PRAYERS = [
  { name: "الفجر",   key: "Fajr"    },
  { name: "الظهر",   key: "Dhuhr"   },
  { name: "العصر",   key: "Asr"     },
  { name: "المغرب",  key: "Maghrib" },
  { name: "العشاء",  key: "Isha"    },
];

/**
 * @param {Array} tasks - مصفوفة المهام الحالية (لفحص alertTime)
 * @returns {{
 *   notifPerm: 'default'|'granted'|'denied',
 *   prayerTimes: object|null,
 *   requestNotifPerm: Function,
 * }}
 */
export default function useNotifications(tasks) {
  const hasNotifAPI = typeof Notification !== "undefined";

  const [notifPerm, setNotifPerm] = useState(
    hasNotifAPI ? Notification.permission : "denied"
  );
  const [prayerTimes, setPrayerTimes] = useState(null);

  // تتبع التاريخ الحالي لكشف تغيّر اليوم وإعادة جلب المواقيت
  const currentDate  = useRef(todayISO());
  // تتبع الإشعارات التي تم إرسالها لمنع التكرار
  const notifiedRefs = useRef({});

  // ── ① جلب مواقيت الصلاة مع إعادة الجلب عند تغيّر اليوم ─────────────────
  const fetchPrayerTimes = useCallback(async () => {
    try {
      const res  = await fetch(PRAYER_API);
      if (!res.ok) return;
      const data = await res.json();
      if (data?.data?.timings) {
        setPrayerTimes(data.data.timings);
        // مسح الإشعارات المُرسلة عند تحديث المواقيت (يوم جديد)
        notifiedRefs.current = {};
      }
    } catch (e) {
      console.warn("[useNotifications] فشل جلب مواقيت الصلاة:", e);
    }
  }, []);

  // جلب أوّلي عند التحميل
  useEffect(() => {
    fetchPrayerTimes();
  }, [fetchPrayerTimes]);

  // ① كشف تغيّر التاريخ وإعادة جلب المواقيت تلقائياً
  useEffect(() => {
    const checkDate = () => {
      const today = todayISO();
      if (today !== currentDate.current) {
        currentDate.current = today;
        fetchPrayerTimes(); // إعادة جلب لليوم الجديد
      }
    };
    // فحص كل دقيقة — متناسق مع interval المزامنة في useSync
    const t = setInterval(checkDate, 60_000);
    return () => clearInterval(t);
  }, [fetchPrayerTimes]);

  // ── إرسال الإشعارات كل 15 ثانية ─────────────────────────────────────────
  useEffect(() => {
    if (notifPerm !== "granted" || !hasNotifAPI) return;

    const interval = setInterval(() => {
      const now  = new Date();
      const hhmm = now.getHours().toString().padStart(2, "0")
                 + ":"
                 + now.getMinutes().toString().padStart(2, "0");

      // ── تنبيهات المهام العادية ──────────────────────────────────────────
      tasks.forEach((t) => {
        if (!t.alertTime || t.alertTime !== hhmm) return;
        const key = `task_${t.id}_${hhmm}`;
        if (notifiedRefs.current[key]) return;
        try {
          new Notification("تذكير بمهمة 🔔", {
            body: t.title,
            icon: "/favicon.ico",
            tag:  key, // يمنع تكرار نفس الإشعار في الـ OS
          });
          notifiedRefs.current[key] = true;
        } catch (e) {
          console.warn("[useNotifications] فشل إرسال الإشعار:", e);
        }
      });

      // ── تنبيهات الصلاة ────────────────────────────────────────────────
      if (!prayerTimes) return;

      PRAYERS.forEach((p) => {
        const timeStr = prayerTimes[p.key];
        if (!timeStr) return;

        // بعض استجابات aladhan تحتوي على "12:30 (Dhuhr)" — نأخذ الجزء الأول فقط
        const [rawH, rawM] = timeStr.split(" ")[0].split(":").map(Number);
        if (isNaN(rawH) || isNaN(rawM)) return;

        const pDate = new Date();
        pDate.setHours(rawH, rawM, 0, 0);
        const diffMins = Math.round((pDate.getTime() - now.getTime()) / 60_000);

        if (diffMins === 5) {
          const key = `p5_${p.key}_${currentDate.current}`;
          if (!notifiedRefs.current[key]) {
            try {
              new Notification("استعد للصلاة 🕌", {
                body: `باقي 5 دقائق على أذان ${p.name}`,
                tag:  key,
              });
              notifiedRefs.current[key] = true;
            } catch {}
          }
        }

        if (diffMins === 0) {
          const key = `p0_${p.key}_${currentDate.current}`;
          if (!notifiedRefs.current[key]) {
            try {
              new Notification("حان وقت الصلاة 🕌", {
                body: `حان الآن موعد أذان ${p.name}`,
                tag:  key,
              });
              notifiedRefs.current[key] = true;
            } catch {}
          }
        }
      });
    }, 15_000);

    return () => clearInterval(interval);
  // tasks كـ dependency لأن alertTime قد تتغيّر عند تعديل مهمة
  }, [tasks, prayerTimes, notifPerm, hasNotifAPI]);

  // ── طلب إذن الإشعارات ────────────────────────────────────────────────────
  const requestNotifPerm = useCallback(async () => {
    if (!hasNotifAPI) return;
    try {
      const perm = await Notification.requestPermission();
      setNotifPerm(perm);
    } catch (e) {
      console.warn("[useNotifications] فشل طلب الإذن:", e);
    }
  }, [hasNotifAPI]);

  return { notifPerm, prayerTimes, requestNotifPerm };
}
