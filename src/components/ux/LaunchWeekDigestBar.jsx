import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarRange, Loader2 } from "lucide-react";
import { loadLaunchDigest } from "@/services/communityService";

export default function LaunchWeekDigestBar() {
  const [loading, setLoading] = useState(true);
  const [digest, setDigest] = useState(null);

  useEffect(() => {
    let cancelled = false;
    loadLaunchDigest()
      .then((d) => {
        if (!cancelled) setDigest(d);
      })
      .catch(() => {
        if (!cancelled) setDigest(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center rounded-2xl border border-border/40 py-4">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  if (!digest) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/50 bg-primary/5 px-4 py-3">
      <div className="flex items-center gap-2 text-sm">
        <CalendarRange className="h-4 w-4 text-primary" />
        <span className="font-600">Week ahead</span>
        <span className="text-muted-foreground">· {digest.weekLabel}</span>
        <span className="text-xs text-muted-foreground">
          {digest.upcomingDays?.length || 0} days · {digest.pendingPromoRequests || 0} promo inbox
        </span>
      </div>
      <Link to="/community" className="text-xs font-600 text-primary hover:underline">
        Community inbox
      </Link>
    </div>
  );
}
