/**
 * Public web origin used for OAuth redirect URIs and auth emails.
 * Must match the web app / Google Cloud / Edge Function setup
 * (default https://musicpromoai.site).
 */
export function getPublicAppOrigin() {
  const configured = String(process.env.EXPO_PUBLIC_APP_ORIGIN || "").trim().replace(/\/$/, "");
  return configured || "https://musicpromoai.site";
}
