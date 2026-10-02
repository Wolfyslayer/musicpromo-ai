import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * User preferences, persisted in AsyncStorage. Unlike the web version this is async.
 * Appearance follows the device, so there is no theme override.
 */
const KEY = "musicpromo_settings";

export const DEFAULT_SETTINGS = {
  defaultDuration: 7,
  defaultPlatforms: ["TikTok", "Instagram Reels", "YouTube Shorts"],
  defaultPostingTime: "18:00",
  defaultTemplate: "HOOK",
  defaultVideoDuration: 15,
  theme: "system",
  notifications: { campaignReady: true, weeklyReport: false, performanceTips: true },
  aiProvider: "Base44 InvokeLLM (default)",
};

export async function getSettings() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveSettings(s) {
  await AsyncStorage.setItem(KEY, JSON.stringify({ ...s, theme: "system" }));
}
