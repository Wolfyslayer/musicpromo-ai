import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Pencil,
  Film,
  Clock,
  RefreshCw,
  Loader2,
  CalendarDays,
  LayoutGrid,
  Share2,
  CalendarClock,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

import { db } from "@/api/base44Client";
import { aiService } from "@/services/aiService";
import { platformColor } from "@/services/constants";
import { fmtDate } from "@/services/format";
import {
  buildComposePath,
  kickCampaignWorker,
  loadPosts,
  scheduleCampaignDay,
  SOCIAL_PROVIDERS,
} from "@/services/socialService";
import { primaryProviderForDayPlatform } from "@/services/social/dayPlatform";
import { useCountdown } from "@/hooks/useCountdown";
import { useOverdueAutoPublish } from "@/hooks/useOverdueAutoPublish";
import CopyButton from "@/components/CopyButton";
import CreateVideoButton from "@/components/video/CreateVideoButton";
import StatusBadge from "@/components/StatusBadge";
import DayStatusChip from "@/components/ux/DayStatusChip";
import { pushActivity } from "@/lib/activityInbox";
import CampaignPlanInsights from "@/components/campaign/CampaignPlanInsights";
import SwipeDayCard from "@/components/campaign/SwipeDayCard";

const DAY_STATUSES = [
  { id: "planned", label: "Planned", color: "#8b8b9a" },
  { id: "ready", label: "Ready", color: "#3b82f6" },
  { id: "scheduled", label: "Scheduled", color: "#f59e0b" },
  { id: "processing", label: "Publishing", color: "#3b82f6" },
  { id: "posted", label: "Live", color: "#22c55e" },
  { id: "failed", label: "Failed", color: "#ef4444" },
  { id: "skipped", label: "Skipped", color: "#f59e0b" },
];

function DayScheduleMeta({ day, posts, onRefresh }) {
  const countdown = useCountdown(day.scheduled_at);
  const anyScheduled = posts.some((p) => p.status === "scheduled") || day.status === "scheduled";
  useOverdueAutoPublish(day.scheduled_at, anyScheduled && day.status !== "posted");
  const [nudging, setNudging] = useState(false);
  const { toast } = useToast();
  const live = posts.find((p) => p.status === "published" && p.externalPermalink);
  const anyPublishing = posts.some((p) => p.status === "publishing") || day.status === "processing";
  const anyFailed = posts.some((p) => p.status === "failed") || day.status === "failed";

  const runPublishNow = async () => {
    setNudging(true);
    try {
      const res = await kickCampaignWorker({ skipVideo: true, skipStats: true, batchLimit: 15 });
      const published = res?.worker?.published ?? 0;
      const reason = res?.worker?.publish?.reason;
      if (published > 0) {
        toast({ title: "Publishing started", description: `${published} post(s) processed.` });
      } else if (reason) {
        toast({
          variant: "destructive",
          title: "Auto-publish not configured",
          description: String(reason),
        });
      } else {
        toast({ title: "Worker ran", description: "Checking queue — refresh in a moment." });
      }
      onRefresh?.();
    } catch (e) {
      toast({ variant: "destructive", title: "Could not run worker", description: e.message });
    } finally {
      setNudging(false);
    }
  };

  if (live || day.status === "posted") {
    return (
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
        <StatusBadge status="posted" />
        {(live?.externalPermalink || day.live_permalink) && (
          <a
            href={live?.externalPermalink || day.live_permalink}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-primary hover:underline"
          >
            Live link <ExternalLink className="h-3 w-3" />
          </a>
        )}
        {posts
          .filter((p) => p.status === "published")
          .map((p) => (
            <span key={p.id} className="rounded-full border border-border/60 px-2 py-0.5 capitalize text-muted-foreground">
              {p.provider}
              {p.externalPermalink ? (
                <>
                  {" · "}
                  <a href={p.externalPermalink} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                    open
                  </a>
                </>
              ) : null}
            </span>
          ))}
      </div>
    );
  }

  if (anyPublishing) {
    return (
      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
        <StatusBadge status="processing" />
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Auto-publishing across connected platforms…
      </div>
    );
  }

  if (anyScheduled && day.scheduled_at) {
    return (
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
        <DayStatusChip day={day} posts={posts} />
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <Clock className="h-3 w-3" />
          {countdown.label || new Date(day.scheduled_at).toLocaleString()}
        </span>
        {countdown.overdue ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 rounded-full px-2.5 text-[11px]"
            disabled={nudging}
            onClick={runPublishNow}
          >
            {nudging ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
            Publish now
          </Button>
        ) : null}
      </div>
    );
  }

  if (anyFailed || day.publish_error) {
    return (
      <div className="mt-2 space-y-1 text-xs">
        <StatusBadge status="failed" />
        <p className="text-destructive/90">{day.publish_error || posts.find((p) => p.errorMessage)?.errorMessage}</p>
      </div>
    );
  }

  return null;
}

export default function CampaignPlan({ campaign, days, song, onRefresh }) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [editing, setEditing] = useState(null);
  const [regenerating, setRegenerating] = useState(null);
  const [schedulingId, setSchedulingId] = useState(null);
  const [posts, setPosts] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!campaign?.id) return;
      try {
        const res = await loadPosts({ campaignId: campaign.id });
        if (!cancelled) setPosts(res?.posts || []);
      } catch {
        if (!cancelled) setPosts([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [campaign?.id, days]);

  const postsByDay = useMemo(() => {
    const map = {};
    for (const p of posts) {
      const key = p.campaignDayId || "";
      if (!key) continue;
      if (!map[key]) map[key] = [];
      map[key].push(p);
    }
    return map;
  }, [posts]);

  const setStatus = async (day, status) => {
    await db.entities.CampaignDay.update(day.id, { status });
    onRefresh();
  };

  const scheduleDay = async (day) => {
    setSchedulingId(day.id);
    try {
      const res = await scheduleCampaignDay({ campaignDayId: day.id });
      if (!res?.ok) {
        pushActivity({
          level: "error",
          title: "Schedule failed",
          message: res?.error || "Connect social accounts and try again.",
          href: `/campaigns/${campaign.id}/plan`,
        });
        toast({
          variant: "destructive",
          title: "Could not schedule",
          description: res?.error || "Connect social accounts and try again.",
        });
        return;
      }
      toast({
        title: "Auto-publish scheduled",
        description:
          res?.message ||
          `Queued until ${new Date(res.scheduledAt).toLocaleString()}. The worker checks every few minutes.`,
      });
      const refreshed = await loadPosts({ campaignId: campaign.id });
      setPosts(refreshed?.posts || []);
      onRefresh();
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Could not schedule",
        description: e?.message || "Please try again.",
      });
    } finally {
      setSchedulingId(null);
    }
  };

  const regenerateDay = async (day) => {
    setRegenerating(day.id);
    try {
      const songData = { ...song, artistName: song?.artistName };
      const platform = day.platform || "TikTok";
      const [cap, tags, cta] = await Promise.all([
        aiService.generateCaptions({ song: songData, analysis: song?.analysis, platform }),
        aiService.generateHashtags({ song: songData, analysis: song?.analysis, platform }),
        aiService.generateCTA({ song: songData, analysis: song?.analysis, campaignGoals: campaign?.goals }),
      ]);
      const caption = cap.captions?.[0]?.text || day.caption;
      const hashtags = tags.categories?.[0]?.tags?.join(" ") || day.hashtags;
      const ctaText = cta.ctas?.[0]?.text || day.cta;
      await db.entities.CampaignDay.update(day.id, { caption, hashtags, cta: ctaText });
      onRefresh();
    } catch (e) {
      // keep simple
    } finally {
      setRegenerating(null);
    }
  };

  if (!days.length) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">No campaign days yet. Generate content or re-run campaign creation to build your plan.</p>
        <div className="flex flex-wrap gap-2">
          {campaign?.release_id && (
            <Button
              variant="outline"
              size="sm"
              className="rounded-full"
              onClick={() => navigate(`/releases/${campaign.release_id}/calendar`)}
            >
              <CalendarDays className="mr-1.5 h-3.5 w-3.5" /> View Calendar
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={() => navigate(`/campaigns/${campaign.id}/content`)}
          >
            <LayoutGrid className="mr-1.5 h-3.5 w-3.5" /> View Content
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {campaign?.id ? <CampaignPlanInsights campaignId={campaign.id} /> : null}
      <p className="text-xs text-muted-foreground">
        Use <span className="text-foreground">Schedule auto-publish</span> to queue Instagram, TikTok, YouTube, and X.
        Due posts publish automatically every few minutes (or tap Publish now when overdue).
      </p>
      {campaign?.release_id && (
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={() => navigate(`/releases/${campaign.release_id}/calendar`)}
          >
            <CalendarDays className="mr-1.5 h-3.5 w-3.5" /> View Calendar
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={() => navigate(`/campaigns/${campaign.id}/content`)}
          >
            <LayoutGrid className="mr-1.5 h-3.5 w-3.5" /> View Content
          </Button>
        </div>
      )}
      {!campaign?.release_id && (
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={() => navigate(`/campaigns/${campaign.id}/content`)}
          >
            <LayoutGrid className="mr-1.5 h-3.5 w-3.5" /> View Content
          </Button>
        </div>
      )}
      {days.map((day) => {
        const sm = DAY_STATUSES.find((s) => s.id === day.status) || DAY_STATUSES[0];
        const dayPosts = postsByDay[day.id] || [];
        const canSchedule = !["processing", "posted"].includes(day.status);
        const composeProvider = primaryProviderForDayPlatform(day.platform);
        const composeProviderLabel =
          SOCIAL_PROVIDERS.find((p) => p.id === composeProvider)?.name || day.platform || "Social";
        const openCompose = () =>
          navigate(
            buildComposePath({
              campaignId: campaign.id,
              campaignDayId: day.id,
              releaseId: campaign.release_id || "",
              platform: day.platform,
            })
          );

        return (
          <SwipeDayCard
            key={day.id}
            canSchedule={canSchedule}
            scheduleLabel={day.status === "scheduled" || day.status === "failed" ? "Reschedule" : "Schedule"}
            postLabel={composeProviderLabel}
            onSchedule={() => scheduleDay(day)}
            onPost={openCompose}
          >
          <div className="rounded-2xl border border-border/60 bg-card/50 p-4 animate-slide-up">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-muted/60">
                  <span className="font-heading text-sm font-semibold">D{day.day_number}</span>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{fmtDate(day.date)}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="rounded-full px-2 py-0.5 text-xs font-600" style={{ background: `${platformColor(day.platform)}22`, color: platformColor(day.platform) }}>
                      {day.platform}
                    </span>
                    <span className="text-xs text-muted-foreground">{day.content_type}</span>
                  </div>
                  <DayScheduleMeta day={day} posts={dayPosts} onRefresh={onRefresh} />
                </div>
              </div>
              <Select value={sm.id} onValueChange={(v) => setStatus(day, v)}>
                <SelectTrigger className="h-7 w-32 rounded-full text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DAY_STATUSES.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <p className="mt-3 text-sm font-600">{day.objective}</p>
            {day.hook && <p className="mt-1 text-xs text-primary">⚡ {day.hook}</p>}
            {day.video_concept && <p className="mt-1 text-xs text-muted-foreground">🎬 {day.video_concept}</p>}

            <div className="mt-3 rounded-xl bg-muted/30 p-3">
              <p className="text-sm">{day.caption}</p>
              {day.hashtags && <p className="mt-2 text-xs text-primary">{day.hashtags}</p>}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {day.cta && <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs text-primary">CTA: {day.cta}</span>}
              {day.posting_time && <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3 w-3" />{day.posting_time}</span>}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {canSchedule && (
                <Button
                  size="sm"
                  onClick={() => scheduleDay(day)}
                  disabled={schedulingId === day.id}
                  className="rounded-full"
                >
                  {schedulingId === day.id ? (
                    <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CalendarClock className="mr-1 h-3.5 w-3.5" />
                  )}
                  {day.status === "scheduled" || day.status === "failed" ? "Reschedule" : "Schedule auto-publish"}
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => setEditing(day)} className="rounded-full"><Pencil className="mr-1 h-3.5 w-3.5" />Edit</Button>
              <CopyButton text={day.caption} label="Copy Caption" />
              {day.hook && <CopyButton text={day.hook} label="Copy Hook" />}
              {day.hashtags && <CopyButton text={day.hashtags} label="Copy Hashtags" />}
              <Button variant="outline" size="sm" onClick={() => navigate(`/campaigns/${campaign.id}/content?day=${day.id}`)} className="rounded-full"><LayoutGrid className="mr-1 h-3.5 w-3.5" />Content</Button>
              <Button
                variant="outline"
                size="sm"
                onClick={openCompose}
                className="rounded-full"
              >
                <Share2 className="mr-1 h-3.5 w-3.5" />Post to {composeProviderLabel}
              </Button>
              <CreateVideoButton
                campaignId={campaign.id}
                dayId={day.id}
                projectId={day.video_project_id || ""}
                className="rounded-full"
              >
                <Film className="mr-1 h-3.5 w-3.5" />
                {day.video_project_id ? "Open video" : "Create video"}
              </CreateVideoButton>
              <Button variant="ghost" size="sm" onClick={() => regenerateDay(day)} disabled={regenerating === day.id} className="rounded-full">
                {regenerating === day.id ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1 h-3.5 w-3.5" />}Regenerate
              </Button>
            </div>
          </div>
          </SwipeDayCard>
        );
      })}

      {editing && <EditDayDialog day={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); onRefresh(); }} />}
    </div>
  );
}

function EditDayDialog({ day, onClose, onSaved }) {
  const { toast } = useToast();
  const [f, setF] = useState({
    caption: day.caption || "", hashtags: day.hashtags || "", cta: day.cta || "",
    posting_time: day.posting_time || "", objective: day.objective || "", video_concept: day.video_concept || "",
    hook: day.hook || "", platform: day.platform || "", content_type: day.content_type || "",
  });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const save = async () => {
    await db.entities.CampaignDay.update(day.id, f);
    toast({ title: "Day updated" });
    onSaved();
  };
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Edit Day {day.day_number}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs text-muted-foreground">Platform</Label><Input value={f.platform} onChange={(e) => set("platform", e.target.value)} className="mt-1.5 rounded-xl" /></div>
            <div><Label className="text-xs text-muted-foreground">Content Type</Label><Input value={f.content_type} onChange={(e) => set("content_type", e.target.value)} className="mt-1.5 rounded-xl" /></div>
          </div>
          <div><Label className="text-xs text-muted-foreground">Objective</Label><Input value={f.objective} onChange={(e) => set("objective", e.target.value)} className="mt-1.5 rounded-xl" /></div>
          <div><Label className="text-xs text-muted-foreground">Hook</Label><Input value={f.hook} onChange={(e) => set("hook", e.target.value)} className="mt-1.5 rounded-xl" /></div>
          <div><Label className="text-xs text-muted-foreground">Video Concept</Label><Input value={f.video_concept} onChange={(e) => set("video_concept", e.target.value)} className="mt-1.5 rounded-xl" /></div>
          <div><Label className="text-xs text-muted-foreground">Caption</Label><Textarea value={f.caption} onChange={(e) => set("caption", e.target.value)} rows={4} className="mt-1.5 rounded-xl" /></div>
          <div><Label className="text-xs text-muted-foreground">Hashtags</Label><Input value={f.hashtags} onChange={(e) => set("hashtags", e.target.value)} className="mt-1.5 rounded-xl" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs text-muted-foreground">CTA</Label><Input value={f.cta} onChange={(e) => set("cta", e.target.value)} className="mt-1.5 rounded-xl" /></div>
            <div><Label className="text-xs text-muted-foreground">Posting Time</Label><Input value={f.posting_time} onChange={(e) => set("posting_time", e.target.value)} className="mt-1.5 rounded-xl" placeholder="HH:mm" /></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} className="rounded-full">Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
