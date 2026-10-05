/** Platforms that require a finished MP4 for auto-publish. */
export function dayPlatformNeedsVideo(platform) {
  const p = String(platform || "").toLowerCase();
  return (
    p.includes("tiktok") ||
    p.includes("youtube") ||
    p.includes("reel") ||
    p.includes("short") ||
    p.includes("video")
  );
}

export function isVideoProjectReady(project) {
  if (!project) return false;
  const url = String(project.render_output_url || project.renderOutputUrl || "").trim();
  return project.rendering_status === "complete" && /^https:\/\//i.test(url);
}

export function scheduleBlockedReason(day, videoProject) {
  if (!dayPlatformNeedsVideo(day?.platform)) return null;
  if (isVideoProjectReady(videoProject)) return null;
  return "Finish the promo video for this day (Campaign → Videos → Render all, or open the editor to tweak hook, clip start, and look).";
}
