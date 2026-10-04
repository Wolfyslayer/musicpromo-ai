import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { initNativeShell } from "@/lib/nativeApp";
import { syncNativePushRegistration, unregisterNativePushToken } from "@/services/pushNotifications";

/** Initializes Capacitor chrome and push token sync when running as a native app. */
export default function NativeAppBootstrap() {
  const navigate = useNavigate();
  const { isAuthenticated, authChecked } = useAuth();

  useEffect(() => {
    initNativeShell();
  }, []);

  useEffect(() => {
    if (!authChecked) return;
    if (!isAuthenticated) {
      unregisterNativePushToken();
      return;
    }
    syncNativePushRegistration(navigate);
  }, [isAuthenticated, authChecked, navigate]);

  return null;
}
