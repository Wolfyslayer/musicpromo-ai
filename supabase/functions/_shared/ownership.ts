/**
 * Ownership helpers for service-role paths that must still enforce per-user isolation.
 */

export function recordOwnedByUser(
  record: Record<string, unknown> | null | undefined,
  user: { id?: string; email?: string } | null | undefined
): boolean {
  if (!record || !user?.id) return false;
  const userId = String(user.id);
  const email = user.email ? String(user.email).toLowerCase() : "";

  if (record.user_id != null && String(record.user_id) === userId) return true;
  if (record.created_by_id != null && String(record.created_by_id) === userId) return true;
  if (
    email &&
    record.created_by != null &&
    String(record.created_by).toLowerCase() === email
  ) {
    return true;
  }
  return false;
}
