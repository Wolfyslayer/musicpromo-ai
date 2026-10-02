import { corsHeaders } from "../_shared/cors.ts";

const BUCKET = "music-promo-assets";

function supabaseOrigin(): string {
  const url = Deno.env.get("SUPABASE_URL") || "";
  try {
    return new URL(url).origin;
  } catch {
    return "";
  }
}

/** Allow only public objects from this project's promo bucket. */
function isAllowedPublicStorageUrl(target: URL, origin: string): boolean {
  if (!origin || target.origin !== origin) return false;
  const path = target.pathname;
  return (
    path.includes(`/storage/v1/object/public/${BUCKET}/`) ||
    path.includes(`/object/public/${BUCKET}/`)
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }
  if (req.method !== "GET" && req.method !== "HEAD") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders(req) });
  }

  try {
    const reqUrl = new URL(req.url);
    const raw = reqUrl.searchParams.get("url") || "";
    if (!raw) {
      return Response.json({ error: "url query parameter is required." }, {
        status: 400,
        headers: corsHeaders(req),
      });
    }

    const target = new URL(raw);
    const origin = supabaseOrigin();
    if (!isAllowedPublicStorageUrl(target, origin)) {
      return Response.json({ error: "URL is not an allowed public storage object." }, {
        status: 403,
        headers: corsHeaders(req),
      });
    }

    const upstream = await fetch(target.toString(), { method: req.method });
    if (!upstream.ok) {
      return new Response(upstream.body, {
        status: upstream.status,
        headers: {
          ...corsHeaders(req),
          "Content-Type": upstream.headers.get("Content-Type") || "application/octet-stream",
        },
      });
    }

    const headers = new Headers(corsHeaders(req));
    const ct = upstream.headers.get("Content-Type");
    if (ct) headers.set("Content-Type", ct);
    const cl = upstream.headers.get("Content-Length");
    if (cl) headers.set("Content-Length", cl);
    headers.set("Cache-Control", "public, max-age=3600");

    return new Response(req.method === "HEAD" ? null : upstream.body, {
      status: upstream.status,
      headers,
    });
  } catch (err) {
    console.error("[promoMediaProxy]", (err as Error)?.message || err);
    return Response.json({ error: "Proxy failed." }, { status: 502, headers: corsHeaders(req) });
  }
});
