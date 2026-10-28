import { useSyncExternalStore } from "react";

const KEY = "reviso-theme";
const listeners = new Set();

function systemTheme() {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function getTheme() {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === "dark" || saved === "light") return saved;
  } catch { /* localStorage indisponível */ }
  return systemTheme();
}

export function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
}

export function setTheme(theme) {
  try { localStorage.setItem(KEY, theme); } catch { /* ignora */ }
  applyTheme(theme);
  listeners.forEach((l) => l());
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, () => document.documentElement.getAttribute("data-theme") || "light");
  return [theme, () => setTheme(theme === "dark" ? "light" : "dark")];
}
