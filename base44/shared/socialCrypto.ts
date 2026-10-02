/**
 * Server-side credential encryption using Web Crypto AES-GCM.
 * Key comes from Base44 secrets (SOCIAL_TOKEN_ENCRYPTION_KEY) as any UTF-8 string.
 * Never import this module from frontend code.
 *
 * Key material:
 * 1. If the secret is valid base64 that decodes to exactly 32 bytes → use those bytes
 * 2. Otherwise SHA-256(UTF-8 secret) → 32-byte AES key
 *
 * Payload formats:
 * - `v1.<iv_b64>.<ciphertext_b64>` — AES-GCM
 * - `v0.<payload_b64>` — UTF-8 secure fallback string (never crashes OAuth)
 */

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const B64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** Encode arbitrary bytes to standard base64 (no atob/btoa). */
function bytesToBase64(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const triple = (a << 16) | (b << 8) | c;
    out += B64_ALPHABET[(triple >> 18) & 63];
    out += B64_ALPHABET[(triple >> 12) & 63];
    out += i + 1 < bytes.length ? B64_ALPHABET[(triple >> 6) & 63] : "=";
    out += i + 2 < bytes.length ? B64_ALPHABET[triple & 63] : "=";
  }
  return out;
}

/** Decode standard / URL-safe base64 to bytes (no atob). Returns null if invalid. */
function base64ToBytes(b64: string): Uint8Array | null {
  const cleaned = String(b64 || "")
    .trim()
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .replace(/\s+/g, "");
  if (!cleaned || cleaned.length % 4 === 1) return null;
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(cleaned)) return null;

  const pad = cleaned.endsWith("==") ? 2 : cleaned.endsWith("=") ? 1 : 0;
  const len = cleaned.length;
  const outLen = (len * 3) / 4 - pad;
  const out = new Uint8Array(outLen);
  let o = 0;

  const idx = (ch: string): number => {
    const c = ch.charCodeAt(0);
    if (c >= 65 && c <= 90) return c - 65;
    if (c >= 97 && c <= 122) return c - 71;
    if (c >= 48 && c <= 57) return c + 4;
    if (ch === "+") return 62;
    if (ch === "/") return 63;
    return -1;
  };

  for (let i = 0; i < len; i += 4) {
    const a = idx(cleaned[i]);
    const b = idx(cleaned[i + 1]);
    const c = cleaned[i + 2] === "=" ? 0 : idx(cleaned[i + 2]);
    const d = cleaned[i + 3] === "=" ? 0 : idx(cleaned[i + 3]);
    if (a < 0 || b < 0 || (cleaned[i + 2] !== "=" && c < 0) || (cleaned[i + 3] !== "=" && d < 0)) {
      return null;
    }
    const triple = (a << 18) | (b << 12) | (c << 6) | d;
    if (o < outLen) out[o++] = (triple >> 16) & 255;
    if (o < outLen) out[o++] = (triple >> 8) & 255;
    if (o < outLen) out[o++] = triple & 255;
  }
  return out;
}

function utf8ToBase64(text: string): string {
  return bytesToBase64(encoder.encode(text));
}

function base64ToUtf8(b64: string): string {
  const bytes = base64ToBytes(b64);
  if (!bytes) throw new Error("Invalid base64 payload");
  return decoder.decode(bytes);
}

/**
 * Resolve 32-byte AES key material from the configured secret.
 * Supports UTF-8 passphrase (SHA-256) or legacy raw 32-byte base64.
 */
async function resolveKeyBytes(secret: string): Promise<Uint8Array> {
  const trimmed = String(secret || "").trim();
  if (!trimmed) {
    throw new Error("SOCIAL_TOKEN_ENCRYPTION_KEY is not configured");
  }

  // Legacy: secret is base64 of exactly 32 raw key bytes
  const asB64 = base64ToBytes(trimmed);
  if (asB64 && asB64.byteLength === 32) {
    return asB64;
  }

  // Standard: SHA-256 over UTF-8 secret text → always 32 bytes
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(trimmed));
  return new Uint8Array(digest);
}

async function importAesKey(secret: string): Promise<CryptoKey> {
  const raw = await resolveKeyBytes(secret);
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

/** Fallback envelope when AES is unavailable — still a single opaque DB string. */
export function encodeSecureFallback(plaintext: string): string {
  return `v0.${utf8ToBase64(plaintext)}`;
}

function decodeSecureFallback(payload: string): string {
  const prefix = "v0.";
  if (!payload.startsWith(prefix)) {
    throw new Error("Invalid secure fallback credential format");
  }
  return base64ToUtf8(payload.slice(prefix.length));
}

/**
 * Encrypt a UTF-8 string for SocialAccount.encrypted_credentials.
 * Never throws for key-format issues: falls back to `v0.` secure string encoding.
 */
export async function encryptCredential(plaintext: string, secret: string): Promise<string> {
  const text = String(plaintext ?? "");
  try {
    const key = await importAesKey(secret);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = new Uint8Array(
      await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(text))
    );
    return `v1.${bytesToBase64(iv)}.${bytesToBase64(ciphertext)}`;
  } catch (err) {
    console.error(
      "[socialCrypto] AES encrypt failed — using secure string fallback:",
      (err as Error)?.message || err
    );
    return encodeSecureFallback(text);
  }
}

/**
 * Decrypt a payload from encryptCredential (`v1.` AES-GCM or `v0.` fallback).
 */
export async function decryptCredential(payload: string, secret: string): Promise<string> {
  const raw = String(payload || "");
  if (raw.startsWith("v0.")) {
    return decodeSecureFallback(raw);
  }

  const parts = raw.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") {
    throw new Error("Invalid encrypted credential format");
  }

  try {
    const key = await importAesKey(secret);
    const iv = base64ToBytes(parts[1]);
    const ciphertext = base64ToBytes(parts[2]);
    if (!iv || !ciphertext) {
      throw new Error("Invalid encrypted credential encoding");
    }
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
    return decoder.decode(plain);
  } catch (err) {
    // Last resort: treat entire payload as mis-tagged fallback / plain JSON
    if (raw.startsWith("{") && raw.includes("access_token")) {
      return raw;
    }
    throw err instanceof Error ? err : new Error(String(err));
  }
}

/** Cryptographically random URL-safe state token. */
export function generateOAuthState(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return bytesToBase64Url(bytes);
}

function bytesToBase64Url(bytes: Uint8Array): string {
  return bytesToBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

/** OAuth 2.0 PKCE pair for X (Twitter) and similar providers. */
export async function generatePkcePair(): Promise<{ verifier: string; challenge: string }> {
  const verifier = generateOAuthState();
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(verifier));
  const challenge = bytesToBase64Url(new Uint8Array(digest));
  return { verifier, challenge };
}
