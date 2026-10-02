import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "expo-router";
import { mapUser, signOut, type AppUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

type AuthContextValue = {
  user: AppUser | null;
  isAuthenticated: boolean;
  isLoadingAuth: boolean;
  refreshKey: number;
  loginOpen: boolean;
  closeLogin: () => void;
  requireAuth: (action?: () => void) => boolean;
  logout: () => Promise<void>;
  refreshWorkspace: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loginOpen, setLoginOpen] = useState(false);
  const pendingAction = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!supabase) {
      setIsLoadingAuth(false);
      return;
    }
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setUser(mapUser(data.session?.user));
      setIsLoadingAuth(false);
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(mapUser(session?.user));
      setIsLoadingAuth(false);
      setRefreshKey((key) => key + 1);
    });
    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const closeLogin = useCallback(() => {
    pendingAction.current = null;
    setLoginOpen(false);
  }, []);

  const requireAuth = useCallback((action?: () => void) => {
    if (user) {
      action?.();
      return true;
    }
    pendingAction.current = action || null;
    setLoginOpen(true);
    return false;
  }, [user]);

  useEffect(() => {
    if (!user || !pendingAction.current) return;
    const action = pendingAction.current;
    pendingAction.current = null;
    setLoginOpen(false);
    action();
  }, [user]);

  const logout = useCallback(async () => {
    await signOut();
    setUser(null);
    router.replace("/");
  }, [router]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isLoadingAuth,
      refreshKey,
      loginOpen,
      closeLogin,
      requireAuth,
      logout,
      refreshWorkspace: () => setRefreshKey((key) => key + 1),
    }),
    [user, isLoadingAuth, refreshKey, loginOpen, closeLogin, requireAuth, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
