/**
 * User preferences store. Uses localStorage so it is fully portable off
 * Base44 (no platform-specific dependency). Defaults are sensible for an
 * independent artist promoting on short-form video.
 */
const KEY = "musicpromo_settings";

export const DEFAULT_SETTINGS = {
  defaultDuration: 7,
  defaultPlatforms: ["TikTok", "Instagram Reels", "YouTube Shorts"],
  defaultPostingTime: "18:00",
  defaultTemplate: "HOOK",
  defaultVideoDuration: 15,
  theme: "dark",
  notifications: { campaignReady: true, weeklyReport: false, performanceTips: true },
  aiProvider: "Base44 InvokeLLM (default)",
};

export function getSettings() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s) {
  localStorage.setItem(KEY, JSON.stringify(s));
  applyTheme(s.theme);
}

export function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === "light") root.classList.add("light");
  else root.classList.remove("light");
}