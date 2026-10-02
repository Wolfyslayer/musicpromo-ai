import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import { toast } from "@/components/ui/toast";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import { completeAuthFromUrl, getCurrentUser, mapUser, upsertUserProfile } from "@/lib/supabaseAuth";

const AuthContext = createContext(null);

const refreshListeners = new Set();

/** Re-run a screen's loader after sign-in (the web app used a window CustomEvent for this). */
export function useWorkspaceRefresh(reload) {
  useEffect(() => {
    if (typeof reload !== "function") return undefined;
    refreshListeners.add(reload);
    return () => refreshListeners.delete(reload);
  }, [reload]);
}

function emitWorkspaceRefresh() {
  refreshListeners.forEach((fn) => fn());
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(isSupabaseConfigured);
  const [authChecked, setAuthChecked] = useState(!isSupabaseConfigured);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const pendingActionRef = useRef(null);
  const isAuthenticatedRef = useRef(false);
  useEffect(() => {
    isAuthenticatedRef.current = isAuthenticated;
  }, [isAuthenticated]);

  const applySessionUser = useCallback((sessionUser) => {
    const mapped = mapUser(sessionUser);
    setUser(mapped);
    setIsAuthenticated(Boolean(mapped));
    setAuthChecked(true);
    setIsLoadingAuth(false);
    if (mapped) setTimeout(() => upsertUserProfile(mapped), 0);
    return mapped;
  }, []);

  const checkUserAuth = useCallback(async () => {
    try {
      setIsLoadingAuth(true);
      const currentUser = await getCurrentUser();
      setUser(currentUser);
      setIsAuthenticated(true);
      await upsertUserProfile(currentUser);
    } catch {
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setIsLoadingAuth(false);
      setAuthChecked(true);
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return undefined;

    let recoveryOpened = false;
    const openRecovery = () => {
      setRecoveryMode(true);
      if (recoveryOpened) return;
      recoveryOpened = true;
      router.push("/reset-password");
    };

    supabase.auth
      .getSession()
      .then(({ data }) => applySessionUser(data.session?.user))
      .catch(() => applySessionUser(null));

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") openRecovery();
      if (!session?.user && event !== "SIGNED_OUT") return;
      applySessionUser(session?.user);
    });

    // Email confirmation and password-recovery links open the app with ?code= or #access_token=.
    const handleUrl = async (url) => {
      if (!url || !/[?#&](code|access_token|error_description)=/.test(url)) return;
      try {
        const session = await completeAuthFromUrl(url);
        if (session?.user) {
          applySessionUser(session.user);
          if (url.includes("reset-password")) openRecovery();
        }
      } catch (error) {
        toast({ variant: "destructive", title: "Sign-in link failed", description: error?.message });
      }
    };
    Linking.getInitialURL().then(handleUrl);
    const sub = Linking.addEventListener("url", ({ url }) => handleUrl(url));

    return () => {
      data.subscription.unsubscribe();
      sub.remove();
    };
  }, [applySessionUser]);

  const logout = useCallback(async () => {
    pendingActionRef.current = null;
    setUser(null);
    setIsAuthenticated(false);
    try {
      if (supabase) {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
      }
    } catch (error) {
      console.error("Sign out failed:", error);
    }
  }, []);

  const navigateToLogin = useCallback(() => router.push("/login"), []);

  /** Run `action` now if signed in; otherwise open the login screen and resume it after sign-in. */
  const requireAuth = useCallback((action) => {
    if (isAuthenticatedRef.current) {
      if (typeof action === "function") action();
      return true;
    }
    pendingActionRef.current = typeof action === "function" ? action : null;
    router.push("/login");
    return false;
  }, []);

  const finishLogin = useCallback(async () => {
    const currentUser = await getCurrentUser();
    const action = pendingActionRef.current;
    pendingActionRef.current = null;
    setUser(currentUser);
    setIsAuthenticated(true);
    setAuthChecked(true);
    setIsLoadingAuth(false);
    toast({ title: "You're signed in" });
    if (router.canGoBack()) router.back();
    else router.replace("/");
    setTimeout(() => {
      if (typeof action === "function") action();
      else emitWorkspaceRefresh();
    }, 350);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoadingAuth,
        authChecked,
        recoveryMode,
        setRecoveryMode,
        logout,
        navigateToLogin,
        checkUserAuth,
        requireAuth,
        finishLogin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};
