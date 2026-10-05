import { secrets } from "./runtime.ts";

type ServiceAccount = {
  project_id: string;
  client_email: string;
  private_key: string;
};

function base64UrlEncode(data: Uint8Array | string): string {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToPkcs8(pem: string): ArrayBuffer {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  const raw = atob(body);
  const buf = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) buf[i] = raw.charCodeAt(i);
  return buf.buffer;
}

async function googleAccessToken(sa: ServiceAccount): Promise<string | null> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64UrlEncode(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })
  );
  const unsigned = `${header}.${claim}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToPkcs8(sa.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  const jwt = `${unsigned}.${base64UrlEncode(new Uint8Array(sig))}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!res.ok) {
    console.error("[fcmPush] token", res.status, await res.text().catch(() => ""));
    return null;
  }
  const json = await res.json();
  return String(json.access_token || "") || null;
}

function parseServiceAccount(): ServiceAccount | null {
  const raw = secrets.get("FCM_SERVICE_ACCOUNT_JSON") || "";
  if (!raw.trim()) return null;
  try {
    const sa = JSON.parse(raw) as ServiceAccount;
    if (!sa.project_id || !sa.client_email || !sa.private_key) return null;
    return sa;
  } catch {
    return null;
  }
}

export type FcmSendResult = { sent: number; failed: number; skipped: boolean; reason?: string };

/**
 * Send the same notification to multiple device tokens (FCM HTTP v1).
 * No-op when FCM_SERVICE_ACCOUNT_JSON is unset.
 */
export async function sendFcmNotifications(params: {
  tokens: string[];
  title: string;
  body: string;
  data?: Record<string, string>;
}): Promise<FcmSendResult> {
  const sa = parseServiceAccount();
  const tokens = (params.tokens || []).map((t) => String(t).trim()).filter(Boolean);
  if (!tokens.length) return { sent: 0, failed: 0, skipped: true, reason: "no_tokens" };
  if (!sa) return { sent: 0, failed: 0, skipped: true, reason: "fcm_not_configured" };

  const accessToken = await googleAccessToken(sa);
  if (!accessToken) return { sent: 0, failed: tokens.length, skipped: false, reason: "token_error" };

  let sent = 0;
  let failed = 0;
  const url = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`;

  for (const token of tokens) {
    const message = {
      message: {
        token,
        notification: { title: params.title, body: params.body.slice(0, 500) },
        data: params.data || {},
        android: { priority: "HIGH" as const },
      },
    };
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    });
    if (res.ok) sent += 1;
    else {
      failed += 1;
      console.error("[fcmPush] send", token.slice(0, 8), res.status, await res.text().catch(() => ""));
    }
  }

  return { sent, failed, skipped: false };
}
