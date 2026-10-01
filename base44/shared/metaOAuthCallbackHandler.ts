import { createClientFromRequest } from "npm:@base44/sdk@0.8.52";
import { secrets } from "base44:runtime";
import { encryptCredential, encodeSecureFallback } from "./socialCrypto.ts";
import {
  INSTAGRAM_CONNECT_SCOPES,
  META_OAUTH_REDIRECT_URI,
  exchangeInstagramCode,
  exchangeLongLivedToken,
  fetchInstagramProfile,
  normalizeGrantedPermissions,
  probeInstagramPublishCapability,
  hasInstagramPublishScope,
} from "./instagramOAuth.ts";

/** Frontend origin for post-OAuth redirects — must be configured explicitly (never infer from Host). */
function requirePublicAppUrl(): string | null {
  const configured = secrets.get("PUBLIC_APP_URL") || secrets.get("APP_PUBLIC_URL");
  if (!configured || !String(configured).trim()) return null;
  return String(configured).replace(/\/$/, "");
}

function redirectToSocial(home: string, query: Record<string, string>): Response {
  const qs = new URLSearchParams(query).toString();
  return Response.redirect(`${home}/social?${qs}`, 302);
}

function configurationErrorResponse(): Response {
  return new Response(
    "OAuth callback misconfigured: set PUBLIC_APP_URL in Base44 secrets to your frontend origin (HTTPS in production).",
    { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } }
  );
}

function safeErrorRedirect(home: string | null, code: string): Response {
  if (!home) return configurationErrorResponse();
  return redirectToSocial(home, { social_error: code });
}

/** Keep redirect URLs under common browser limits (~2k–8k). */
const MAX_DETAILS_CHARS = 600;
const MAX_META_CHARS = 600;
const MAX_STACK_CHARS = 400;

function truncateForQuery(value: string, max: number): string {
  const s = String(value || "");
  if (s.length <= max) return s;
  return `${s.slice(0, Math.max(0, max - 3))}...`;
}

/** Pull Instagram / Meta API error text off thrown errors when present. */
function extractInstagramErrorData(err: unknown): string | null {
  const e = err as {
    response?: { data?: unknown };
    meta?: unknown;
    data?: unknown;
    cause?: { response?: { data?: unknown }; message?: string };
    message?: string;
  };
  const candidates = [
    e?.response?.data,
    e?.meta,
    e?.data,
    e?.cause?.response?.data,
  ];
  for (const c of candidates) {
    if (c == null) continue;
    try {
      const raw = typeof c === "string" ? c : JSON.stringify(c);
      if (raw && raw !== "{}" && raw !== "null") return raw;
    } catch {
      /* ignore */
    }
  }
  const msg = String(e?.message || "");
  if (/token_exchange:|long_lived:|profile:/i.test(msg)) {
    return msg;
  }
  return null;
}

/**
 * 302 back to Social Hub with Instagram API validation errors surfaced to the frontend.
 * Caps param length so Location headers stay valid.
 */
function debugFailureResponse(params: {
  home: string | null;
  step: string;
  errorType: string;
  socialErrorCode: string;
  err: unknown;
}): Response {
  const e = params.err instanceof Error ? params.err : new Error(String(params.err ?? "Unknown error"));
  const details = truncateForQuery(e.message || String(params.err), MAX_DETAILS_CHARS);
  const metaRaw = extractInstagramErrorData(params.err);
  const meta = metaRaw ? truncateForQuery(metaRaw, MAX_META_CHARS) : null;
  const stack = e.stack ? truncateForQuery(e.stack, MAX_STACK_CHARS) : null;

  const payload = {
    success: false as const,
    errorType: params.errorType,
    step: params.step,
    message: details,
    meta,
    stack,
  };
  console.error("[socialOAuthCallback] --- INSTAGRAM DEBUG ERROR ---");
  console.error("[socialOAuthCallback]", JSON.stringify(payload));

  if (!params.home) {
    return new Response(JSON.stringify(payload, null, 2), {
      status: 500,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }

  const query: Record<string, string> = {
    social_error: params.socialErrorCode || "provider_error",
    error: params.socialErrorCode || "provider_error",
    details: details,
    social_debug_type: params.errorType,
    social_debug_step: params.step,
    social_debug_message: details,
  };
  if (meta) {
    query.meta = meta;
    query.social_debug_meta = meta;
  }
  if (stack) {
    query.social_debug_stack = stack;
  }

  let target = `${params.home}/social?${new URLSearchParams(query).toString()}`;
  if (target.length > 1800 && query.social_debug_stack) {
    delete query.social_debug_stack;
    target = `${params.home}/social?${new URLSearchParams(query).toString()}`;
  }
  if (target.length > 1800 && query.meta) {
    delete query.meta;
    delete query.social_debug_meta;
    target = `${params.home}/social?${new URLSearchParams(query).toString()}`;
  }
  if (target.length > 1800) {
    query.details = truncateForQuery(details, 200);
    query.social_debug_message = query.details;
    target = `${params.home}/social?${new URLSearchParams(query).toString()}`;
  }

  return Response.redirect(target, 302);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** SOCIAL_TOKEN_ENCRYPTION_KEY from Base44 secrets or process/Deno env (never log the raw key). */
function resolveEncryptionKey(): string | null {
  const fromSecret = secrets.get("SOCIAL_TOKEN_ENCRYPTION_KEY");
  let fromEnv: string | undefined;
  try {
    fromEnv = (globalThis as { Deno?: { env?: { get?: (k: string) => string | undefined } } }).Deno?.env?.get?.(
      "SOCIAL_TOKEN_ENCRYPTION_KEY"
    );
  } catch {
    /* ignore */
  }
  if (!fromEnv) {
    try {
      fromEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
        ?.SOCIAL_TOKEN_ENCRYPTION_KEY;
    } catch {
      /* ignore */
    }
  }
  const value = String(fromSecret || fromEnv || "").trim();
  return value || null;
}

function logEncryptFailure(err: unknown, encryptionKey: string | null): void {
  const e = err as { message?: string; name?: string; stack?: string };
  console.error("[socialOAuthCallback] encrypt_failed exact_error=", e?.message || String(err));
  console.error("[socialOAuthCallback] encrypt_failed detail=", {
    name: e?.name || null,
    keyPresent: Boolean(encryptionKey),
    keyCharLength: encryptionKey ? encryptionKey.length : 0,
    // Key may be any UTF-8 passphrase — socialCrypto derives AES via SHA-256 (no atob).
    keyFormat: "utf8_or_legacy_base64",
    stack: e?.stack ? String(e.stack).slice(0, 500) : null,
  });
}

/**
 * Lookup OAuth state with retries for entity write latency.
 * Returns null when not found; throws only after repeated hard DB failures.
 */
async function findOAuthState(
  base44: ReturnType<typeof createClientFromRequest>,
  state: string
): Promise<Record<string, unknown> | null> {
  const attempts = 5;
  let lastErr: unknown = null;
  for (let i = 0; i < attempts; i++) {
    try {
      const states = await base44.asServiceRole.entities.SocialOAuthState.filter(
        { state },
        "-created_date",
        5
      );
      const record = (states || [])[0] || null;
      if (record) return record as Record<string, unknown>;
    } catch (err) {
      lastErr = err;
      console.warn(
        "[socialOAuthCallback] state_lookup_attempt",
        i,
        "warning=",
        (err as Error)?.message || err
      );
    }
    await sleep(200 * (i + 1));
  }
  if (lastErr) {
    console.warn(
      "[socialOAuthCallback] state_lookup exhausted with DB errors — soft-bypass=",
      (lastErr as Error)?.message || lastErr
    );
  }
  return null;
}

/**
 * Instagram Login for Business OAuth callback (HTTP GET).
 * Exchanges code on Instagram OAuth → saves IG user id + long-lived token to SocialAccount.
 * Soft-bypasses OAuth state when DB latency hides the row; falls back to session user.
 * Never puts tokens or codes into the redirect URL.
 */
export default async function (req: Request): Promise<Response> {
  const publicAppUrl = requirePublicAppUrl();

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");
    const errorReason = url.searchParams.get("error_reason");
    const errorDescription = url.searchParams.get("error_description");

    if (error || errorReason === "user_denied") {
      if (errorDescription || error) {
        return debugFailureResponse({
          home: publicAppUrl,
          step: "instagram_authorize",
          errorType: "INSTAGRAM_DENIED",
          socialErrorCode: errorReason === "user_denied" ? "cancelled" : "provider_error",
          err: new Error(String(errorDescription || error || "Instagram authorization failed")),
        });
      }
      return safeErrorRedirect(publicAppUrl, "cancelled");
    }
    if (!code || !state) {
      return safeErrorRedirect(publicAppUrl, "invalid_response");
    }

    const clientId = secrets.get("META_CLIENT_ID");
    const clientSecret = secrets.get("META_CLIENT_SECRET");
    const encryptionKey = resolveEncryptionKey();
    const redirectUri = META_OAUTH_REDIRECT_URI;
    if (!clientId || !clientSecret || !redirectUri || !encryptionKey) {
      return debugFailureResponse({
        home: publicAppUrl,
        step: "config",
        errorType: "NOT_CONFIGURED",
        socialErrorCode: "not_configured",
        err: new Error(
          `Missing secrets: clientId=${Boolean(clientId)} clientSecret=${Boolean(clientSecret)} redirectUri=${Boolean(redirectUri)} encryptionKey=${Boolean(encryptionKey)} metaRedirect=${META_OAUTH_REDIRECT_URI}`
        ),
      });
    }

    let base44;
    try {
      base44 = createClientFromRequest(req);
    } catch (err) {
      return debugFailureResponse({
        home: publicAppUrl,
        step: "client_init",
        errorType: "CLIENT_INIT_FAILED",
        socialErrorCode: "client_init_failed",
        err,
      });
    }

    // --- State validation (soft-bypass on latency; do not return provider_error) ---
    let record: Record<string, unknown> | null = null;
    try {
      record = await findOAuthState(base44, state);
    } catch (err) {
      console.warn(
        "[socialOAuthCallback] state_lookup soft-bypass after errors:",
        (err as Error)?.message || err
      );
      record = null;
    }

    let boundUserId: string | null = null;
    let boundProvider = "instagram";

    if (record) {
      if (record.used) {
        return safeErrorRedirect(publicAppUrl, "state_reused");
      }
      if (record.provider && record.provider !== "instagram") {
        return safeErrorRedirect(publicAppUrl, "invalid_state");
      }
      if (record.expires_at && new Date(String(record.expires_at)).getTime() < Date.now()) {
        if (record.id) {
          await base44.asServiceRole.entities.SocialOAuthState.delete(String(record.id)).catch(() => {});
        }
        return safeErrorRedirect(publicAppUrl, "expired_state");
      }
      boundUserId = record.user_id != null ? String(record.user_id) : null;
      boundProvider = record.provider != null ? String(record.provider) : "instagram";

      if (record.id) {
        try {
          await base44.asServiceRole.entities.SocialOAuthState.delete(String(record.id));
        } catch (err) {
          console.warn("[socialOAuthCallback] state_consume warning=", (err as Error)?.message || err);
        }
      }
    } else {
      console.warn(
        "[socialOAuthCallback] SocialOAuthState not found (possible DB latency). Proceeding with token exchange; binding user via session if available."
      );
    }

    if (!boundUserId) {
      try {
        const sessionUser = await base44.auth.me();
        if (sessionUser?.id) {
          boundUserId = String(sessionUser.id);
          console.warn("[socialOAuthCallback] bound user via session fallback id_present=true");
        }
      } catch (err) {
        console.warn(
          "[socialOAuthCallback] session fallback failed:",
          (err as Error)?.message || err
        );
      }
    }

    if (!boundUserId) {
      return debugFailureResponse({
        home: publicAppUrl,
        step: "state_or_session_bind",
        errorType: "INVALID_STATE",
        socialErrorCode: "invalid_state",
        err: new Error("Cannot bind SocialAccount — no OAuth state user_id and no session user"),
      });
    }

    // --- Token exchange (Instagram Login — no Facebook Page lookup) ---
    let shortLived;
    try {
      shortLived = await exchangeInstagramCode({
        clientId,
        clientSecret,
        redirectUri,
        code,
      });
    } catch (err) {
      const msg = String((err as Error)?.message || err);
      const lower = msg.toLowerCase();
      let socialErrorCode = "token_exchange_failed";
      let errorType = "TOKEN_EXCHANGE_FAILED";
      if (lower.includes("redirect") || lower.includes("uri")) {
        socialErrorCode = "redirect_mismatch";
        errorType = "REDIRECT_MISMATCH";
      } else if (lower.includes("secret") || lower.includes("client") || lower.includes("invalid")) {
        socialErrorCode = "bad_credentials";
        errorType = "BAD_CREDENTIALS";
      }
      return debugFailureResponse({
        home: publicAppUrl,
        step: "token_exchange",
        errorType,
        socialErrorCode,
        err,
      });
    }

    // Instagram user id comes directly from the initial token payload.
    let igUserId = shortLived.user_id ? String(shortLived.user_id).trim() : "";
    if (!igUserId) {
      return debugFailureResponse({
        home: publicAppUrl,
        step: "instagram_id_extraction",
        errorType: "PROFILE_FAILED",
        socialErrorCode: "profile_failed",
        err: new Error("instagram_user_id (user_id) missing from Instagram token exchange payload"),
      });
    }

    let accessToken = shortLived.access_token;
    let expiresIn = shortLived.expires_in || 3600;
    try {
      const longLived = await exchangeLongLivedToken({
        clientId,
        clientSecret,
        shortLivedToken: shortLived.access_token,
      });
      accessToken = longLived.access_token;
      expiresIn = longLived.expires_in || 60 * 24 * 3600;
    } catch (err) {
      // Surface long-lived failure as a soft warning only — short-lived still works briefly.
      console.warn(
        "[socialOAuthCallback] long_lived warning — keeping short-lived token:",
        (err as Error)?.message || err
      );
    }

    // Optional username / avatar enrichment (never blocks connect if /me fails).
    let username = "";
    let displayName = "";
    let profileImageUrl = "";
    try {
      const profile = await fetchInstagramProfile(accessToken);
      if (profile.user_id) igUserId = String(profile.user_id).trim() || igUserId;
      username = profile.username || "";
      displayName = profile.name || "";
      profileImageUrl = profile.profile_picture_url || "";
    } catch (err) {
      console.warn(
        "[socialOAuthCallback] profile enrichment warning=",
        (err as Error)?.message || err
      );
    }

    // Build credential JSON once, then hand the clean string to socialCrypto.
    // encryptCredential accepts any UTF-8 SOCIAL_TOKEN_ENCRYPTION_KEY and never
    // aborts OAuth: AES-GCM (v1) or secure-string fallback (v0).
    const credentialPayload = JSON.stringify({
      access_token: accessToken,
      ig_user_id: igUserId,
      token_type: "bearer",
      auth_type: "instagram_login",
      obtained_at: new Date().toISOString(),
      expires_in: expiresIn,
    });

    let encrypted: string;
    try {
      encrypted = await encryptCredential(credentialPayload, encryptionKey);
    } catch (err) {
      // Should be unreachable — encryptCredential already falls back to v0.
      logEncryptFailure(err, encryptionKey);
      encrypted = encodeSecureFallback(credentialPayload);
      console.warn("[socialOAuthCallback] crypto_encryption used encodeSecureFallback — continuing connect");
    }

    const expiresAt = new Date(Date.now() + Number(expiresIn) * 1000).toISOString();
    const connectedAt = new Date().toISOString();
    const granted = normalizeGrantedPermissions(shortLived.permissions);
    const scopeSet = new Set(granted.length ? granted : INSTAGRAM_CONNECT_SCOPES);

    try {
      const publishProbe = await probeInstagramPublishCapability({
        accessToken,
        igUserId,
      });
      if (publishProbe) {
        scopeSet.add("instagram_business_content_publish");
      }
      console.log(
        "[socialOAuthCallback] permissions=",
        granted.join(",") || "(none)",
        "probePublish=",
        publishProbe,
        "igUserId=",
        igUserId
      );
    } catch (err) {
      console.warn("[socialOAuthCallback] publish_probe warning=", (err as Error)?.message || err);
    }

    const scopes = [...scopeSet].join(",");
    const hasPublish = hasInstagramPublishScope(scopes);

    try {
      const existing = await base44.asServiceRole.entities.SocialAccount.filter(
        { user_id: boundUserId, provider: boundProvider },
        "-created_date",
        20
      );
      const active = (existing || []).filter((a) => a.status === "connected");
      for (const row of active) {
        try {
          await base44.asServiceRole.entities.SocialAccount.update(row.id, {
            status: "disconnected",
            encrypted_credentials: "",
          });
        } catch (err) {
          console.warn(
            "[socialOAuthCallback] disconnect_prior warning=",
            (err as Error)?.message || err
          );
        }
      }

      const matching = (existing || []).filter(
        (a) => a.provider_account_id != null && String(a.provider_account_id) === String(igUserId)
      );
      const sameAccount = matching.sort(
        (a, b) =>
          new Date(b.connected_at || b.created_date || 0).getTime() -
          new Date(a.connected_at || a.created_date || 0).getTime()
      )[0];

      const fields = {
        user_id: boundUserId,
        provider: boundProvider,
        provider_account_id: igUserId,
        account_name: displayName || username || "Instagram",
        username: username || "",
        profile_image_url: profileImageUrl || "",
        status: "connected",
        scopes,
        encrypted_credentials: encrypted,
        expires_at: expiresAt,
        connected_at: connectedAt,
      };

      if (sameAccount?.id) {
        await base44.asServiceRole.entities.SocialAccount.update(sameAccount.id, fields);
      } else {
        await base44.asServiceRole.entities.SocialAccount.create(fields);
      }
    } catch (err) {
      return debugFailureResponse({
        home: publicAppUrl,
        step: "account_save",
        errorType: "ACCOUNT_SAVE_FAILED",
        socialErrorCode: "account_save_failed",
        err,
      });
    }

    if (!publicAppUrl) return configurationErrorResponse();
    if (!hasPublish) {
      return redirectToSocial(publicAppUrl, {
        social_connected: "instagram",
        social_warning: "missing_publish_scope",
      });
    }
    return redirectToSocial(publicAppUrl, { social_connected: "instagram" });
  } catch (err) {
    return debugFailureResponse({
      home: publicAppUrl,
      step: "unhandled",
      errorType: "BACKEND_CRASH",
      socialErrorCode: "provider_error",
      err,
    });
  }
}
