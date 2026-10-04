import { Capacitor } from "@capacitor/core";

export function isNativeApp() {
  return Capacitor.isNativePlatform();
}

export function nativePlatform() {
  return Capacitor.getPlatform();
}

/** Status bar + splash polish on iOS/Android only. */
export async function initNativeShell() {
  if (!isNativeApp()) return;

  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    await StatusBar.setStyle({ style: Style.Dark });
    if (Capacitor.getPlatform() === "android") {
      await StatusBar.setBackgroundColor({ color: "#0c0a12" });
    }
  } catch (e) {
    console.warn("[native] status bar", e);
  }

  try {
    const { SplashScreen } = await import("@capacitor/splash-screen");
    await SplashScreen.hide();
  } catch (e) {
    console.warn("[native] splash", e);
  }
}
