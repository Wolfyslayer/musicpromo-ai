import { serveWithCors } from "../_shared/cors.ts";
import { createClientFromRequest } from "../_shared/runtime.ts";
import { secrets } from "../_shared/runtime.ts";
import { generateOAuthState } from "../_shared/socialCrypto.ts";
import {
  buildInstagramAuthorizeUrl,
  INSTAGRAM_CONNECT_SCOPES,
  META_OAUTH_REDIRECT_URI,
} from "../_shared/instagramOAuth.ts";
import {
  buildTikTokAuthorizeUrl,
  TIKTOK_CONNECT_SCOPES,
  TIKTOK_OAUTH_REDIRECT_URI,
} from "../_shared/tiktokOAuth.ts";
import {
  buildYouTubeAuthorizeUrl,
  readGoogleClientIdFromInvokeBody,
  youTubeAppRedirectUri,
  YOUTUBE_CONNECT_SCOPES,
  YOUTUBE_OAUTH_REDIRECT_URI,
} from "../_shared/youtubeOAuth.ts";

const SUPPORTED = new Set(["instagram", "tiktok", "youtube"]);
const STATE_TTL_MS = 10 * 60 * 1000;

const PROVIDER_ALIASES: Record<string, string> = {
  instagram: "instagram",
  ig: "instagram",
  meta: "instagram",
  tiktok: "tiktok",
  tt: "tiktok",
  youtube: "youtube",
  yt: "youtube",
  google: "youtube",
};

function hasSecret(...names: string[]): boolean {
  for (const name of names) {
    try {
      const v = secrets.get(name);
      if (typeof v === "string" ? v.trim().length > 0 : Boolean(v)) return true;
    } catch {
      /* ignore */
    }
  }
  return false;
}

function secretValue(...names: string[]): string {
  for (const name of names) {
    try {
      const v = secrets.get(name);
      if (typeof v === "string" && v.trim()) return v.trim();
      if (v && typeof v !== "string") return String(v);
    } catch {
      /* ignore */
    }
  }
  return "";
}

function normalizeProvider(raw: unknown): string {
  if (raw == null) return "";
  if (typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    return normalizeProvider(obj.id ?? obj.provider ?? obj.name ?? "");
  }
  const key = String(raw).trim().toLowerCase();
  if (!key) return "";
  return PROVIDER_ALIASES[key] || key;
}

/** Collect likely provider fields from nested SDK / gateway payloads. */
function resolveProvider(body: Record<string, unknown>, req: Request): string {
  const nested = [
    body,
    body?.args,
    body?.data,
    body?.payload,
    body?.params,
    body?.input,
    typeof body?.body === "object" && body.body ? body.body : null,
  ].filter(Boolean) as Record<string, unknown>[];

  const candidates: unknown[] = [];
  for (const obj of nested) {
    candidates.push(obj.provider, obj.platform, obj.network, obj.providerId);
  }
  try {
    candidates.push(new URL(req.url).searchParams.get("provider"));
  } catch {
    /* ignore */
  }

  for (const c of candidates) {
    const p = normalizeProvider(c);
    if (p) return p;
  }

  // Last resort: scan top-level string values for a known provider name.
  for (const obj of nested) {
    for (const v of Object.values(obj)) {
      if (typeof v === "string") {
        const p = normalizeProvider(v);
        if (SUPPORTED.has(p)) return p;
      }
    }
  }
  return "";
}

/**
 * Authenticated OAuth start for Instagram / TikTok / YouTube.
 * Always redirects to /functions/metaCustomCallback (custom engine, no Base44 social proxy).
 */
async function handler (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    // Prefer body, then query string (frontend also passes ?provider= for reliability).
    let provider = resolveProvider(body, req);
    if (!provider) {
      try {
        provider = normalizeProvider(new URL(req.url).searchParams.get("provider"));
      } catch {
        /* ignore */
      }
    }
    console.log(
      "[connectSocialProvider] invoke",
      JSON.stringify({
        userId: user.id,
        provider,
        method: req.method,
        url: req.url,
        bodyKeys: Object.keys(body || {}),
        bodyPreview: JSON.stringify(body).slice(0, 400),
        hasForceReauth: body?.forceReauth != null,
      })
    );

    if (!provider) {
      return Response.json(
        {
          error: "provider is required (instagram, tiktok, or youtube).",
          code: "VALIDATION",
          supported: [...SUPPORTED],
          bodyKeys: Object.keys(body || {}),
        },
        { status: 400 }
      );
    }
    if (!SUPPORTED.has(provider)) {
      return Response.json(
        {
          error: `Provider "${provider}" is not available for connection yet.`,
          code: "VALIDATION",
          provider,
          supported: [...SUPPORTED],
        },
        { status: 400 }
      );
    }

    const encryptionKey = secretValue("SOCIAL_TOKEN_ENCRYPTION_KEY");
    const publicAppUrl = secretValue("PUBLIC_APP_URL", "APP_PUBLIC_URL");
    if (!encryptionKey || !publicAppUrl) {
      return Response.json(
        {
          error:
            "Social connection is not configured. Add SOCIAL_TOKEN_ENCRYPTION_KEY and PUBLIC_APP_URL.",
          code: "not_configured",
          missing: {
            SOCIAL_TOKEN_ENCRYPTION_KEY: !encryptionKey,
            PUBLIC_APP_URL: !publicAppUrl,
          },
        },
        { status: 503 }
      );
    }

    const publicAppBase = publicAppUrl.replace(/\/$/, "");
    const youtubeClientId =
      provider === "youtube"
        ? readGoogleClientIdFromInvokeBody(body) ||
          secretValue("GOOGLE_CLIENT_ID", "YOUTUBE_CLIENT_ID")
        : "";
    const youtubeRedirectUri =
      provider === "youtube" ? youTubeAppRedirectUri(publicAppBase) : "";

    const state = generateOAuthState();
    const expiresAt = new Date(Date.now() + STATE_TTL_MS).toISOString();
    const artistId = body?.artistId ? String(body.artistId).trim() : "";
    await base44.asServiceRole.entities.SocialOAuthState.create({
      state,
      user_id: user.id,
      artist_id: artistId,
      provider,
      expires_at: expiresAt,
      used: false,
      ...(youtubeClientId ? { oauth_client_id: youtubeClientId } : {}),
      ...(youtubeRedirectUri ? { oauth_redirect_uri: youtubeRedirectUri } : {}),
    });

    let authorizationUrl = "";
    let scopes: string[] = [];
    const forceReauth = Boolean(
      body?.forceReauth ??
        (body?.args as Record<string, unknown> | undefined)?.forceReauth ??
        true
    );

    if (provider === "instagram") {
      const clientId = secretValue("META_CLIENT_ID");
      const clientSecret = secretValue("META_CLIENT_SECRET");
      if (!clientId || !clientSecret) {
        return Response.json(
          {
            error: "Instagram is not configured (META_CLIENT_ID / META_CLIENT_SECRET).",
            code: "not_configured",
          },
          { status: 503 }
        );
      }
      scopes = [...INSTAGRAM_CONNECT_SCOPES];
      authorizationUrl = buildInstagramAuthorizeUrl({
        clientId,
        redirectUri: META_OAUTH_REDIRECT_URI,
        state,
        scopes,
        forceReauth,
      });
    } else if (provider === "tiktok") {
      const clientKey = secretValue("TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_ID");
      const clientSecret = secretValue("TIKTOK_CLIENT_SECRET");
      if (!clientKey || !clientSecret) {
        return Response.json(
          {
            error: "TikTok is not configured (TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET).",
            code: "not_configured",
            missing: {
              TIKTOK_CLIENT_KEY: !hasSecret("TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_ID"),
              TIKTOK_CLIENT_SECRET: !hasSecret("TIKTOK_CLIENT_SECRET"),
            },
          },
          { status: 503 }
        );
      }
      scopes = [...TIKTOK_CONNECT_SCOPES];
      authorizationUrl = buildTikTokAuthorizeUrl({
        clientKey,
        state,
        scopes,
        redirectUri: TIKTOK_OAUTH_REDIRECT_URI,
      });
    } else if (provider === "youtube") {
      const clientId = youtubeClientId;
      const clientSecret = secretValue(
        "GOOGLE_LOGIN_CLIENT_SECRET",
        "GOOGLE_CLIENT_SECRET",
        "YOUTUBE_CLIENT_SECRET"
      );
      if (!clientId || !clientSecret) {
        return Response.json(
          {
            error:
              "YouTube is not configured. Use the same Web client as Google login: set GOOGLE_CLIENT_SECRET (or GOOGLE_LOGIN_CLIENT_SECRET) in Supabase, ensure VITE_GOOGLE_CLIENT_ID is in the app build, and add the YouTube redirect URI in Google Cloud.",
            code: "not_configured",
            missing: {
              googleClientId:
                !readGoogleClientIdFromInvokeBody(body) &&
                !hasSecret("GOOGLE_CLIENT_ID", "YOUTUBE_CLIENT_ID"),
              GOOGLE_CLIENT_SECRET: !hasSecret(
                "GOOGLE_LOGIN_CLIENT_SECRET",
                "GOOGLE_CLIENT_SECRET",
                "YOUTUBE_CLIENT_SECRET"
              ),
            },
          },
          { status: 503 }
        );
      }
      scopes = [...YOUTUBE_CONNECT_SCOPES];
      authorizationUrl = buildYouTubeAuthorizeUrl({
        clientId,
        state,
        scopes,
        redirectUri: youtubeRedirectUri,
        forceConsent: forceReauth,
      });
    }

    if (!authorizationUrl) {
      return Response.json(
        { error: "Could not build authorization URL.", code: "VALIDATION", provider },
        { status: 500 }
      );
    }

    return Response.json({
      ok: true,
      authorizationUrl,
      provider,
      scopes,
      redirectUri:
        provider === "instagram"
          ? META_OAUTH_REDIRECT_URI
          : provider === "tiktok"
            ? TIKTOK_OAUTH_REDIRECT_URI
            : youtubeRedirectUri || YOUTUBE_OAUTH_REDIRECT_URI,
      forceReauth,
      engine: "connectSocialProvider",
    });
  } catch (error) {
    console.error("[connectSocialProvider]", (error as Error)?.message || error);
    return Response.json(
      {
        error: "Could not start connection.",
        code: "OAUTH_START_FAILED",
        engine: "connectSocialProvider",
        details: String((error as Error)?.message || error).slice(0, 300),
      },
      { status: 500 }
    );
  }
}


serveWithCors(handler);
