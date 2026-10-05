/** Label for uploaded audio in lists and the uploader. */
export function audioDisplayName({ audioFilename, audioUrl } = {}) {
  const stored = String(audioFilename || "").trim();
  if (stored) return stored;

  if (!audioUrl) return "";

  try {
    const path = decodeURIComponent(new URL(audioUrl).pathname);
    const segment = path.split("/").filter(Boolean).pop() || "";
    const withoutTs = segment.replace(/^\d+-/, "");
    const readable = withoutTs.replace(/_/g, " ");
    return readable || segment || "Audio file";
  } catch {
    return "Audio file";
  }
}
