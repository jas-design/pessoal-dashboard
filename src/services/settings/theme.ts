import supabase from "../../lib/supabase/browser";

export type ThemePreference = "system" | "light" | "dark";
type EffectiveTheme = "light" | "dark";

const storageKey = "dashboard-theme";
let isInitialized = false;

function isThemePreference(value: string | null): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

function getSystemTheme(): EffectiveTheme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function getEffectiveTheme(preference: ThemePreference): EffectiveTheme {
  return preference === "system" ? getSystemTheme() : preference;
}

function applyTheme(preference: ThemePreference, shouldNotify: boolean) {
  const effectiveTheme = getEffectiveTheme(preference);

  document.documentElement.dataset.theme = effectiveTheme;
  document.documentElement.dataset.themePreference = preference;
  localStorage.setItem(storageKey, preference);

  if (shouldNotify) {
    window.dispatchEvent(
      new CustomEvent("dashboard-theme-change", {
        detail: { preference, effectiveTheme },
      })
    );
  }
}

export function readThemePreference(): ThemePreference {
  const savedTheme = localStorage.getItem(storageKey);

  return isThemePreference(savedTheme) ? savedTheme : "system";
}

export function setThemePreference(preference: ThemePreference) {
  applyTheme(preference, true);
}

export function initializeThemePreference() {
  applyTheme(readThemePreference(), false);

  if (isInitialized) {
    return;
  }

  isInitialized = true;
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    const preference = readThemePreference();

    if (preference === "system") {
      applyTheme(preference, true);
    }
  });
}

export function toggleThemePreference() {
  const currentTheme = getEffectiveTheme(readThemePreference());
  const nextPreference: ThemePreference = currentTheme === "dark" ? "light" : "dark";

  setThemePreference(nextPreference);

  return nextPreference;
}

export function getCurrentEffectiveTheme() {
  return getEffectiveTheme(readThemePreference());
}

export async function loadAccountThemePreference() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) {
    return null;
  }

  const { data, error } = await supabase
    .from("user_preferences")
    .select("theme")
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (error || !isThemePreference(data?.theme)) {
    return null;
  }

  setThemePreference(data.theme);

  return data.theme;
}

export async function saveAccountThemePreference(preference: ThemePreference) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) {
    return false;
  }

  const { error } = await supabase
    .from("user_preferences")
    .upsert(
      {
        user_id: session.user.id,
        theme: preference,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

  return !error;
}
