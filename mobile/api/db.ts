import { supabase } from '@/lib/supabaseClient';
import {
  getCurrentUser,
  requestPasswordReset,
  resendSignupOtp,
  signInWithPassword,
  signOut,
  signUpWithPassword,
  updatePassword,
  verifyEmailOtp,
} from '@/lib/supabaseAuth';
import { createEntityApi, resolveAssetUrl, uploadPromoAsset } from '@/services/supabaseStore';

export const db = {
  entities: createEntityApi(),
  auth: {
    me: () => getCurrentUser(),
    loginViaEmailPassword: (email: string, password: string) => signInWithPassword(email, password),
    register: (payload: { email?: string; password?: string }) =>
      signUpWithPassword(payload?.email ?? '', payload?.password ?? ''),
    verifyOtp: ({ email, otpCode }: { email: string; otpCode: string }) => verifyEmailOtp(email, otpCode),
    resendOtp: (email: string) => resendSignupOtp(email),
    loginWithProvider: async (provider: string, returnTo?: string) => {
      if (provider !== 'google') throw new Error('Only Google sign-in is connected.');
      const { startGoogleSignIn } = await import('@/lib/googleAuth');
      return startGoogleSignIn(returnTo || '/');
    },
    resetPasswordRequest: (email: string) => requestPasswordReset(email),
    resetPassword: ({ newPassword }: { newPassword: string }) => updatePassword(newPassword),
    setToken: () => {},
    logout: () => signOut(),
  },
  integrations: {
    Core: {
      UploadPublicFile: async ({ file }: { file: File | Blob }) => uploadPromoAsset(file, 'artwork'),
      UploadPrivateFile: async ({ file }: { file: File | Blob }) => uploadPromoAsset(file, 'audio'),
      CreateFileSignedUrl: async ({ file_uri }: { file_uri: string }) => ({
        signed_url: await resolveAssetUrl(file_uri),
      }),
    },
  },
  functions: {
    invoke: async (name: string, payload?: Record<string, unknown>) => {
      if (!supabase) {
        throw new Error('Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY before calling a function.');
      }
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      const invokeOptions: { body: Record<string, unknown>; headers?: { Authorization: string } } = {
        body: payload || {},
      };
      if (accessToken) {
        invokeOptions.headers = { Authorization: `Bearer ${accessToken}` };
      }
      const { data, error } = await supabase.functions.invoke(name, invokeOptions);
      if (error) {
        let message = error.message || 'Function failed';
        const err = new Error(message) as Error & { status?: number };
        err.status = error.status || 500;
        throw err;
      }
      return { data };
    },
  },
  app: {
    getPublicSettings: async () => ({ id: 'supabase', public_settings: {} }),
  },
};

export function ensureClientSessionToken() {
  return null;
}
