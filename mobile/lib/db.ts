import {
  requestPasswordReset,
  resendSignupOtp,
  signInWithGoogle,
  signInWithPassword,
  signOut,
  signUpWithPassword,
  updatePassword,
  verifyEmailOtp,
} from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { createEntityApi, resolveAssetUrl, uploadPromoAsset } from "@/lib/store";
import type { Row, UploadFile } from "@/lib/types";

async function invoke(name: string, payload?: Row) {
  if (!supabase) {
    throw new Error("Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY before calling a function.");
  }
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData?.session?.access_token;
  const invokeOptions: { body: Row; headers?: Record<string, string> } = { body: payload || {} };
  if (accessToken) {
    invokeOptions.headers = { Authorization: `Bearer ${accessToken}` };
  }
  const { data, error } = await supabase.functions.invoke(name, invokeOptions);
  if (error) {
    let message = error.message || "Function failed";
    try {
      const context = (error as { context?: { json?: () => Promise<Row> } }).context;
      if (context && typeof context.json === "function") {
        const body = await context.json();
        message = body?.error || body?.message || message;
      }
    } catch {
      /* keep the client message */
    }
    throw new Error(message);
  }
  return { data };
}

export const db = {
  entities: createEntityApi(),
  auth: {
    loginViaEmailPassword: (email: string, password: string) => signInWithPassword(email, password),
    register: (payload: { email: string; password: string }) => signUpWithPassword(payload?.email, payload?.password),
    verifyOtp: ({ email, otpCode }: { email: string; otpCode: string }) => verifyEmailOtp(email, otpCode),
    resendOtp: (email: string) => resendSignupOtp(email),
    loginWithGoogle: () => signInWithGoogle(),
    resetPasswordRequest: (email: string) => requestPasswordReset(email),
    resetPassword: ({ newPassword }: { newPassword: string }) => updatePassword(newPassword),
    logout: () => signOut(),
  },
  integrations: {
    Core: {
      UploadPublicFile: async ({ file }: { file: UploadFile }) => uploadPromoAsset(file, "artwork"),
      UploadPrivateFile: async ({ file }: { file: UploadFile }) => uploadPromoAsset(file, "audio"),
      CreateFileSignedUrl: async ({ file_uri }: { file_uri: string }) => ({ signed_url: await resolveAssetUrl(file_uri) }),
    },
  },
  functions: { invoke },
};
