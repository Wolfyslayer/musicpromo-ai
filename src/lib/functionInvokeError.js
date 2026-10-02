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
  if (/non-2xx/i.test(message) && !context) {
    message =
      "Edge Function failed. Deploy googleAuthExchange and check Supabase function logs.";
  }
  return message;
}
