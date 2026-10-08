import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import {
  getCurrentUser,
  requestPasswordReset,
  resendSignupOtp,
  signInWithPassword,
  signOut,
  signUpWithPassword,
  updatePassword,
  verifyEmailOtp,
} from "@/lib/supabaseAuth";
import { createEntityApi, resolveAssetUrl, uploadPromoAsset, UploadableFile } from "@/services/supabaseStore";

/**
 * Same gateway shape as web `src/api/base44Client.js`.
 */
export const db = {
  entities: createEntityApi(),
  auth: {
    me: () => getCurrentUser(),
    loginViaEmailPassword: (email: string, password: string) => signInWithPassword(email, password),
    register: (payload: { email?: string; password?: string; handle?: string }) =>
      signUpWithPassword(payload?.email || "", payload?.password || "", payload?.handle),
    verifyOtp: ({ email, otpCode }: { email: string; otpCode: string }) =>
      verifyEmailOtp(email, otpCode),
    resendOtp: (email: string) => resendSignupOtp(email),
    loginWithProvider: async (provider: string) => {
      if (provider !== "google") throw new Error("Only Google sign-in is connected.");
      const { signInWithGoogleNative } = await import("@/lib/googleAuth");
      return signInWithGoogleNative();
    },
    resetPasswordRequest: (email: string) => requestPasswordReset(email),
    resetPassword: ({ newPassword }: { newPassword: string }) => updatePassword(newPassword),
    setToken: () => {},
    logout: () => signOut(),
  },
  integrations: {
    Core: {
      UploadPublicFile: async ({ file }: { file: UploadableFile }) =>
        uploadPromoAsset(file, "artwork"),
      UploadPrivateFile: async ({ file }: { file: UploadableFile }) =>
        uploadPromoAsset(file, "audio"),
      CreateFileSignedUrl: async ({ file_uri }: { file_uri: string }) => ({
        signed_url: await resolveAssetUrl(file_uri),
      }),
    },
  },
  functions: {
    invoke: async (name: string, payload?: Record<string, unknown>) => {
      if (!supabase || !isSupabaseConfigured) {
        throw new Error(
          "Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY before calling a function."
        );
      }
      let { data: sessionData } = await supabase.auth.getSession();
      let accessToken = sessionData?.session?.access_token;
      if (!accessToken) {
        const refreshed = await supabase.auth.refreshSession().catch(() => ({ data: null as null }));
        accessToken = refreshed?.data?.session?.access_token || undefined;
      }

      const invokeOptions: { body: Record<string, unknown>; headers?: Record<string, string> } = {
        body: payload || {},
      };
      if (accessToken) {
        invokeOptions.headers = { Authorization: `Bearer ${accessToken}` };
      }

      const { data, error } = await supabase.functions.invoke(name, invokeOptions);
      if (error) {
        let message = error.message || "Function failed";
        const err = new Error(message) as Error & { status?: number; data?: unknown };
        err.status = 500;
        err.data = data;
        console.error(`[functions] ${name} failed:`, message, data);
        throw err;
      }
      return { data };
    },
  },
  app: {
    getPublicSettings: async () => ({ id: "supabase", public_settings: {} }),
  },
};

export default db;
