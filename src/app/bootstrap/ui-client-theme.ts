export type ThemeMode = "system" | "light" | "dark";

export function resolveEffectiveTheme(mode: ThemeMode): "light" | "dark" {
  if (mode === "dark") {
    return "dark";
  }

  if (mode === "light") {
    return "light";
  }

  if (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }

  return "light";
}

export function applyThemeMode(mode: ThemeMode): void {
  if (typeof document === "undefined") {
    return;
  }

  const root = document.documentElement;
  root.dataset.themeMode = mode;
  root.dataset.theme = resolveEffectiveTheme(mode);
}

export function readPersistedThemeMode(storageKey: string, cachedThemeMode: unknown): ThemeMode {
  if (cachedThemeMode === "system" || cachedThemeMode === "dark" || cachedThemeMode === "light") {
    return cachedThemeMode;
  }

  if (typeof localStorage === "undefined") {
    return "system";
  }

  const mode = localStorage.getItem(storageKey);
  if (mode === "system" || mode === "dark" || mode === "light") {
    return mode;
  }

  return "system";
}

export function persistThemeMode(storageKey: string, mode: ThemeMode): void {
  if (typeof localStorage === "undefined") {
    return;
  }

  localStorage.setItem(storageKey, mode);
}

export function iconForThemeMode(mode: ThemeMode): string {
  if (mode === "dark") {
    return "☾";
  }

  if (mode === "light") {
    return "☼";
  }

  return "◩";
}

export function labelForThemeMode(mode: ThemeMode): string {
  if (mode === "dark") {
    return "Dark";
  }

  if (mode === "light") {
    return "Light";
  }

  return "System";
}

export function nextThemeMode(mode: ThemeMode): ThemeMode {
  if (mode === "system") {
    return "dark";
  }

  if (mode === "dark") {
    return "light";
  }

  return "system";
}
