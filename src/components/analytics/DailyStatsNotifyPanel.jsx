import { useEffect, useState } from "react";
import { BarChart3, Bell, Loader2, Mail } from "lucide-react";
import { canUseNativePush, syncNativePushRegistration } from "@/services/pushNotifications";
import SurfacePanel from "@/components/SurfacePanel";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/lib/AuthContext";
import { loadDailyStatsDigest } from "@/services/communityService";
import {
  dailyStatsSchemaMigrationHint,
  fetchOwnProfile,
  syncBrowserTimezoneIfNeeded,
  updateOwnProfile,
} from "@/services/userProfile";
import { detectBrowserTimeZone, normalizeNotifyTime, timeZoneShortLabel } from "@/lib/userTimezone";

export default function DailyStatsNotifyPanel({ compact = false }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [digest, setDigest] = useState(null);
  const [emailOn, setEmailOn] = useState(false);
  const [pushOn, setPushOn] = useState(false);
  const [notifyTime, setNotifyTime] = useState("08:00");
  const [timeZone, setTimeZone] = useState(() => detectBrowserTimeZone());
  const [emailSaving, setEmailSaving] = useState(false);
  const [pushSaving, setPushSaving] = useState(false);
  const [timeSaving, setTimeSaving] = useState(false);
  const [schemaReady, setSchemaReady] = useState(true);
  const nativePush = canUseNativePush();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const profile = await fetchOwnProfile(user.id);
        const tz = await syncBrowserTimezoneIfNeeded(user.id, profile);
        const d = await loadDailyStatsDigest();
        if (!cancelled) {
          setDigest(d);
          const ready =
            profile?.dailyStatsSchemaReady !== false && d?.schemaReady !== false;
          setSchemaReady(ready);
          setTimeZone(d?.timeZone || tz);
          setNotifyTime(normalizeNotifyTime(d?.notifyTime || profile?.daily_stats_notify_time));
          setEmailOn(profile?.daily_stats_email_enabled === true || d?.emailEnabled === true);
          setPushOn(profile?.daily_stats_push_enabled === true || d?.pushEnabled === true);
        }
      } catch (e) {
        if (!cancelled) {
          setDigest(null);
          setSchemaReady(false);
          if (!compact) {
            toast({
              variant: "destructive",
              title: "Daily stats unavailable",
              description: e?.message?.includes("daily_stats")
                ? dailyStatsSchemaMigrationHint()
                : e.message,
            });
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, toast, compact]);

  const toggleEmail = async (checked) => {
    if (!user?.id) return;
    setEmailOn(checked);
    setEmailSaving(true);
    try {
      await updateOwnProfile(user.id, { daily_stats_email_enabled: checked });
      toast({ title: checked ? "Daily stats email on" : "Daily stats email off" });
    } catch (e) {
      setEmailOn(!checked);
      toast({ variant: "destructive", title: "Could not save", description: e.message });
    } finally {
      setEmailSaving(false);
    }
  };

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
                ? "Allow notifications in system settings for MusicPromo AI."
                : "Could not register for push on this device.",
          });
          return;
        }
      }
      await updateOwnProfile(user.id, { daily_stats_push_enabled: checked });
      toast({ title: checked ? "Daily stats push on" : "Daily stats push off" });
    } catch (e) {
      setPushOn(!checked);
      toast({ variant: "destructive", title: "Could not save", description: e.message });
    } finally {
      setPushSaving(false);
    }
  };

  const saveNotifyTime = async (nextRaw) => {
    if (!user?.id) return;
    const next = normalizeNotifyTime(nextRaw);
    setNotifyTime(next);
    setTimeSaving(true);
    try {
      await updateOwnProfile(user.id, { daily_stats_notify_time: next });
    } catch (e) {
      toast({ variant: "destructive", title: "Could not save delivery time", description: e.message });
    } finally {
      setTimeSaving(false);
    }
  };

  if (!user?.id) return null;

  if (loading) {
    return (
      <div className={`flex justify-center ${compact ? "py-4" : "py-8"}`}>
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const totals = digest?.totals || {};
  const views = Number(totals.views || 0);
  const engagement =
    Number(totals.likes || 0) +
    Number(totals.comments || 0) +
    Number(totals.shares || 0) +
    Number(totals.saves || 0);
  const dateLabel = digest?.dateLabel || "yesterday";
  const tzLabel = digest?.timeZoneLabel || timeZoneShortLabel(timeZone);

  return (
    <SurfacePanel className={compact ? "space-y-3 p-4 md:p-4" : "space-y-4"}>
      {!schemaReady ? (
        <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100/95">
          {digest?.schemaHint || dailyStatsSchemaMigrationHint()}
        </p>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/12 text-primary">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div>
            <p className="font-heading font-semibold">Daily stats digest</p>
            <p className="text-xs text-muted-foreground">
              Snapshot for {dateLabel} · {tzLabel} — email, push, or both
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <Label htmlFor="daily-stats-email" className="text-xs font-normal">
              Email
            </Label>
            <Switch
              id="daily-stats-email"
              checked={emailOn}
              disabled={emailSaving || !schemaReady}
              onCheckedChange={toggleEmail}
            />
          </div>
          {nativePush ? (
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-muted-foreground" />
              <Label htmlFor="daily-stats-push" className="text-xs font-normal">
                Push
              </Label>
              <Switch
                id="daily-stats-push"
                checked={pushOn}
                disabled={pushSaving || !schemaReady}
                onCheckedChange={togglePush}
              />
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground">Install the mobile app for push alerts.</p>
          )}
        </div>
      </div>

      {!compact ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="grid gap-3 sm:grid-cols-3 sm:flex-1">
            <MiniStat label="Views" value={views.toLocaleString()} />
            <MiniStat label="Engagement" value={engagement.toLocaleString()} />
            <MiniStat label="Rows logged" value={digest?.entryCount ?? 0} />
          </div>
          <div className="space-y-1.5 sm:w-44">
            <Label htmlFor="daily-stats-time" className="text-xs text-muted-foreground">
              Deliver around ({tzLabel})
            </Label>
            <Input
              id="daily-stats-time"
              type="time"
              value={notifyTime}
              disabled={timeSaving || !schemaReady}
              onChange={(e) => saveNotifyTime(e.target.value)}
              className="rounded-xl"
            />
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <p className="text-xs text-muted-foreground">
            {views > 0 ? (
              <>
                Last digest: <strong className="font-semibold text-foreground">{views.toLocaleString()}</strong> views ·{" "}
                {engagement.toLocaleString()} eng.
              </>
            ) : (
              <>Delivery around {notifyTime} ({tzLabel}).</>
            )}
          </p>
          <div className="flex items-center gap-2 sm:w-40">
            <Label htmlFor="daily-stats-time-compact" className="sr-only">
              Delivery time
            </Label>
            <Input
              id="daily-stats-time-compact"
              type="time"
              value={notifyTime}
              disabled={timeSaving || !schemaReady}
              onChange={(e) => saveNotifyTime(e.target.value)}
              className="h-9 rounded-xl text-sm"
            />
          </div>
        </div>
      )}

      {!nativePush && pushOn ? (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          Push is enabled on your account — open the native app to register this device.
        </p>
      ) : null}

      {compact ? null : (
        <p className="text-[11px] text-muted-foreground">
          Times use your device timezone ({timeZone}). Change travel? Reload the app and we update automatically.
        </p>
      )}
    </SurfacePanel>
  );
}

function MiniStat({ label, value }) {
  return (
    <div className="rounded-xl border border-border/50 bg-muted/15 p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="font-heading text-xl font-semibold">{value}</p>
    </div>
  );
}
