import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarClock, Film, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { db } from "@/api/base44Client";
import {
  dayToLocalDatetimeValue,
  formatScheduledAtDisplay,
  localDatetimeToIso,
  scheduledAtToLocalValue,
} from "@/lib/campaignDaySchedule";
import { scheduleBlockedReason } from "@/lib/campaignVideoReadiness";
import { scheduleCampaignDay } from "@/services/socialService";

export default function LaunchDayScheduleControls({ day, campaignId, onScheduled }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [videoProject, setVideoProject] = useState(null);
  const initial =
    scheduledAtToLocalValue(day.scheduled_at) || dayToLocalDatetimeValue(day) || "";
  const [when, setWhen] = useState(initial);

  const isScheduled = ["scheduled", "processing", "posted", "complete"].includes(
    String(day.status || "")
  );

  useEffect(() => {
    const id = day?.video_project_id;
    if (!id) {
      setVideoProject(null);
      return;
    }
    let cancelled = false;
    db.entities.VideoProject.get(id)
      .then((row) => {
        if (!cancelled) setVideoProject(row);
      })
      .catch(() => {
        if (!cancelled) setVideoProject(null);
      });
    return () => {
      cancelled = true;
    };
  }, [day?.video_project_id]);

  const videoBlock = scheduleBlockedReason(day, videoProject);
  const cid = campaignId || day?.campaign_id;

  const runSchedule = async () => {
    if (videoBlock) {
      toast({
        variant: "destructive",
        title: "Promo video not ready",
        description: videoBlock,
      });
      return;
    }
    const iso = localDatetimeToIso(when) || localDatetimeToIso(dayToLocalDatetimeValue(day));
    if (!iso) {
      toast({ variant: "destructive", title: "Pick a date and time" });
      return;
    }
    setBusy(true);
    try {
      const res = await scheduleCampaignDay({ campaignDayId: day.id, scheduledAt: iso });
      if (!res?.ok) {
        const skipped = Array.isArray(res?.skipped)
          ? res.skipped.map((s) => `${s.provider}: ${s.reason}`).join("; ")
          : "";
        toast({
          variant: "destructive",
          title: isScheduled ? "Could not reschedule" : "Could not schedule",
          description:
            res?.error ||
            skipped ||
            "Connect social accounts in Social Hub and render promo videos for TikTok/YouTube days.",
        });
        return;
      }
      toast({
        title: isScheduled ? "Rescheduled" : "Scheduled",
        description: res.message || formatScheduledAtDisplay(res.scheduledAt),
      });
      onScheduled?.();
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Schedule failed",
        description: e.message,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 space-y-2 rounded-xl border border-border/40 bg-muted/15 p-3">
      <div className="flex items-center gap-2 text-xs font-600 text-muted-foreground">
        <CalendarClock className="h-3.5 w-3.5" />
        {isScheduled ? "Reschedule auto-publish" : "Schedule auto-publish"}
      </div>
      {videoBlock && cid ? (
        <p className="flex items-start gap-2 rounded-lg border border-amber-500/35 bg-amber-500/10 px-2.5 py-2 text-xs text-amber-100/95">
          <Film className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            {videoBlock}{" "}
            <Link to={`/campaigns/${cid}/videos`} className="font-semibold text-primary underline">
              Open videos
            </Link>
            {" · "}
            <Link
              to={`/campaigns/${cid}/video?${day?.video_project_id ? `project=${day.video_project_id}&` : ""}day=${day.id}`}
              className="font-semibold text-primary underline"
            >
              Edit in studio
            </Link>
          </span>
        </p>
      ) : null}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1 space-y-1">
          <Label className="text-xs">Go-live time</Label>
          <Input
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            className="rounded-xl"
          />
        </div>
        <Button type="button" size="sm" className="rounded-full" disabled={busy} onClick={runSchedule}>
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {isScheduled ? "Update schedule" : "Schedule"}
        </Button>
      </div>
    </div>
  );
}
