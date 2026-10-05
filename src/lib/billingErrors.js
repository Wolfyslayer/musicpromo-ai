export const BILLING_SETTINGS_PATH = "/settings/billing";

export function isInsufficientCreditsError(err) {
  return err?.status === 402 || err?.data?.code === "INSUFFICIENT_CREDITS";
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
  if (isInsufficientCreditsError(err)) {
    return {
      title: "Not enough credits",
      description: `${insufficientCreditsMessage(err)} Open Settings → Plan & credits to see your balance or upgrade to Pro.`,
    };
  }
  return {
    title: "Request failed",
    description: err?.message || "Something went wrong.",
  };
}
