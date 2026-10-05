import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { initNativeShell } from "@/lib/nativeApp";
import {
  attachPushListeners,
  syncNativePushRegistration,
  unregisterNativePushToken,
} from "@/services/pushNotifications";
import { initializeNativeGoogleAuth } from "@/lib/googleAuthNativeSdk";
import { installNativeGoogleAuthListener } from "@/lib/googleAuthNative";

/** Initializes Capacitor chrome and push token sync when running as a native app. */
export default function NativeAppBootstrap() {
  const navigate = useNavigate();
  const { isAuthenticated, authChecked } = useAuth();

  useEffect(() => {
    initNativeShell();
    initializeNativeGoogleAuth();
    attachPushListeners(navigate);
    // Fallback if an OAuth callback still opens via App Link (older builds / webView tests).
    installNativeGoogleAuthListener(navigate);
  }, [navigate]);

  useEffect(() => {
    if (!authChecked) return;
    if (!isAuthenticated) {
      unregisterNativePushToken();
      return;
    }
    // Defer so the post-login UI is visible before the system permission sheet (Android 13+ / iOS).
    const timer = window.setTimeout(() => {
      syncNativePushRegistration(navigate).catch((e) => {
        console.warn("[push] sync registration", e);
      });
    }, 600);
    return () => window.clearTimeout(timer);
  }, [isAuthenticated, authChecked, navigate]);

  return null;
}
