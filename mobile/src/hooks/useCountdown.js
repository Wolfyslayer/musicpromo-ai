import { useEffect, useState } from "react";

/**
 * Live countdown to an ISO scheduled_at timestamp.
 * Returns { label, overdue, ms } and updates every second while mounted.
 */
export function useCountdown(iso) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!iso) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [iso]);

  if (!iso) return { label: "", overdue: false, ms: null };

  const target = Date.parse(iso);
  if (Number.isNaN(target)) return { label: "", overdue: false, ms: null };

  const ms = target - now;
  if (ms <= 0) {
    return { label: "Due — waiting for auto-publish", overdue: true, ms };
  }

  const totalSec = Math.floor(ms / 1000);
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;

  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0 || d > 0) parts.push(`${h}h`);
  parts.push(`${m}m`);
  if (d === 0) parts.push(`${s}s`);

  return { label: `Goes live in ${parts.join(" ")}`, overdue: false, ms };
}

export default useCountdown;
