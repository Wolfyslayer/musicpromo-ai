import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import * as Linking from 'expo-linking';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import {
  completeOAuthFromUrl,
  getCurrentUser,
  mapUser,
  signInWithPassword,
  signOut,
  signUpWithPassword,
  upsertUserProfile,
} from '@/lib/supabaseAuth';

type AuthUser = ReturnType<typeof mapUser>;

type AuthContextValue = {
  user: AuthUser;
  isAuthenticated: boolean;
  isLoadingAuth: boolean;
  isLoadingPublicSettings: boolean;
  authChecked: boolean;
  authError: { type?: string; message?: string } | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: (silent?: boolean) => Promise<void>;
  requireAuth: (action?: () => void) => boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);
  const [authError, setAuthError] = useState<AuthContextValue['authError']>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const pendingActionRef = useRef<(() => void) | null>(null);

  const applySessionUser = useCallback((sessionUser: Parameters<typeof mapUser>[0]) => {
    const mapped = mapUser(sessionUser);
    setUser(mapped);
    setIsAuthenticated(Boolean(mapped));
    setAuthChecked(true);
    setIsLoadingAuth(false);
    setAuthError(null);
    if (mapped) {
      setTimeout(() => upsertUserProfile(mapped), 0);
    }
    return mapped;
  }, []);

  const bootstrap = useCallback(async () => {
    setIsLoadingPublicSettings(true);
    setAuthError(null);
    if (!isSupabaseConfigured || !supabase) {
      setUser(null);
      setIsAuthenticated(false);
      setIsLoadingAuth(false);
      setIsLoadingPublicSettings(false);
      setAuthChecked(true);
      return;
    }
    try {
      const initialUrl = await Linking.getInitialURL();
      if (initialUrl) {
        const session = await completeOAuthFromUrl(initialUrl);
        if (session?.user) {
          applySessionUser(session.user);
          setIsLoadingPublicSettings(false);
          return;
        }
      }
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      if (data.session?.user) {
        applySessionUser(data.session.user);
      } else {
        setUser(null);
        setIsAuthenticated(false);
        setAuthChecked(true);
        setIsLoadingAuth(false);
      }
    } catch (error) {
      console.error('Session check failed:', error);
      setUser(null);
      setIsAuthenticated(false);
      setAuthChecked(true);
      setIsLoadingAuth(false);
    } finally {
      setIsLoadingPublicSettings(false);
    }
  }, [applySessionUser]);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    if (!supabase) return undefined;
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        applySessionUser(session.user);
      } else {
        setUser(null);
        setIsAuthenticated(false);
        setAuthChecked(true);
        setIsLoadingAuth(false);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [applySessionUser]);

  useEffect(() => {
    const onUrl = async ({ url }: { url: string }) => {
      try {
        const session = await completeOAuthFromUrl(url);
        if (session?.user) applySessionUser(session.user);
      } catch (e) {
        console.warn('OAuth URL handling failed', e);
      }
    };
    const sub = Linking.addEventListener('url', onUrl);
    return () => sub.remove();
  }, [applySessionUser]);

  const login = useCallback(async (email: string, password: string) => {
    await signInWithPassword(email, password);
    await getCurrentUser().then((u) => {
      setUser(u);
      setIsAuthenticated(true);
    });
    if (pendingActionRef.current) {
      const fn = pendingActionRef.current;
      pendingActionRef.current = null;
      fn();
    }
  }, []);

  const register = useCallback(async (email: string, password: string) => {
    await signUpWithPassword(email, password);
  }, []);

  const logout = useCallback(async () => {
    await signOut();
    setUser(null);
    setIsAuthenticated(false);
  }, []);

  const requireAuth = useCallback(
    (action?: () => void) => {
      if (isAuthenticated) {
        action?.();
        return true;
      }
      pendingActionRef.current = action ?? null;
      return false;
    },
    [isAuthenticated],
  );

  const value = useMemo(
    () => ({
      user,
      isAuthenticated,
      isLoadingAuth,
      isLoadingPublicSettings,
      authChecked,
      authError,
      login,
      register,
      logout,
      requireAuth,
    }),
    [
      user,
      isAuthenticated,
      isLoadingAuth,
      isLoadingPublicSettings,
      authChecked,
      authError,
      login,
      register,
      logout,
      requireAuth,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export { signInWithPassword, signUpWithPassword };
