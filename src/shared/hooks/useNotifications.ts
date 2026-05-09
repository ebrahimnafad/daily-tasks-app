/**
 * useNotifications.ts — إدارة إشعارات المهام ومواقيت الصلاة
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { todayISO } from '@/lib/sync';
import type { Task, NotifPerm } from '@/types';

const PRAYER_API = 'https://api.aladhan.com/v1/timingsByCity?city=Cairo&country=Egypt&method=5';

interface Prayer {
  name: string;
  key: string;
}

const PRAYERS: Prayer[] = [
  { name: 'الفجر', key: 'Fajr' },
  { name: 'الظهر', key: 'Dhuhr' },
  { name: 'العصر', key: 'Asr' },
  { name: 'المغرب', key: 'Maghrib' },
  { name: 'العشاء', key: 'Isha' },
];

export interface UseNotificationsReturn {
  notifPerm: NotifPerm;
  prayerTimes: Record<string, string> | null;
  requestNotifPerm: () => Promise<void>;
}

export default function useNotifications(tasks: Task[]): UseNotificationsReturn {
  const hasNotifAPI = typeof Notification !== 'undefined';

  const [notifPerm, setNotifPerm] = useState<NotifPerm>(
    hasNotifAPI ? (Notification.permission as NotifPerm) : 'denied'
  );
  const [prayerTimes, setPrayerTimes] = useState<Record<string, string> | null>(null);

  const currentDate = useRef(todayISO());
  const notifiedRefs = useRef<Record<string, boolean>>({});

  const fetchPrayerTimes = useCallback(async () => {
    try {
      const res = await fetch(PRAYER_API);
      if (!res.ok) return;
      const data = (await res.json()) as { data?: { timings?: Record<string, string> } };
      if (data?.data?.timings) {
        setPrayerTimes(data.data.timings);
        notifiedRefs.current = {};
      }
    } catch (e) {
      console.warn('[useNotifications] فشل جلب مواقيت الصلاة:', e);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchPrayerTimes();
  }, [fetchPrayerTimes]);

  useEffect(() => {
    const checkDate = () => {
      const today = todayISO();
      if (today !== currentDate.current) {
        currentDate.current = today;
        void fetchPrayerTimes();
      }
    };
    const t = setInterval(checkDate, 60_000);
    return () => clearInterval(t);
  }, [fetchPrayerTimes]);

  useEffect(() => {
    if (notifPerm !== 'granted' || !hasNotifAPI) return;

    const interval = setInterval(() => {
      const now = new Date();
      const hhmm =
        now.getHours().toString().padStart(2, '0') +
        ':' +
        now.getMinutes().toString().padStart(2, '0');

      tasks.forEach((t) => {
        // Task alert time notification
        if (t.alertTime && t.alertTime === hhmm) {
          const key = `task_${t.id}_${hhmm}`;
          if (!notifiedRefs.current[key]) {
            try {
              new Notification('تذكير بمهمة 🔔', { body: t.title, icon: '/favicon.ico', tag: key });
              notifiedRefs.current[key] = true;
            } catch (e) {
              console.warn('[useNotifications] فشل إرسال الإشعار:', e);
            }
          }
        }
        // Subtask alert time notification
        t.subtasks.forEach((s) => {
          if (s.alertTime && s.alertTime === hhmm) {
            const key = `subtask_${t.id}_${s.id}_${hhmm}`;
            if (!notifiedRefs.current[key]) {
              try {
                new Notification('تذكير بمهمة فرعية 🔔', {
                  body: `${t.title} - ${s.text}`,
                  icon: '/favicon.ico',
                  tag: key,
                });
                notifiedRefs.current[key] = true;
              } catch (e) {
                console.warn('[useNotifications] فشل إرسال الإشعار للمهمة الفرعية:', e);
              }
            }
          }
        });
        // Specific date task - notify on that day morning
        if (t.recurrence === 'موعد محدد' && t.date && t.date === todayISO()) {
          const dateKey = `date_${t.id}_${t.date}`;
          if (!notifiedRefs.current[dateKey] && hhmm === '08:00') {
            try {
              new Notification('مهمة مجدولة 📅', {
                body: t.title,
                icon: '/favicon.ico',
                tag: dateKey,
              });
              notifiedRefs.current[dateKey] = true;
            } catch (e) {
              console.warn('[useNotifications] فشل إرسال إشعار التاريخ:', e);
            }
          }
        }
      });

      if (!prayerTimes) return;

      PRAYERS.forEach((p) => {
        const timeStr = prayerTimes[p.key];
        if (!timeStr) return;
        const [rawH, rawM] = timeStr.split(' ')[0].split(':').map(Number);
        if (isNaN(rawH) || isNaN(rawM)) return;

        const pDate = new Date();
        pDate.setHours(rawH, rawM, 0, 0);
        const diffMins = Math.round((pDate.getTime() - now.getTime()) / 60_000);

        if (diffMins === 5) {
          const key = `p5_${p.key}_${currentDate.current}`;
          if (!notifiedRefs.current[key]) {
            try {
              new Notification('استعد للصلاة 🕌', {
                body: `باقي 5 دقائق على أذان ${p.name}`,
                tag: key,
              });
              notifiedRefs.current[key] = true;
            } catch {
              /* ignore */
            }
          }
        }
        if (diffMins === 0) {
          const key = `p0_${p.key}_${currentDate.current}`;
          if (!notifiedRefs.current[key]) {
            try {
              new Notification('حان وقت الصلاة 🕌', {
                body: `حان الآن موعد أذان ${p.name}`,
                tag: key,
              });
              notifiedRefs.current[key] = true;
            } catch {
              /* ignore */
            }
          }
        }
      });
    }, 15_000);

    return () => clearInterval(interval);
  }, [tasks, prayerTimes, notifPerm, hasNotifAPI]);

  const requestNotifPerm = useCallback(async () => {
    if (!hasNotifAPI) return;
    try {
      const perm = await Notification.requestPermission();
      setNotifPerm(perm as NotifPerm);
    } catch (e) {
      console.warn('[useNotifications] فشل طلب الإذن:', e);
    }
  }, [hasNotifAPI]);

  return { notifPerm, prayerTimes, requestNotifPerm };
}
