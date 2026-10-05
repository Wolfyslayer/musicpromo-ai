import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, CalendarRange, Loader2, Mail } from "lucide-react";
import { canUseNativePush, syncNativePushRegistration } from "@/services/pushNotifications";
import SurfacePanel from "@/components/SurfacePanel";
import StatusBadge from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/lib/AuthContext";
import { loadLaunchDigest } from "@/services/communityService";
import { fetchOwnProfile, updateOwnProfile } from "@/services/userProfile";
import { fmtDate } from "@/services/format";

export default function LaunchDigestPanel() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [digest, setDigest] = useState(null);
  const [digestOn, setDigestOn] = useState(true);
  const [pushOn, setPushOn] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pushSaving, setPushSaving] = useState(false);
  const nativePush = canUseNativePush();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [d, profile] = await Promise.all([
          loadLaunchDigest(),
          user?.id ? fetchOwnProfile(user.id) : null,
        ]);
        if (!cancelled) {
          setDigest(d);
          setDigestOn(profile?.launch_digest_enabled !== false);
          setPushOn(profile?.push_digest_enabled !== false);
        }
      } catch (e) {
        if (!cancelled) toast({ variant: "destructive", title: "Digest unavailable", description: e.message });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, toast]);

  const togglePush = async (checked) => {
    if (!user?.id) return;
    setPushOn(checked);
    setPushSaving(true);
    try {
      if (checked && nativePush) {
        const reg = await syncNativePushRegistration(null);
        if (!reg?.ok) {
          setPushOn(false);
          toast({
            variant: "destructive",
            title: "Notifications blocked",
            description:
              reg?.denied
                ? "Allow notifications in Android Settings → Apps → MusicPromo AI → Notifications."
                : "Could not register for push on this device.",
          });
          return;
        }
      }
      await updateOwnProfile(user.id, { push_digest_enabled: checked });
      toast({ title: checked ? "Weekly push notifications on" : "Weekly push notifications off" });
    } catch (e) {
      setPushOn(!checked);
      toast({ variant: "destructive", title: "Could not save", description: e.message });
    } finally {
      setPushSaving(false);
    }
  };

  const toggleDigest = async (checked) => {
    if (!user?.id) return;
    setDigestOn(checked);
    setSaving(true);
    try {
      await updateOwnProfile(user.id, { launch_digest_enabled: checked });
      toast({ title: checked ? "Weekly email digest on" : "Weekly email digest off" });
    } catch (e) {
      setDigestOn(!checked);
      toast({ variant: "destructive", title: "Could not save", description: e.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!digest) return null;

  return (
    <SurfacePanel className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/12 text-primary">
            <CalendarRange className="h-5 w-5" />
          </div>
          <div>
            <p className="font-heading font-semibold">Your week ahead</p>
            <p className="text-xs text-muted-foreground">{digest.weekLabel}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <Label htmlFor="digest-email" className="text-xs font-normal">
              Weekly email
            </Label>
            <Switch id="digest-email" checked={digestOn} disabled={saving} onCheckedChange={toggleDigest} />
          </div>
          {nativePush ? (
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-muted-foreground" />
              <Label htmlFor="digest-push" className="text-xs font-normal">
                Weekly push
              </Label>
              <Switch id="digest-push" checked={pushOn} disabled={pushSaving} onCheckedChange={togglePush} />
            </div>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Upcoming days" value={digest.upcomingDays?.length || 0} />
        <Stat label="Active campaigns" value={digest.activeCampaigns?.length || 0} />
        <Stat label="Promo inbox" value={digest.pendingPromoRequests || 0} />
      </div>

      {digest.upcomingDays?.length ? (
        <ul className="space-y-2 text-sm">
          {digest.upcomingDays.slice(0, 5).map((d) => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/50 px-3 py-2">
              <span>
                Day {d.dayNumber ?? "—"} · {fmtDate(d.date)}
              </span>
              <StatusBadge status={d.status || "pending"} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No campaign days in the next 7 days.</p>
      )}

      <Button size="sm" variant="outline" className="rounded-full" asChild>
        <Link to="/community">Community inbox</Link>
      </Button>
    </SurfacePanel>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-xl border border-border/50 bg-muted/15 p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="font-heading text-xl font-semibold">{value}</p>
    </div>
  );
}
