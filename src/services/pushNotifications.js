import { db, ensureClientSessionToken } from "@/api/base44Client";
import { getSessionAccessToken } from "@/lib/app-params";
import { isNativeApp, nativePlatform } from "@/lib/nativeApp";

const PUSH_CHANNEL_ID = "musicpromo_updates";
const PERMISSION_DENIED_KEY = "musicpromo_push_perm_denied";

let listenersAttached = false;
let listenersPromise = null;
let lastRegisteredToken = null;

function unwrap(res) {
  return res?.data ?? res;
}

async function invoke(name, body) {
  ensureClientSessionToken() || getSessionAccessToken();
  const res = await db.functions.invoke(name, body || {});
  return unwrap(res);
}

export function canUseNativePush() {
  return isNativeApp();
}

function readDeniedFlag() {
  try {
    return sessionStorage.getItem(PERMISSION_DENIED_KEY) === "1";
  } catch {
    return false;
  }
}

function writeDeniedFlag(denied) {
  try {
    if (denied) sessionStorage.setItem(PERMISSION_DENIED_KEY, "1");
    else sessionStorage.removeItem(PERMISSION_DENIED_KEY);
  } catch {
    /* ignore */
  }
}

/** Attach FCM/APNs listeners before `register()` so tokens are not dropped. */
export function attachPushListeners(navigate) {
  if (!isNativeApp()) return Promise.resolve();
  if (listenersPromise) return listenersPromise;

  listenersPromise = import("@capacitor/push-notifications").then(({ PushNotifications }) => {
    if (listenersAttached) return;
    listenersAttached = true;

    PushNotifications.addListener("registration", async (token) => {
      const value = token?.value;
      if (!value || value === lastRegisteredToken) return;
      lastRegisteredToken = value;
      try {
        await invoke("registerPushToken", {
          token: value,
          platform: nativePlatform() === "ios" ? "ios" : "android",
        });
      } catch (e) {
        console.warn("[push] register token", e);
      }
    });

    PushNotifications.addListener("registrationError", (err) => {
      console.warn("[push] registration error", err);
    });

    PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
      const route = action?.notification?.data?.route;
      if (route && typeof navigate === "function") {
        navigate(String(route));
      }
    });
  });

  return listenersPromise;
}

async function ensureAndroidPushChannel(PushNotifications) {
  if (nativePlatform() !== "android") return;
  try {
    await PushNotifications.createChannel({
      id: PUSH_CHANNEL_ID,
      name: "Campaign & launch updates",
      description: "Weekly digests and important MusicPromo alerts",
      importance: 4,
      visibility: 1,
      vibration: true,
    });
  } catch (e) {
    console.warn("[push] createChannel", e);
  }
}

async function ensurePushPermission(PushNotifications) {
  let perm = await PushNotifications.checkPermissions();
  if (perm.receive === "granted") {
    writeDeniedFlag(false);
    return perm;
  }

  // Android can return `prompt-with-rationale`; iOS uses `prompt` — request whenever not granted.
  if (perm.receive === "denied" && readDeniedFlag()) {
    return perm;
  }

  perm = await PushNotifications.requestPermissions();
  if (perm.receive === "granted") {
    writeDeniedFlag(false);
  } else if (perm.receive === "denied") {
    writeDeniedFlag(true);
  }
  return perm;
}

/**
 * Request permission and register FCM/APNs token (native app only).
 * @param {(path: string) => void} [navigate] react-router navigate
 */
export async function syncNativePushRegistration(navigate) {
  if (!isNativeApp()) return { ok: false, skipped: true };

  await attachPushListeners(navigate);

  const { PushNotifications } = await import("@capacitor/push-notifications");
  await ensureAndroidPushChannel(PushNotifications);

  const perm = await ensurePushPermission(PushNotifications);
  if (perm.receive !== "granted") {
    return { ok: false, denied: perm.receive === "denied", permission: perm.receive };
  }

  await PushNotifications.register();
  return { ok: true };
}

export async function unregisterNativePushToken() {
  if (!isNativeApp()) return;
  const token = lastRegisteredToken;
  lastRegisteredToken = null;
  try {
    if (token) {
      await invoke("unregisterPushToken", { token });
    } else {
      await invoke("unregisterPushToken", {});
    }
  } catch {
    /* best effort */
  }
  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    await PushNotifications.removeAllDeliveredNotifications();
  } catch {
    /* ignore */
  }
}
