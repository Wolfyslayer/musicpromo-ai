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
 * Supabase gateway. Pages still import `db` so the studio screens stay put.
 * Every entity call runs supabase.from(...) inside the store, and every
 * file call uploads into the public music-promo-assets bucket.
 */
export const db = {
  entities: createEntityApi(),
  auth: {
    me: () => getCurrentUser(),
    loginViaEmailPassword: (email, password) => signInWithPassword(email, password),
    register: (payload) =>
      signUpWithPassword(payload?.email, payload?.password, { handle: payload?.handle }),
    verifyOtp: ({ email, otpCode }) => verifyEmailOtp(email, otpCode),
    resendOtp: (email) => resendSignupOtp(email),
    loginWithProvider: (provider, returnTo) => {
      if (provider !== "google") throw new Error("Only Google sign-in is connected.");
      return signInWithGoogle(returnTo);
    },
    resetPasswordRequest: (email) => requestPasswordReset(email),
    resetPassword: ({ newPassword }) => updatePassword(newPassword),
    setToken: () => {},
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
        throw new Error("Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY before calling a function.");
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
        let body = data && typeof data === "object" ? data : null;
        if (/failed to send a request to the edge function/i.test(message)) {
          const fnHint =
            name === "submitSupportTicket" || name === "supportChat"
              ? "Deploy submitSupportTicket (and supportChat if using AI) via GitHub Actions → Deploy → Run workflow, or: supabase functions deploy submitSupportTicket. Run support_tickets SQL from supabase/schema.sql."
              : "Redeploy the Edge Function and confirm VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY match your Supabase project (Settings → API).";
          message = `Could not reach Edge Function “${name}”. ${fnHint}`;
        }
        try {
          const context = error.context;
          if (context && typeof context.json === "function") {
            const parsed = await context.json();
            body = parsed && typeof parsed === "object" ? parsed : body;
            message = body?.error || body?.message || message;
          }
        } catch {
          /* keep the client message */
        }
        const err = new Error(message);
        err.status =
          error.status ||
          (body?.code === "INSUFFICIENT_CREDITS" ? 402 : body?.code === "PREMIUM_REQUIRED" ? 403 : 500);
        err.data = body;
        throw err;
      }
      return { data };
    },
  },
  app: {
    getPublicSettings: async () => ({ id: "supabase", public_settings: {} }),
  },
};

export function ensureClientSessionToken() {
  return null;
}

export default db;
