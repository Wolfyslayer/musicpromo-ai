import { db, ensureClientSessionToken } from "@/api/base44Client";
import { getSessionAccessToken } from "@/lib/app-params";
import { isNativeApp, nativePlatform } from "@/lib/nativeApp";

let listenersAttached = false;
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

function attachPushListeners(navigate) {
  if (listenersAttached || !isNativeApp()) return;
  listenersAttached = true;

  import("@capacitor/push-notifications").then(({ PushNotifications }) => {
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
}

/**
 * Request permission and register FCM/APNs token (native app only).
 * @param {(path: string) => void} [navigate] react-router navigate
 */
export async function syncNativePushRegistration(navigate) {
  if (!isNativeApp()) return { ok: false, skipped: true };

  attachPushListeners(navigate);

  const { PushNotifications } = await import("@capacitor/push-notifications");
  let perm = await PushNotifications.checkPermissions();
  if (perm.receive === "prompt") {
    perm = await PushNotifications.requestPermissions();
  }
  if (perm.receive !== "granted") {
    return { ok: false, denied: true };
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
