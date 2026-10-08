import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { router } from "expo-router";
import { AppUser, mapUser, upsertUserProfile } from "@/lib/supabaseAuth";
import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";
import { db } from "@/api/base44Client";
import { signInWithGoogleNative } from "@/lib/googleAuth";
import { logError, userFacingError } from "@/lib/errors";

type AuthContextValue = {
  user: AppUser | null;
  isAuthenticated: boolean;
  isLoadingAuth: boolean;
  authChecked: boolean;
  authError: string | null;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  register: (email: string, password: string, handle?: string) => Promise<void>;
  logout: () => Promise<void>;
  requestReset: (email: string) => Promise<void>;
  refreshSession: () => Promise<void>;
  /** Like web: run action if signed in, otherwise send user to login. */
  requireAuth: (action?: () => void) => boolean;
  navigateToLogin: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const isAuthenticatedRef = useRef(false);
  const pendingActionRef = useRef<(() => void) | null>(null);

  isAuthenticatedRef.current = isAuthenticated;

  const applyUser = useCallback((next: AppUser | null) => {
    setUser(next);
    setIsAuthenticated(Boolean(next));
    setAuthChecked(true);
    setIsLoadingAuth(false);
    setAuthError(null);
  }, []);

  const refreshSession = useCallback(async () => {
    if (!supabase || !isSupabaseConfigured) {
      applyUser(null);
      return;
    }
    setIsLoadingAuth(true);
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      const mapped = mapUser(data.session?.user || null);
      applyUser(mapped);
      if (mapped && data.session?.user) {
        upsertUserProfile(mapped, data.session.user).catch((e) =>
          logError("upsertUserProfile", e)
        );
      }
    } catch (e) {
      logError("refreshSession", e);
      setAuthError(userFacingError(e, "Could not restore session."));
      applyUser(null);
    }
  }, [applyUser]);

  useEffect(() => {
    refreshSession();
    if (!supabase) return undefined;
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const mapped = mapUser(session?.user || null);
      applyUser(mapped);
      if (mapped && pendingActionRef.current) {
        const action = pendingActionRef.current;
        pendingActionRef.current = null;
        setTimeout(() => action(), 0);
      }
    });
    return () => data.subscription.unsubscribe();
  }, [applyUser, refreshSession]);

  const navigateToLogin = useCallback(() => {
    router.push("/(auth)/login");
  }, []);

  const requireAuth = useCallback(
    (action?: () => void) => {
      if (isAuthenticatedRef.current) {
        if (typeof action === "function") action();
        return true;
      }
      pendingActionRef.current = typeof action === "function" ? action : null;
      navigateToLogin();
      return false;
    },
    [navigateToLogin]
  );

  const login = useCallback(async (email: string, password: string) => {
    setAuthError(null);
    try {
      await db.auth.loginViaEmailPassword(email, password);
    } catch (e) {
      logError("login", e);
      const msg = userFacingError(e, "Invalid email or password");
      setAuthError(msg);
      throw e;
    }
  }, []);

  const loginWithGoogle = useCallback(async () => {
    setAuthError(null);
    try {
      await signInWithGoogleNative();
    } catch (e) {
      logError("loginWithGoogle", e);
      const msg = userFacingError(e, "Google sign-in failed.");
      setAuthError(msg);
      throw e;
    }
  }, []);

  const register = useCallback(async (email: string, password: string, handle?: string) => {
    setAuthError(null);
    try {
      await db.auth.register({ email, password, handle });
    } catch (e) {
      logError("register", e);
      const msg = userFacingError(e, "Could not create account.");
      setAuthError(msg);
      throw e;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await db.auth.logout();
    } catch (e) {
      logError("logout", e);
    } finally {
      applyUser(null);
    }
  }, [applyUser]);

  const requestReset = useCallback(async (email: string) => {
    try {
      await db.auth.resetPasswordRequest(email);
    } catch (e) {
      logError("requestReset", e);
      throw e;
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated,
      isLoadingAuth,
      authChecked,
      authError,
      login,
      loginWithGoogle,
      register,
      logout,
      requestReset,
      refreshSession,
      requireAuth,
      navigateToLogin,
    }),
    [
      user,
      isAuthenticated,
      isLoadingAuth,
      authChecked,
      authError,
      login,
      loginWithGoogle,
      register,
      logout,
      requestReset,
      refreshSession,
      requireAuth,
      navigateToLogin,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
