import {
  normalizeInstagramPublishError,
  type NormalizedPublishError,
} from "./instagramPublishing.ts";

const PROVIDER_LABEL: Record<string, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  x: "X",
};

function providerLabel(provider: string): string {
  return PROVIDER_LABEL[String(provider || "").toLowerCase()] || "Social";
}

/** Map thrown errors to user-facing publish failures for the active platform. */
export function normalizeSocialPublishError(
  err: unknown,
  provider: string
): NormalizedPublishError {
  const pid = String(provider || "instagram").toLowerCase();
  if (pid === "instagram") {
    return normalizeInstagramPublishError(err);
  }

  const label = providerLabel(pid);
  const msg = String((err as { message?: string })?.message || err || "").trim();
  const lower = msg.toLowerCase();
  const detail =
    msg.includes(":") && !msg.startsWith("http")
      ? msg.split(":").slice(1).join(":").trim()
      : msg;

  if (
    lower.includes("permission") ||
    lower.includes("oauth") ||
    lower.includes("scope") ||
    lower.includes("403")
  ) {
    return {
      code: "PERMISSION_DENIED",
      message: `${label} permission denied. Reconnect ${label} with publishing access in Social Hub.`,
    };
  }
  if (lower.includes("token") || lower.includes("session") || lower.includes("refresh:")) {
    return {
      code: "INVALID_TOKEN",
      message: `${label} session expired. Reconnect your account in Social Hub.`,
    };
  }
  if (
    lower.includes("unaudited_client") ||
    lower.includes("private account") ||
    lower.includes("only post to a private")
  ) {
    return {
      code: "PROVIDER_ERROR",
      message:
        "TikTok blocked this post: your TikTok profile must be Private for this app (Settings and privacy → Privacy → Private account). Posts are already sent as Only me. Switch the account to Private, reconnect TikTok in Social Hub, then retry.",
    };
  }
  if (lower.includes("tiktok_only_me_unavailable")) {
    return {
      code: "PROVIDER_ERROR",
      message: msg.includes(":") ? msg.split(":").slice(1).join(":").trim() : msg,
    };
  }
  if (
    lower.includes("integration guidelines") ||
    lower.includes("content-sharing-guidelines") ||
    lower.includes("privacy_level_option")
  ) {
    const apiDetail = msg.includes(":") ? msg.split(":").slice(1).join(":").trim().slice(0, 220) : "";
    return {
      code: "PROVIDER_ERROR",
      message:
        pid === "tiktok"
          ? apiDetail
            ? `TikTok: ${apiDetail} We always publish as Only me. If your TikTok profile is public, set it to Private and retry.`
            : "TikTok blocked this post (integration rules). We publish as Only me — set your TikTok profile to Private (Settings → Privacy), reconnect in Social Hub, and retry."
          : `${label} rejected this post due to platform integration rules.`,
    };
  }
  if (lower.includes("inbox") || lower.includes("send_to_user_inbox")) {
    return {
      code: "PERMISSION_DENIED",
      message:
        pid === "tiktok"
          ? "TikTok returned inbox/draft flow. Reconnect with Direct Post (video.publish) and enable Direct Post in the TikTok developer app."
          : `${label} returned a draft/inbox flow. Reconnect with publish permissions.`,
    };
  }
  if (
    lower.includes("media") ||
    lower.includes("video") ||
    lower.includes("download") ||
    lower.includes("fetch") ||
    lower.includes("mp4")
  ) {
    return {
      code: "INVALID_MEDIA",
      message: `${label} could not use this video. Use a public HTTPS MP4 from your rendered promo.`,
    };
  }
  if (lower.includes("rate") || lower.includes("limit")) {
    return { code: "RATE_LIMITED", message: `${label} rate limit reached. Try again later.` };
  }
  if (lower.includes("timed out") || lower.includes("timeout")) {
    return {
      code: "PROVIDER_ERROR",
      message: `${label} publish timed out while processing. Try again in a few minutes.`,
    };
  }

  const surfaced = (detail || msg).slice(0, 280);
  if (surfaced && surfaced.length > 8 && !/^unknown error$/i.test(surfaced)) {
    return {
      code: "PROVIDER_ERROR",
      message: `${label} publishing failed: ${surfaced}`,
    };
  }

  return { code: "PROVIDER_ERROR", message: `${label} publishing failed. Try again.` };
}
