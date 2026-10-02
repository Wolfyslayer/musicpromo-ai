import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import {
  clearGoogleSignInSession,
  getGoogleClientId,
  getGoogleSignInRedirectUri,
  GOOGLE_AUTH_STORAGE,
  readGoogleSignInReturnTo,
} from "@/lib/googleAuth";
import { messageFromFunctionInvokeError } from "@/lib/functionInvokeError";
import { upsertUserProfile, mapUser } from "@/lib/supabaseAuth";
function safeStoredPath(path) {
  if (!path || !path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return "/";
  return path;
}

export default function GoogleAuthCallback() {
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        if (!supabase) throw new Error("Supabase is not configured.");

        const url = new URL(window.location.href);
        const oauthError = url.searchParams.get("error_description") || url.searchParams.get("error");
        if (oauthError) {
          throw new Error(decodeURIComponent(oauthError.replace(/\+/g, " ")));
        }

        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const expectedState = sessionStorage.getItem(GOOGLE_AUTH_STORAGE.state);
        const verifier = sessionStorage.getItem(GOOGLE_AUTH_STORAGE.verifier);

        if (!code) throw new Error("Missing authorization code from Google.");
        if (!state || !expectedState || state !== expectedState) {
          throw new Error("Sign-in state mismatch. Try again.");
        }
        if (!verifier) throw new Error("Missing PKCE verifier. Try again.");

        const redirectUri = getGoogleSignInRedirectUri();
        const clientId = getGoogleClientId();
        const { data: fnData, error: fnError } = await supabase.functions.invoke("googleAuthExchange", {
          body: { code, codeVerifier: verifier, redirectUri, clientId },
        });
        if (fnError) throw new Error(await messageFromFunctionInvokeError(fnError));
        const idToken = fnData?.id_token;
        if (!idToken) throw new Error(fnData?.error || "Could not exchange Google sign-in code.");

        const { data, error: signInError } = await supabase.auth.signInWithIdToken({
          provider: "google",
          token: idToken,
        });
        if (signInError) throw signInError;

        const user = mapUser(data.user);
        if (user) await upsertUserProfile(user);

        const destination = safeStoredPath(readGoogleSignInReturnTo());
        clearGoogleSignInSession();

        if (!cancelled) {
          window.location.replace(destination);
        }
      } catch (err) {
        clearGoogleSignInSession();
        if (!cancelled) setError(err?.message || "Google sign-in failed.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-destructive">{error}</p>
        <Link to="/login" className="text-sm text-primary underline">
          Back to login
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">Finishing Google sign-in…</p>
    </div>
  );
}
