import { supabase } from "@/lib/supabaseClient";
import {
  getCurrentUser,
  requestPasswordReset,
  resendSignupOtp,
  signInWithGoogle,
  signInWithPassword,
  signOut,
  signUpWithPassword,
  updatePassword,
  verifyEmailOtp,
} from "@/lib/supabaseAuth";
import { createEntityApi, resolveAssetUrl, uploadPromoAsset } from "@/services/supabaseStore";

/**
 * Supabase gateway with the same shape as the web app's `db` export,
 * so services and screens port over unchanged.
 */
export const db = {
  entities: createEntityApi(),
  auth: {
    me: () => getCurrentUser(),
    loginViaEmailPassword: (email, password) => signInWithPassword(email, password),
    register: (payload) => signUpWithPassword(payload?.email, payload?.password),
    verifyOtp: ({ email, otpCode }) => verifyEmailOtp(email, otpCode),
    resendOtp: (email) => resendSignupOtp(email),
    loginWithProvider: (provider) => {
      if (provider !== "google") throw new Error("Only Google sign-in is connected.");
      return signInWithGoogle();
    },
    resetPasswordRequest: (email) => requestPasswordReset(email),
    resetPassword: ({ newPassword }) => updatePassword(newPassword),
    logout: () => signOut(),
  },
  integrations: {
    Core: {
      UploadPublicFile: async ({ file }) => uploadPromoAsset(file, "artwork"),
      UploadPrivateFile: async ({ file }) => uploadPromoAsset(file, "audio"),
      CreateFileSignedUrl: async ({ file_uri }) => ({ signed_url: await resolveAssetUrl(file_uri) }),
    },
  },
  functions: {
    invoke: async (name, payload) => {
      if (!supabase) {
        throw new Error("Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY before calling a function.");
      }
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      const invokeOptions = { body: payload || {} };
      if (accessToken) {
        invokeOptions.headers = { Authorization: `Bearer ${accessToken}` };
      }

      const { data, error } = await supabase.functions.invoke(name, invokeOptions);
      if (error) {
        let message = error.message || "Function failed";
        try {
          const context = error.context;
          if (context && typeof context.json === "function") {
            const body = await context.json();
            message = body?.error || body?.message || message;
          }
        } catch {
          /* keep the client message */
        }
        const err = new Error(message);
        err.status = error.status || 500;
        throw err;
      }
      return { data };
    },
  },
};

export default db;
