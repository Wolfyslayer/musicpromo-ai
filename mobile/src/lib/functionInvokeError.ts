/** Read JSON error body from supabase.functions.invoke failures. */
export async function messageFromFunctionInvokeError(err: {
  message?: string;
  context?: { json?: () => Promise<Record<string, unknown>> };
}) {
  let message = err?.message || "Function failed";
  const context = err?.context;
  let body: Record<string, unknown> | null = null;
  if (context && typeof context.json === "function") {
    try {
      body = await context.json();
      if (body?.error) message = String(body.error);
      else if (body?.message) message = String(body.message);
      const detail = body?.details ? String(body.details).trim() : "";
      if (detail && detail !== message) {
        message = `${message} (${detail})`;
      }
    } catch {
      /* keep default */
    }
  }
  if (/failed to send a request to the edge function/i.test(message)) {
    message =
      "Could not reach the Edge Function (not deployed, wrong Supabase project URL, or network). " +
      "Redeploy functions and confirm EXPO_PUBLIC_SUPABASE_URL matches Supabase → Settings → API.";
  } else if (/non-2xx/i.test(message) && !context) {
    message = "Edge Function failed. Deploy the function and check Supabase function logs.";
  }
  return message;
}
