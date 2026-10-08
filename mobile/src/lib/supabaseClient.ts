import { createClient, SupabaseClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { getPublicAppOrigin } from "./appOrigin";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "";

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

const TOKEN_KEY = "musicpromo.access_token";

/**
 * Supabase session blobs often exceed SecureStore size limits on Android.
 * Persist the full session in AsyncStorage (official RN approach) and mirror
 * the access token into SecureStore when it fits for dedicated token reads.
 */
const storage = {
  async getItem(key: string) {
    return AsyncStorage.getItem(key);
  },
  async setItem(key: string, value: string) {
    await AsyncStorage.setItem(key, value);
    try {
      const parsed = JSON.parse(value);
      const access = parsed?.access_token || parsed?.currentSession?.access_token;
      if (typeof access === "string" && access.length < 2000) {
        await SecureStore.setItemAsync(TOKEN_KEY, access);
      }
    } catch {
      /* session shape varies; AsyncStorage remains source of truth */
    }
  },
  async removeItem(key: string) {
    await AsyncStorage.removeItem(key);
    try {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    } catch {
      /* ignore */
    }
  },
};

export async function getMirroredAccessToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    return null;
  }
}

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        flowType: "pkce",
      },
    })
  : null;

export function requireSupabase() {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error("Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to sign in.");
  }
  return supabase;
}

/** Auth emails (confirm / reset) use the same public site as the web app. */
export const authRedirectOrigin = `${getPublicAppOrigin()}/`;
