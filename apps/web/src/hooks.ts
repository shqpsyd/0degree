import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { readEvents, readJSON, subscribeTimeline, writeJSON } from "@zaitu/core";

let timelineVersion = 0;
const subscribe = (fn: () => void) => {
  const bump = () => {
    timelineVersion++;
    fn();
  };
  // 同一标签页内由 core 通知；其它标签页修改时由 storage 事件通知
  const onStorage = (e: StorageEvent) => (e.key === null || e.key.startsWith("zaitu.timeline")) && bump();
  const off = subscribeTimeline(bump);
  window.addEventListener("storage", onStorage);
  return () => {
    off();
    window.removeEventListener("storage", onStorage);
  };
};

export const useTimeline = () => {
  const version = useSyncExternalStore(subscribe, () => timelineVersion);
  return useMemo(() => readEvents(), [version]);
};

type Theme = "light" | "dark";
const THEME_KEY = "zaitu.theme.v1";

/** 主题：首次跟随系统，用户切换后记住选择。 */
export const useTheme = () => {
  const [theme, setTheme] = useState<Theme>(
    () => {
      const saved = readJSON<unknown>(THEME_KEY, null);
      return saved === "dark" || saved === "light" ? saved
        : (window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    },
  );
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme === "dark" ? "#16201d" : "#f5f7f5");
  }, [theme]);
  const toggle = () =>
    setTheme((t) => {
      const next = t === "dark" ? "light" : "dark";
      try { writeJSON(THEME_KEY, next); } catch { /* Theme remains usable without persistence. */ }
      return next;
    });
  return { theme, toggle };
};

export const formatTime = (iso: string) =>
  new Date(iso).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
