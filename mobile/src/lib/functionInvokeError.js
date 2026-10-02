/** Read JSON error body from supabase.functions.invoke failures. */
export async function messageFromFunctionInvokeError(err) {
  let message = err?.message || "Function failed";
  const context = err?.context;
  if (context && typeof context.json === "function") {
    try {
      const body = await context.json();
      if (body?.error) message = body.error;
      else if (body?.message) message = body.message;
    } catch {
      /* keep default */
    }
  }
  if (/failed to send a request to the edge function/i.test(message)) {
    message =
      "Could not reach the Edge Function (often a CORS or deploy issue). Redeploy social functions " +
      "(connectSocialProvider, socialConnectionStatus) and confirm VITE_SUPABASE_URL matches your project.";
  } else if (/non-2xx/i.test(message) && !context) {
    message =
      "Edge Function failed. Deploy the function and check Supabase function logs.";
  }
  return message;
}
