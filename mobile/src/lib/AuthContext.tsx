import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

import { toast } from '@/components/ui/use-toast';
import { isSupabaseConfigured, supabase } from '@/lib/supabaseClient';
import { getCurrentUser, mapUser, upsertUserProfile, type AppUser } from '@/lib/supabaseAuth';

const refreshListeners = new Set<() => void>();

export function emitWorkspaceRefresh() {
  refreshListeners.forEach((fn) => fn());
}

/** Re-run `reload` whenever the user signs in (or any screen asks the workspace to refresh). */
export function useWorkspaceRefresh(reload?: () => void) {
  useEffect(() => {
    if (typeof reload !== 'function') return undefined;
    refreshListeners.add(reload);
    return () => {
      refreshListeners.delete(reload);
    };
  }, [reload]);
}

type AuthValue = {
  user: AppUser | null;
  isAuthenticated: boolean;
  isLoadingAuth: boolean;
  authError: { type: string; message?: string } | null;
  authChecked: boolean;
  logout: () => Promise<void>;
  navigateToLogin: () => void;
  isLoginModalOpen: boolean;
  requireAuth: (action?: () => void) => boolean;
  onLoginModalOpenChange: (open: boolean) => void;
  finishLogin: () => Promise<void>;
  signInWithPassword: (email: string, password: string) => Promise<any>;
  signUp: (email: string, password: string) => Promise<any>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [authError, setAuthError] = useState<AuthValue['authError']>(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const pendingActionRef = useRef<(() => void) | null>(null);
  const closingForAuthRef = useRef(false);
  const isAuthenticatedRef = useRef(false);
  isAuthenticatedRef.current = isAuthenticated;

  const applySessionUser = useCallback((sessionUser: any) => {
    const mapped = mapUser(sessionUser);
    setUser(mapped);
    setIsAuthenticated(Boolean(mapped));
    setAuthChecked(true);
    setIsLoadingAuth(false);
    setAuthError(null);
    if (mapped) setTimeout(() => upsertUserProfile(mapped), 0);
    return mapped;
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setIsLoadingAuth(false);
      setAuthChecked(true);
      return undefined;
    }
    supabase.auth
      .getSession()
      .then(({ data }) => applySessionUser(data.session?.user))
      .catch((error) => {
        console.error('Session check failed:', error);
        applySessionUser(null);
      });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session?.user && event !== 'SIGNED_OUT') return;
      applySessionUser(session?.user);
    });
    return () => data.subscription.unsubscribe();
  }, [applySessionUser]);

  const logout = useCallback(async () => {
    pendingActionRef.current = null;
    setIsLoginModalOpen(false);
    setUser(null);
    setIsAuthenticated(false);
    try {
      if (supabase) {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
      }
    } catch (error) {
      console.error('Sign out failed:', error);
    }
  }, []);

  const requireAuth = useCallback((action?: () => void) => {
    if (isAuthenticatedRef.current) {
      if (typeof action === 'function') action();
      return true;
    }
    pendingActionRef.current = typeof action === 'function' ? action : null;
    setIsLoginModalOpen(true);
    return false;
  }, []);

  const onLoginModalOpenChange = useCallback((open: boolean) => {
    if (open) {
      setIsLoginModalOpen(true);
      return;
    }
    setIsLoginModalOpen(false);
    if (closingForAuthRef.current) {
      closingForAuthRef.current = false;
      return;
    }
    pendingActionRef.current = null;
  }, []);

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error('Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to sign in.');
    const { data, error } = await supabase.auth.signInWithPassword({ email: String(email || '').trim(), password });
    if (error) throw new Error(error.message);
    const mapped = mapUser(data.user);
    if (mapped) await upsertUserProfile(mapped);
    return data;
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error('Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to sign in.');
    const { data, error } = await supabase.auth.signUp({ email: String(email || '').trim(), password });
    if (error) throw new Error(error.message);
    if (data.session) {
      const mapped = mapUser(data.user);
      if (mapped) await upsertUserProfile(mapped);
    }
    return data;
  }, []);

  const finishLogin = useCallback(async () => {
    const currentUser = await getCurrentUser();
    const action = pendingActionRef.current;
    pendingActionRef.current = null;
    closingForAuthRef.current = true;
    setUser(currentUser);
    setIsAuthenticated(true);
    setAuthChecked(true);
    setAuthError(null);
    setIsLoadingAuth(false);
    setIsLoginModalOpen(false);
    toast({ title: "You're signed in" });
    setTimeout(() => {
      if (typeof action === 'function') action();
      else emitWorkspaceRefresh();
    }, 300);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoadingAuth,
        authError,
        authChecked,
        logout,
        navigateToLogin: () => setIsLoginModalOpen(true),
        isLoginModalOpen,
        requireAuth,
        onLoginModalOpenChange,
        finishLogin,
        signInWithPassword,
        signUp,
      }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
