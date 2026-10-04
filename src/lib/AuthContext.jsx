import React, { createContext, useState, useContext, useEffect, useRef, useCallback } from "react";
import { toast } from "@/components/ui/use-toast";

import { arrivedFromOAuth, supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import { completeOAuthReturn, getCurrentUser, mapUser, upsertUserProfile } from "@/lib/supabaseAuth";
import {
  applyPendingSignupHandle,
  authSignupUserMetadata,
  stashPendingSignupHandle,
} from "@/services/signupHandle";

const AuthContext = createContext();

export const WORKSPACE_REFRESH_EVENT = "musicpromo:workspace-refresh";

export function useWorkspaceRefresh(reload) {
  useEffect(() => {
    if (typeof reload !== "function") return undefined;
    const onRefresh = () => reload();
    window.addEventListener(WORKSPACE_REFRESH_EVENT, onRefresh);
    return () => window.removeEventListener(WORKSPACE_REFRESH_EVENT, onRefresh);
  }, [reload]);
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [appPublicSettings, setAppPublicSettings] = useState(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [authPulse, setAuthPulse] = useState(false);
  const pendingActionRef = useRef(null);
  const closingForAuthRef = useRef(false);
  const isAuthenticatedRef = useRef(false);
  const welcomedRef = useRef(false);
  isAuthenticatedRef.current = isAuthenticated;

  const welcomeFromOAuth = useCallback(() => {
    if (!arrivedFromOAuth || welcomedRef.current) return;
    welcomedRef.current = true;
    toast({ title: "You're signed in" });
  }, []);

  const applySessionUser = useCallback((sessionUser) => {
    const mapped = mapUser(sessionUser);
    setUser(mapped);
    setIsAuthenticated(Boolean(mapped));
    setAuthChecked(true);
    setIsLoadingAuth(false);
    setAuthError(null);
    if (mapped) {
      window.setTimeout(() => {
        upsertUserProfile(mapped, sessionUser);
      }, 0);
    }
    return mapped;
  }, []);

  const checkUserAuth = useCallback(async () => {
    try {
      setIsLoadingAuth(true);
      const currentUser = await getCurrentUser();
      setUser(currentUser);
      setIsAuthenticated(true);
      setAuthError(null);
      await upsertUserProfile(currentUser);
    } catch (error) {
      setUser(null);
      setIsAuthenticated(false);
      if (error.status === 401 || error.status === 403) {
        setAuthError(null);
      }
    } finally {
      setIsLoadingAuth(false);
      setAuthChecked(true);
    }
  }, []);

  const checkAppState = useCallback(async () => {
    setIsLoadingPublicSettings(true);
    setAuthError(null);
    setAppPublicSettings({ id: "supabase", public_settings: {} });
    if (!isSupabaseConfigured || !supabase) {
      setUser(null);
      setIsAuthenticated(false);
      setIsLoadingAuth(false);
      setIsLoadingPublicSettings(false);
      setAuthChecked(true);
      return;
    }
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      if (data.session?.user) {
        applySessionUser(data.session.user);
        return;
      }
      const recovered = await completeOAuthReturn();
      applySessionUser(recovered?.user);
      if (recovered?.user) welcomeFromOAuth();
    } catch (error) {
      console.error("Session check failed:", error);
      const onGoogleAppCallback = window.location.pathname.endsWith("/auth/google/callback");
      if (arrivedFromOAuth && !onGoogleAppCallback) {
        toast({ title: "Google sign-in failed", description: error?.message || "Could not finish signing in." });
      }
      setUser(null);
      setIsAuthenticated(false);
      setAuthChecked(true);
      setIsLoadingAuth(false);
    } finally {
      setIsLoadingPublicSettings(false);
    }
  }, [applySessionUser, welcomeFromOAuth]);

  useEffect(() => {
    checkAppState();
    if (!supabase) return undefined;
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session?.user && event !== "SIGNED_OUT") return;
      applySessionUser(session?.user);
      setIsLoadingPublicSettings(false);
      if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && session?.user) {
        window.setTimeout(welcomeFromOAuth, 0);
      }
    });
    return () => data.subscription.unsubscribe();
  }, [applySessionUser, checkAppState, welcomeFromOAuth]);

  const logout = async (shouldRedirect = true) => {
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
      console.error("Sign out failed:", error);
    }
    if (shouldRedirect) window.location.assign("/");
  };

  const navigateToLogin = () => {
    setIsLoginModalOpen(true);
  };

  const requireAuth = useCallback((actionCallback) => {
    if (isAuthenticatedRef.current) {
      if (typeof actionCallback === "function") return actionCallback();
      return true;
    }
    pendingActionRef.current = typeof actionCallback === "function" ? actionCallback : null;
    setIsLoginModalOpen(true);
    return false;
  }, []);

  const onLoginModalOpenChange = useCallback((open) => {
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

  const signInWithPassword = useCallback(async (email, password) => {
    if (!supabase) throw new Error("Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to sign in.");
    const { data, error } = await supabase.auth.signInWithPassword({
      email: String(email || "").trim(),
      password,
    });
    if (error) throw new Error(error.message);
    const mapped = mapUser(data.user);
    if (mapped) await upsertUserProfile(mapped);
    return data;
  }, []);

  const signUp = useCallback(async (email, password, handle) => {
    if (!supabase) throw new Error("Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to sign in.");
    if (handle) stashPendingSignupHandle(handle);
    const { data, error } = await supabase.auth.signUp({
      email: String(email || "").trim(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: authSignupUserMetadata(handle),
      },
    });
    if (error) throw new Error(error.message);
    if (data.session) {
      const mapped = mapUser(data.user);
      if (mapped) {
        await upsertUserProfile(mapped, data.user);
        const claim = await applyPendingSignupHandle(mapped.id);
        if (!claim.ok) throw new Error(claim.error);
      }
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
    setAuthPulse(true);
    window.setTimeout(() => setAuthPulse(false), 900);
    toast({ title: "You're signed in" });
    window.setTimeout(() => {
      if (typeof action === "function") action();
      else window.dispatchEvent(new CustomEvent(WORKSPACE_REFRESH_EVENT));
    }, 480);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoadingAuth,
        isLoadingPublicSettings,
        authError,
        appPublicSettings,
        authChecked,
        logout,
        navigateToLogin,
        checkUserAuth,
        checkAppState,
        isLoginModalOpen,
        authPulse,
        requireAuth,
        onLoginModalOpenChange,
        finishLogin,
        signInWithPassword,
        signUp,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
