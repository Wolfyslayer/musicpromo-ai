const STORAGE_PREFIX = "musicpromo_release_launch_tour_v1";

function storageKey(userId, releaseId) {
  return `${STORAGE_PREFIX}:${userId}:${releaseId}`;
}

export function readLocalReleaseLaunchTourComplete(userId, releaseId) {
  if (!userId || !releaseId || typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(storageKey(userId, releaseId)) === "1";
  } catch {
    return false;
  }
}

export function writeLocalReleaseLaunchTourComplete(userId, releaseId) {
  if (!userId || !releaseId || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(userId, releaseId), "1");
  } catch {
    /* ignore */
  }
}

/** Per-release launch command center tour (first visit with timeline days). */
export async function isReleaseLaunchTourComplete(userId, releaseId) {
  if (!userId || !releaseId) return true;
  return readLocalReleaseLaunchTourComplete(userId, releaseId);
}

export async function markReleaseLaunchTourComplete(userId, releaseId) {
  if (!userId || !releaseId) return;
  writeLocalReleaseLaunchTourComplete(userId, releaseId);
}

/** Allow replaying the launch tour from Settings. */
export function resetReleaseLaunchTour(userId, releaseId) {
  if (!userId || !releaseId || typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(storageKey(userId, releaseId));
  } catch {
    /* ignore */
  }
}

export const RELEASE_LAUNCH_TOUR_SHOW_EVENT = "musicpromo:show-release-launch-tour";
