/** @deprecated Plans open from header credits; kept for deep links that redirect. */
export const BILLING_SETTINGS_PATH = "/settings/billing";

export function isInsufficientCreditsError(err) {
  return err?.status === 402 || err?.data?.code === "INSUFFICIENT_CREDITS";
}

export function isPremiumRequiredError(err) {
  return err?.status === 403 || err?.data?.code === "PREMIUM_REQUIRED";
}

export function insufficientCreditsMessage(err) {
  if (!isInsufficientCreditsError(err)) return err?.message || "Something went wrong.";
  const required = err?.data?.creditsRequired;
  const balance = err?.data?.creditsBalance;
  const base = err?.message || "Not enough credits for this AI action.";
  if (required != null && balance != null) {
    return `${base} (${balance} available, ${required} required.)`;
  }
  return base;
}

/** Toast title + description for billing-related failures. */
export function billingFailureToast(err) {
  if (isPremiumRequiredError(err)) {
    return {
      title: "Creator plan required",
      description: `${err?.message || "Upgrade to unlock Suno songs and stem splitting."} Tap your credit balance in the header to upgrade.`,
    };
  }
  if (isInsufficientCreditsError(err)) {
    return {
      title: "Not enough credits",
      description: `${insufficientCreditsMessage(err)} Tap credits in the header for plans and top-ups.`,
    };
  }
  return {
    title: "Request failed",
    description: err?.message || "Something went wrong.",
  };
}
