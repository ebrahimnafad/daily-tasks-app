import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useCallback } from "react";

export const todayISO = () => new Date().toISOString().split("T")[0];

const lsGet = (key, fallback) => {
  try {
    const v = localStorage.getItem(key);
    return v !== null ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
};
const lsSet = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch(e) { /* ignore */ }
};

// Fetchers
const fetchTasks = async () => {
  const res = await fetch("/api/db?resource=tasks");
  if (!res.ok) throw new Error("Network error");
  const data = await res.json();
  if (data.tasks) {
    lsSet("mhm_tasks", data.tasks);
    return data.tasks;
  }
  return lsGet("mhm_tasks", []);
};

const fetchDaily = async () => {
  const today = todayISO();
  const res = await fetch(`/api/db?resource=daily&date=${today}`);
  if (!res.ok) throw new Error("Network error");
  const data = await res.json();
  if (data.checked || data.subChecked) {
    const checked = data.checked || {};
    const subChecked = data.subChecked || {};
    lsSet("mhm_checked", checked);
    lsSet("mhm_sub_checked", subChecked);
    lsSet("mhm_date", today);
    return { checked, subChecked };
  }
  
  // Local fallback
  const savedDate = lsGet("mhm_date", null);
  if (savedDate === today) {
    return { checked: lsGet("mhm_checked", {}), subChecked: lsGet("mhm_sub_checked", {}) };
  }
  return { checked: {}, subChecked: {} };
};

export default function useSync(initialTasks, onNewDay) {
  const queryClient = useQueryClient();
  
  // Shift is local only
  const [shift, setShiftState] = useState(() => lsGet("mhm_shift", "morning"));
  const setShift = useCallback((v) => {
    setShiftState(v);
    lsSet("mhm_shift", v);
  }, []);

  const { data: tasks = initialTasks, isFetching: fetchingTasks } = useQuery({
    queryKey: ["tasks"],
    queryFn: fetchTasks,
    initialData: () => lsGet("mhm_tasks", initialTasks),
  });

  const { data: daily = { checked: {}, subChecked: {} }, isFetching: fetchingDaily } = useQuery({
    queryKey: ["daily", todayISO()],
    queryFn: fetchDaily,
    initialData: () => {
      const savedDate = lsGet("mhm_date", null);
      if (savedDate === todayISO()) {
        return { checked: lsGet("mhm_checked", {}), subChecked: lsGet("mhm_sub_checked", {}) };
      }
      return { checked: {}, subChecked: {} };
    },
  });

  const { checked, subChecked } = daily;

  // Mutations
  const { mutate: updateTasksMut } = useMutation({
    mutationFn: async (newTasks) => {
      await fetch("/api/db?resource=tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tasks: newTasks }),
      });
    },
    onMutate: async (newTasks) => {
      await queryClient.cancelQueries({ queryKey: ["tasks"] });
      const prevTasks = queryClient.getQueryData(["tasks"]);
      queryClient.setQueryData(["tasks"], newTasks);
      lsSet("mhm_tasks", newTasks);
      return { prevTasks };
    },
    onError: (err, newTasks, context) => {
      if (context?.prevTasks) {
        queryClient.setQueryData(["tasks"], context.prevTasks);
        lsSet("mhm_tasks", context.prevTasks);
      }
    }
  });

  const { mutate: updateDailyMut } = useMutation({
    mutationFn: async ({ checked: c, subChecked: sc }) => {
      const today = todayISO();
      await fetch("/api/db?resource=daily", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: today, checked: c, subChecked: sc }),
      });
    },
    onMutate: async ({ checked: c, subChecked: sc }) => {
      const today = todayISO();
      await queryClient.cancelQueries({ queryKey: ["daily", today] });
      const prevDaily = queryClient.getQueryData(["daily", today]);
      const newDaily = { checked: c, subChecked: sc };
      queryClient.setQueryData(["daily", today], newDaily);
      lsSet("mhm_checked", c);
      lsSet("mhm_sub_checked", sc);
      lsSet("mhm_date", today);
      return { prevDaily };
    },
    onError: (err, variables, context) => {
      if (context?.prevDaily) {
        queryClient.setQueryData(["daily", todayISO()], context.prevDaily);
      }
    }
  });

  // State setters wrapped to trigger mutations and cache updates
  const setTasks = useCallback((updater) => {
    const currentTasks = queryClient.getQueryData(["tasks"]) || initialTasks;
    const newTasks = typeof updater === "function" ? updater(currentTasks) : updater;
    updateTasksMut(newTasks);
  }, [queryClient, updateTasksMut, initialTasks]);

  const setChecked = useCallback((updater) => {
    const currentDaily = queryClient.getQueryData(["daily", todayISO()]) || { checked: {}, subChecked: {} };
    const newChecked = typeof updater === "function" ? updater(currentDaily.checked) : updater;
    updateDailyMut({ checked: newChecked, subChecked: currentDaily.subChecked });
  }, [queryClient, updateDailyMut]);

  const setSubChecked = useCallback((updater) => {
    const currentDaily = queryClient.getQueryData(["daily", todayISO()]) || { checked: {}, subChecked: {} };
    const newSubChecked = typeof updater === "function" ? updater(currentDaily.subChecked) : updater;
    updateDailyMut({ checked: currentDaily.checked, subChecked: newSubChecked });
  }, [queryClient, updateDailyMut]);

  // Midnight Bug Fix: check date every minute
  useEffect(() => {
    const checkDate = () => {
      const today = todayISO();
      const storedDate = lsGet("mhm_date", null);
      if (storedDate && storedDate !== today) {
        queryClient.setQueryData(["daily", today], { checked: {}, subChecked: {} });
        lsSet("mhm_checked", {});
        lsSet("mhm_sub_checked", {});
        lsSet("mhm_date", today);
        onNewDay?.();
      }
    };
    const t = setInterval(checkDate, 60_000);
    return () => clearInterval(t);
  }, [onNewDay, queryClient]);

  const syncStatus = (fetchingTasks || fetchingDaily) ? "syncing" : "synced";

  return {
    tasks, setTasks,
    checked, setChecked,
    subChecked, setSubChecked,
    shift, setShift,
    syncStatus,
    dbAvailable: true,
  };
}
