export function userFacingError(err: unknown, fallback = "Something went wrong.") {
  if (!err) return fallback;
  if (typeof err === "string") return err;
  const message = (err as { message?: string })?.message;
  if (message && /network|fetch|failed to fetch|offline/i.test(message)) {
    return "Network error. Check your connection and try again.";
  }
  return message || fallback;
}

export function logError(scope: string, err: unknown) {
  console.error(`[${scope}]`, err);
}
