const RELOAD_KEY = "musicpromo_chunk_reload";

export function isChunkLoadError(err) {
  const msg = String(err?.message || err || "").toLowerCase();
  return (
    msg.includes("failed to fetch dynamically imported module") ||
    msg.includes("importing a module script failed") ||
    msg.includes("error loading dynamically imported module") ||
    (msg.includes("loading chunk") && msg.includes("failed"))
  );
}

export function chunkLoadUserMessage(err) {
  if (!isChunkLoadError(err)) return String(err?.message || err || "Request failed");
  return "The app was updated. Refresh the page once, then try again.";
}

export function reloadOnceOnChunkError(err) {
  if (!isChunkLoadError(err)) return false;
  try {
    if (sessionStorage.getItem(RELOAD_KEY) === "1") return false;
    sessionStorage.setItem(RELOAD_KEY, "1");
    window.location.reload();
    return true;
  } catch {
    return false;
  }
}

export async function importWithRetry(importer, { reloadOnChunkError = true } = {}) {
  try {
    return await importer();
  } catch (first) {
    if (reloadOnChunkError && reloadOnceOnChunkError(first)) {
      return new Promise(() => {});
    }
    if (isChunkLoadError(first)) {
      await new Promise((r) => setTimeout(r, 400));
      return await importer();
    }
    throw first;
  }
}
