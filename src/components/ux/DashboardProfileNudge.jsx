import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { fetchOwnProfile } from "@/services/userProfile";
import { db } from "@/api/base44Client";
import { computeCompleteness } from "@/services/communityProfileUtils";
import ProfileCompletenessMeter from "@/components/community/ProfileCompletenessMeter";
import { Button } from "@/components/ui/button";

export default function DashboardProfileNudge() {
  const { user, isAuthenticated } = useAuth();
  const [completeness, setCompleteness] = useState(null);

  useEffect(() => {
    if (!isAuthenticated || !user?.id) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const [profile, artists] = await Promise.all([
          fetchOwnProfile(user.id),
          db.entities.Artist.list("-created_date", 20).catch(() => []),
        ]);
        if (!cancelled) setCompleteness(computeCompleteness(profile, artists));
      } catch {
        if (!cancelled) setCompleteness(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, user?.id]);

  if (!completeness || completeness.score >= 100) return null;

  return (
    <div className="rounded-2xl border border-border/50 bg-card/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <ProfileCompletenessMeter completeness={completeness} compact />
        </div>
        <Button size="sm" variant="outline" className="rounded-full" asChild>
          <Link to="/profile">Complete profile</Link>
        </Button>
      </div>
    </div>
  );
}
