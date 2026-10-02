/** Hosted web app URL — used for free WebView bridges (Remotion + Whisper), same cost model as web. */
export function getWebAppBaseUrl(): string {
  return String(process.env.EXPO_PUBLIC_WEB_APP_URL || '').replace(/\/$/, '');
}

export function hasFreeWebBridges(): boolean {
  return Boolean(getWebAppBaseUrl());
}

/** When `openai`, mobile may call paid transcribeLyrics Edge Function instead of the free web worker. */
export function lyricsSyncUsesOpenAiApi(): boolean {
  return String(process.env.EXPO_PUBLIC_LYRICS_SYNC || 'web').toLowerCase() === 'openai';
}
