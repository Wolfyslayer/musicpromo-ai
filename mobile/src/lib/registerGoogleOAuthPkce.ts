import { requireSupabase } from "./supabaseClient";
import { messageFromFunctionInvokeError } from "./functionInvokeError";

/** Same Edge Function as web — stores PKCE server-side for the callback. */
export async function registerGoogleOAuthPkce({
  state,
  codeVerifier,
  returnTo,
}: {
  state: string;
  codeVerifier: string;
  returnTo: string;
}) {
  const supabase = requireSupabase();
  const { data, error } = await supabase.functions.invoke("registerGoogleOAuthPkce", {
    body: { state, codeVerifier, returnTo: returnTo || "/" },
  });
  if (error) throw new Error(await messageFromFunctionInvokeError(error));
  if (data?.error) throw new Error(String(data.error));
}
