const STORAGE_KEY = "musicpromo:activity-inbox";
const MAX_ITEMS = 30;

export function listActivity() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function pushActivity(entry) {
  if (typeof window === "undefined") return;
  const item = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    level: entry.level || "info",
    title: String(entry.title || "Update"),
    message: entry.message ? String(entry.message) : "",
    href: entry.href ? String(entry.href) : "",
  };
  const next = [item, ...listActivity()].slice(0, MAX_ITEMS);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent("musicpromo:activity-inbox"));
}

export function clearActivity(id) {
  const next = listActivity().filter((x) => x.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent("musicpromo:activity-inbox"));
}

export function markAllActivityRead() {
  const next = listActivity().map((x) => ({ ...x, read: true }));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent("musicpromo:activity-inbox"));
}
