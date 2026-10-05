import { supabase } from "@/lib/supabaseClient";
import { messageFromFunctionInvokeError } from "@/lib/functionInvokeError";

/** Stores PKCE server-side so Custom Tab / external callback can still finish sign-in. */
export async function registerGoogleOAuthPkce({ state, codeVerifier, returnTo }) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase.functions.invoke("registerGoogleOAuthPkce", {
    body: { state, codeVerifier, returnTo: returnTo || "/" },
  });
  if (error) throw new Error(await messageFromFunctionInvokeError(error));
  if (data?.error) throw new Error(data.error);
}
