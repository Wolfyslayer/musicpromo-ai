import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "musicpromo_settings";

export type Settings = {
  defaultDuration: number;
  defaultPlatforms: string[];
  defaultPostingTime: string;
  defaultTemplate: string;
  defaultVideoDuration: number;
  theme: "system";
  notifications: {
    campaignReady: boolean;
    weeklyReport: boolean;
    performanceTips: boolean;
  };
  aiProvider: string;
};

export const DEFAULT_SETTINGS: Settings = {
  defaultDuration: 7,
  defaultPlatforms: ["TikTok", "Instagram Reels", "YouTube Shorts"],
  defaultPostingTime: "18:00",
  defaultTemplate: "HOOK",
  defaultVideoDuration: 15,
  theme: "system",
  notifications: { campaignReady: true, weeklyReport: false, performanceTips: true },
  aiProvider: "Base44 InvokeLLM (default)",
};

export async function getSettings(): Promise<Settings> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw), theme: "system" } : { ...DEFAULT_SETTINGS };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveSettings(settings: Settings) {
  await AsyncStorage.setItem(KEY, JSON.stringify({ ...settings, theme: "system" }));
}
