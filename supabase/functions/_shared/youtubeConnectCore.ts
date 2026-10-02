import { createClientFromRequest } from "./runtime.ts";
import { secrets } from "./runtime.ts";
import { encryptCredential, encodeSecureFallback } from "./socialCrypto.ts";
import {
  YOUTUBE_CONNECT_SCOPES,
  exchangeYouTubeCode,
  fetchYouTubeChannel,
} from "./youtubeOAuth.ts";

export function youtubeClientSecret(): string {
  return (
    secrets.get("GOOGLE_LOGIN_CLIENT_SECRET") ||
    secrets.get("GOOGLE_CLIENT_SECRET") ||
    secrets.get("YOUTUBE_CLIENT_SECRET") ||
    ""
  ).trim();
}

export function resolveYoutubeClientId(oauthClientId?: string | null): string {
  return (
    String(oauthClientId || "").trim() ||
    secrets.get("GOOGLE_CLIENT_ID") ||
    secrets.get("YOUTUBE_CLIENT_ID") ||
    ""
  ).trim();
}

async function encryptPayload(plaintext: string, encryptionKey: string): Promise<string> {
  try {
    return await encryptCredential(plaintext, encryptionKey);
  } catch (err) {
    console.error("[youtubeConnect] encrypt fallback", (err as Error)?.message || err);
    return encodeSecureFallback(plaintext);
  }
}

async function upsertSocialAccount(
  base44: ReturnType<typeof createClientFromRequest>,
  fields: Record<string, unknown>
): Promise<void> {
  const userId = String(fields.user_id);
  const provider = String(fields.provider);
  const providerAccountId = String(fields.provider_account_id);
  const artistId = String(fields.artist_id || "").trim();
  const existing = await base44.asServiceRole.entities.SocialAccount.filter(
    { user_id: userId, provider },
    "-created_date",
    20
  );
  for (const row of (existing || []).filter((a) => {
    if (a.status !== "connected") return false;
    const rowArtist = String(a.artist_id || "").trim();
    if (artistId) return rowArtist === artistId;
    return !rowArtist;
  })) {
    await base44.asServiceRole.entities.SocialAccount.update(row.id, {
      status: "disconnected",
      encrypted_credentials: "",
    }).catch(() => {});
  }
  const same = (existing || []).find(
    (a) => a.provider_account_id != null && String(a.provider_account_id) === providerAccountId
  );
  if (same?.id) {
    await base44.asServiceRole.entities.SocialAccount.update(same.id, fields);
  } else {
    await base44.asServiceRole.entities.SocialAccount.create(fields);
  }
}

/** Exchange code and upsert SocialAccount for YouTube. */
export async function completeYouTubeConnect(params: {
  base44: ReturnType<typeof createClientFromRequest>;
  code: string;
  boundUserId: string;
  boundArtistId?: string;
  encryptionKey: string;
  redirectUri: string;
  oauthClientId?: string | null;
}): Promise<void> {
  const clientId = resolveYoutubeClientId(params.oauthClientId);
  const clientSecret = youtubeClientSecret();
  if (!clientId || !clientSecret) {
    throw new Error("YouTube OAuth is not configured (client ID / secret).");
  }

  const token = await exchangeYouTubeCode({
    clientId,
    clientSecret,
    code: params.code,
    redirectUri: params.redirectUri,
  });

  const channel = await fetchYouTubeChannel(token.access_token);
  const expiresIn = token.expires_in || 3600;
  const encrypted = await encryptPayload(
    JSON.stringify({
      access_token: token.access_token,
      refresh_token: token.refresh_token || null,
      channel_id: channel.channel_id,
      token_type: "bearer",
      auth_type: "google_youtube",
      obtained_at: new Date().toISOString(),
      expires_in: expiresIn,
      scope: token.scope || YOUTUBE_CONNECT_SCOPES.join(" "),
    }),
    params.encryptionKey
  );

  await upsertSocialAccount(params.base44, {
    user_id: params.boundUserId,
    artist_id: params.boundArtistId || "",
    provider: "youtube",
    provider_account_id: channel.channel_id,
    account_name: channel.title || "YouTube",
    username: channel.custom_url || "",
    profile_image_url: channel.thumbnail_url || "",
    status: "connected",
    scopes: token.scope || YOUTUBE_CONNECT_SCOPES.join(" "),
    encrypted_credentials: encrypted,
    expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
    connected_at: new Date().toISOString(),
  });
}
