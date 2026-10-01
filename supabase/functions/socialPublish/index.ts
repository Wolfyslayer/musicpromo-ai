import { createClientFromRequest } from "../_shared/runtime.ts";
import { secrets } from "../_shared/runtime.ts";
import { publishSocialPostCore, safeSocialPost } from "../_shared/socialPublishCore.ts";

/** Allow SPA origins (local Vite + production) with credentialed POSTs. */
function corsHeaders(req: Request): HeadersInit {
  const origin = req.headers.get("Origin") || req.headers.get("origin") || "";
  const allowOrigin =
    origin &&
    (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin) ||
      origin.includes("base44.app") ||
      origin.includes("flying-sonic-promo-flow"))
      ? origin
      : origin || "*";

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept, X-Requested-With",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

function jsonResponse(
  req: Request,
  body: Record<string, unknown>,
  status = 200
): Response {
  return Response.json(body, { status, headers: corsHeaders(req) });
}

/**
 * Publish a SocialPost immediately (authenticated user).
 * Auto-scheduled publishing is handled by campaignWorker.
 */
async function handler (req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }

  if (req.method !== "POST") {
    return jsonResponse(req, { error: "Method not allowed.", code: "VALIDATION" }, 405);
  }

  try {
    const authHeader = req.headers.get("Authorization") || req.headers.get("authorization") || "";
    const hasBearer = /^Bearer\s+\S+/i.test(authHeader);
    console.log(
      "[socialPublish] auth_context",
      JSON.stringify({
        method: req.method,
        hasAuthorizationHeader: Boolean(authHeader),
        hasBearer,
        origin: req.headers.get("Origin") || null,
      })
    );

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) {
      return jsonResponse(
        req,
        {
          error: "Unauthorized. Sign in again, then retry publish.",
          code: "UNAUTHORIZED",
        },
        401
      );
    }

    const body = await req.json().catch(() => ({}));
    const postId = body?.postId ? String(body.postId) : "";
    if (!postId) {
      return jsonResponse(req, { error: "postId is required." }, 400);
    }

    const encryptionKey = secrets.get("SOCIAL_TOKEN_ENCRYPTION_KEY");
    if (!encryptionKey) {
      return jsonResponse(
        req,
        { error: "Publishing is not configured.", code: "NOT_CONFIGURED" },
        503
      );
    }

    const post = await base44.asServiceRole.entities.SocialPost.get(postId);
    if (!post || post.user_id !== user.id) {
      return jsonResponse(req, { error: "Post not found." }, 404);
    }

    const result = await publishSocialPostCore({
      base44,
      postId,
      encryptionKey,
      allowScheduled: true,
    });

    if (!result.ok) {
      return jsonResponse(
        req,
        {
          error: result.message,
          code: result.code,
          ok: false,
          post: result.post,
          needsReauth: result.needsReauth || false,
        },
        result.status
      );
    }

    return jsonResponse(req, {
      ok: true,
      post: result.post,
      note: result.note,
      mediaPreparation: result.mediaPreparation || null,
    });
  } catch (error) {
    console.error("[socialPublish]", (error as Error)?.message || error);
    return jsonResponse(
      req,
      { error: "Publish failed.", code: "PUBLISH_FAILED", ok: false },
      502
    );
  }
}

// Re-export for tests / debugging
export { safeSocialPost };


Deno.serve(handler);
