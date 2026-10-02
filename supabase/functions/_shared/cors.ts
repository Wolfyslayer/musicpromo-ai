/** Browser-facing Edge Functions (SPA calls via supabase.functions.invoke). */

export function corsHeaders(req: Request): HeadersInit {
  const origin = req.headers.get("Origin") || req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, accept, x-requested-with",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

export function jsonWithCors(req: Request, body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: corsHeaders(req) });
}

export function servePostApi(handler: (req: Request) => Promise<Response>): void {
  Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(req) });
    }
    if (req.method !== "POST") {
      return jsonWithCors(req, { error: "Method not allowed" }, 405);
    }
    return handler(req);
  });
}
