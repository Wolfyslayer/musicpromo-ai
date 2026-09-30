/**
 * Server-side credential encryption using Web Crypto AES-GCM.
 * Key must come from Base44 secrets (SOCIAL_TOKEN_ENCRYPTION_KEY).
 * Never import this module from frontend code.
 */

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Import a 256-bit AES key from a base64-encoded secret (32 raw bytes).
 */
async function importAesKey(secretB64: string): Promise<CryptoKey> {
  if (!secretB64) {
    throw new Error("SOCIAL_TOKEN_ENCRYPTION_KEY is not configured");
  }
  const raw = base64ToBytes(secretB64);
  if (raw.byteLength !== 32) {
    throw new Error("SOCIAL_TOKEN_ENCRYPTION_KEY must be 32 bytes encoded as base64");
  }
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

/** Encrypt a UTF-8 string. Returns `v1.<iv_b64>.<ciphertext_b64>`. */
export async function encryptCredential(plaintext: string, keyB64: string): Promise<string> {
  const key = await importAesKey(keyB64);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(plaintext))
  );
  return `v1.${bytesToBase64(iv)}.${bytesToBase64(ciphertext)}`;
}

/** Decrypt a payload produced by encryptCredential. */
export async function decryptCredential(payload: string, keyB64: string): Promise<string> {
  const parts = String(payload || "").split(".");
  if (parts.length !== 3 || parts[0] !== "v1") {
    throw new Error("Invalid encrypted credential format");
  }
  const key = await importAesKey(keyB64);
  const iv = base64ToBytes(parts[1]);
  const ciphertext = base64ToBytes(parts[2]);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  return decoder.decode(plain);
}

/** Cryptographically random URL-safe state token. */
export function generateOAuthState(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return bytesToBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
