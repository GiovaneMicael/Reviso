import { useSyncExternalStore } from "react";

const KEY = "reviso-theme";
const listeners = new Set();

function systemTheme() {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function getThemePreference() {
  try {
    const saved = localStorage.getItem(KEY);
    if (["system", "light", "dark"].includes(saved)) return saved;
  } catch { /* localStorage indisponível */ }
  return "system";
}

export function getTheme() {
  const preference = getThemePreference();
  return preference === "system" ? systemTheme() : preference;
}

export function applyTheme(preference) {
  const resolved = preference === "system" ? systemTheme() : preference;
  document.documentElement.setAttribute("data-theme", resolved);
  document.documentElement.style.colorScheme = resolved;
}

function notify() {
  listeners.forEach((listener) => listener());
}

export function setTheme(preference) {
  if (!["system", "light", "dark"].includes(preference)) return;
  try { localStorage.setItem(KEY, preference); } catch { /* preferência só fica nesta sessão */ }
  applyTheme(preference);
  notify();
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return `${getThemePreference()}|${getTheme()}`;
}

export function useTheme() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot);
  const [preference, resolvedTheme] = snapshot.split("|");
  return [resolvedTheme, setTheme, preference];
}

if (typeof window !== "undefined" && window.matchMedia) {
  const colorScheme = window.matchMedia("(prefers-color-scheme: dark)");
  const handleSystemThemeChange = () => {
    if (getThemePreference() === "system") {
      applyTheme("system");
      notify();
    }
  };
  if (colorScheme.addEventListener) colorScheme.addEventListener("change", handleSystemThemeChange);
  else colorScheme.addListener?.(handleSystemThemeChange);
}
