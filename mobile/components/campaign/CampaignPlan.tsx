// @ts-nocheck
import { View, Text, Pressable, ScrollView, Linking, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from "react";
import { useRouter } from 'expo-router';
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
} from 'lucide-react-native';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Textarea } from '@/components/ui/Textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { useToast } from '@/lib/toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ModalForm';

import { db } from '@/api/db';
import { aiService } from "@/services/aiService";
import { platformColor } from "@/services/constants";
import { fmtDate } from "@/services/format";
import { buildComposePath, loadPosts, scheduleCampaignDay } from "@/services/socialService";
import { useCountdown } from "@/hooks/useCountdown";
import CopyButton from '@/components/CopyButton';
import CreateVideoButton from '@/components/video/CreateVideoButton';
import { StatusBadge } from '@/components/StatusBadge';

const DAY_STATUSES = [
  { id: "planned", label: "Planned", color: "#8b8b9a" },
  { id: "ready", label: "Ready", color: "#3b82f6" },
  { id: "scheduled", label: "Scheduled", color: "#f59e0b" },
  { id: "processing", label: "Publishing", color: "#3b82f6" },
  { id: "posted", label: "Live", color: "#22c55e" },
  { id: "failed", label: "Failed", color: "#ef4444" },
  { id: "skipped", label: "Skipped", color: "#f59e0b" },
];

function DayScheduleMeta({ day, posts }) {
  const countdown = useCountdown(day.scheduled_at);
  const live = posts.find((p) => p.status === "published" && p.externalPermalink);
  const anyPublishing = posts.some((p) => p.status === "publishing") || day.status === "processing";
  const anyScheduled = posts.some((p) => p.status === "scheduled") || day.status === "scheduled";
  const anyFailed = posts.some((p) => p.status === "failed") || day.status === "failed";

  if (live || day.status === "posted") {
    return (
      <View className="mt-2 flex flex-wrap items-center gap-2 text-xs">
        <StatusBadge status="posted" />
        {(live?.externalPermalink || day.live_permalink) && (
          <View
            href={live?.externalPermalink || day.live_permalink}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-primary hover:underline"
          >
            Live link <ExternalLink />
          </View>
        )}
        {posts
          .filter((p) => p.status === "published")
          .map((p) => (
            <View key={p.id} className="rounded-full border border-border/60 px-2 py-0.5 capitalize text-muted-foreground">
              {p.provider}
              {p.externalPermalink ? (
                <>
                  {" · "}
                  <View href={p.externalPermalink} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                    open
                  </View>
                </>
              ) : null}
            </View>
          ))}
      </View>
    );
  }

  if (anyPublishing) {
    return (
      <View className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
        <StatusBadge status="processing" />
        <Loader2 />
        Auto-publishing across connected platforms…
      </View>
    );
  }

  if (anyScheduled && day.scheduled_at) {
    return (
      <View className="mt-2 flex flex-wrap items-center gap-2 text-xs">
        <StatusBadge status="scheduled" />
        <View className="inline-flex items-center gap-1 text-muted-foreground">
          <Clock />
          {countdown.label || new Date(day.scheduled_at).toLocaleString()}
        </View>
      </View>
    );
  }

  if (anyFailed || day.publish_error) {
    return (
      <View className="mt-2 space-y-1 text-xs">
        <StatusBadge status="failed" />
        <View className="text-destructive/90">{day.publish_error || posts.find((p) => p.errorMessage)?.errorMessage}</View>
      </View>
    );
  }

  return null;
}

export default function CampaignPlan({ campaign, days, song, onRefresh }) {
  const router = useRouter();
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
        toast({
          variant: "destructive",
          title: "Could not schedule",
          description: res?.error || "Connect social accounts and try again.",
        });
        return;
      }
      toast({
        title: "Auto-publish scheduled",
        description: `Worker will publish around ${new Date(res.scheduledAt).toLocaleString()}.`,
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
      <View className="space-y-3">
        <View className="text-sm text-muted-foreground">No campaign days yet.</View>
        <View className="flex flex-wrap gap-2">
          {campaign?.release_id && (
            <Button
              variant="outline"
             
              className="rounded-full"
              onPress={() => router.push(`/releases/${campaign.release_id}/calendar`)}
            >
              <CalendarDays /> View Calendar
            </Button>
          )}
          <Button
            variant="outline"
           
            className="rounded-full"
            onPress={() => router.push(`/campaigns/${campaign.id}/content`)}
          >
            <LayoutGrid /> View Content
          </Button>
        </View>
      </View>
    );
  }

  return (
    <View className="space-y-3">
      <View className="text-xs text-muted-foreground">
        Use <View className="text-foreground">Schedule auto-publish</View> to queue Instagram, TikTok, and YouTube.
        The background worker runs hourly (:38 UTC) and publishes due posts without manual action.
      </View>
      {campaign?.release_id && (
        <View className="flex flex-wrap justify-end gap-2">
          <Button
            variant="outline"
           
            className="rounded-full"
            onPress={() => router.push(`/releases/${campaign.release_id}/calendar`)}
          >
            <CalendarDays /> View Calendar
          </Button>
          <Button
            variant="outline"
           
            className="rounded-full"
            onPress={() => router.push(`/campaigns/${campaign.id}/content`)}
          >
            <LayoutGrid /> View Content
          </Button>
        </View>
      )}
      {!campaign?.release_id && (
        <View className="flex justify-end">
          <Button
            variant="outline"
           
            className="rounded-full"
            onPress={() => router.push(`/campaigns/${campaign.id}/content`)}
          >
            <LayoutGrid /> View Content
          </Button>
        </View>
      )}
      {days.map((day) => {
        const sm = DAY_STATUSES.find((s) => s.id === day.status) || DAY_STATUSES[0];
        const dayPosts = postsByDay[day.id] || [];
        const canSchedule = !["processing", "posted"].includes(day.status);
        return (
          <View key={day.id} className="rounded-2xl border border-border/60 bg-card/50 p-4 animate-slide-up">
            <View className="flex items-start justify-between gap-3">
              <View className="flex items-center gap-3">
                <View className="grid h-11 w-11 place-items-center rounded-xl bg-muted/60">
                  <View className="font-heading text-sm font-700">D{day.day_number}</View>
                </View>
                <View>
                  <View className="text-xs text-muted-foreground">{fmtDate(day.date)}</View>
                  <View className="mt-1 flex items-center gap-2">
                    <View className="rounded-full px-2 py-0.5 text-xs font-600" style={{ background: `${platformColor(day.platform)}22`, color: platformColor(day.platform) }}>
                      {day.platform}
                    </View>
                    <View className="text-xs text-muted-foreground">{day.content_type}</View>
                  </View>
                  <DayScheduleMeta day={day} posts={dayPosts} />
                </View>
              </View>
              <Select value={sm.id} onValueChange={(v) => setStatus(day, v)}>
                <SelectTrigger className="h-7 w-32 rounded-full text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DAY_STATUSES.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </View>

            <View className="mt-3 text-sm font-600">{day.objective}</View>
            {day.hook && <View className="mt-1 text-xs text-primary">⚡ {day.hook}</View>}
            {day.video_concept && <View className="mt-1 text-xs text-muted-foreground">🎬 {day.video_concept}</View>}

            <View className="mt-3 rounded-xl bg-muted/30 p-3">
              <View className="text-sm">{day.caption}</View>
              {day.hashtags && <View className="mt-2 text-xs text-primary">{day.hashtags}</View>}
            </View>

            <View className="mt-3 flex flex-wrap items-center gap-2">
              {day.cta && <View className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs text-primary">CTA: {day.cta}</View>}
              {day.posting_time && <View className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Clock />{day.posting_time}</View>}
            </View>

            <View className="mt-3 flex flex-wrap gap-2">
              {canSchedule && (
                <Button
                 
                  onPress={() => scheduleDay(day)}
                  disabled={schedulingId === day.id}
                  className="rounded-full"
                >
                  {schedulingId === day.id ? (
                    <Loader2 />
                  ) : (
                    <CalendarClock />
                  )}
                  {day.status === "scheduled" || day.status === "failed" ? "Reschedule" : "Schedule auto-publish"}
                </Button>
              )}
              <Button variant="outline" onPress={() => setEditing(day)} className="rounded-full"><Pencil />Edit</Button>
              <CopyButton text={day.caption} label="Copy Caption" />
              {day.hook && <CopyButton text={day.hook} label="Copy Hook" />}
              {day.hashtags && <CopyButton text={day.hashtags} label="Copy Hashtags" />}
              <Button variant="outline" onPress={() => router.push(`/campaigns/${campaign.id}/content?day=${day.id}`)} className="rounded-full"><LayoutGrid />Content</Button>
              <Button
                variant="outline"
               
                onPress={() =>
                  router.push(
                    buildComposePath({
                      campaignId: campaign.id,
                      campaignDayId: day.id,
                      releaseId: campaign.release_id || "",
                    })
                  )
                }
                className="rounded-full"
              >
                <Share2 />Post now
              </Button>
              <CreateVideoButton campaignId={campaign.id} dayId={day.id} className="rounded-full"><Film />Create Video</CreateVideoButton>
              <Button variant="ghost" onPress={() => regenerateDay(day)} disabled={regenerating === day.id} className="rounded-full">
                {regenerating === day.id ? <Loader2 /> : <RefreshCw />}Regenerate
              </Button>
            </View>
          </View>
        );
      })}

      {editing && <EditDayDialog day={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); onRefresh(); }} />}
    </View>
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
        <View className="space-y-4">
          <View className="grid grid-cols-2 gap-3">
            <View><Label className="text-xs text-muted-foreground">Platform</Label><Input value={f.platform} onChangeText={(v) => set("platform", v)} className="mt-1.5 rounded-xl" /></View>
            <View><Label className="text-xs text-muted-foreground">Content Type</Label><Input value={f.content_type} onChangeText={(v) => set("content_type", v)} className="mt-1.5 rounded-xl" /></View>
          </View>
          <View><Label className="text-xs text-muted-foreground">Objective</Label><Input value={f.objective} onChangeText={(v) => set("objective", v)} className="mt-1.5 rounded-xl" /></View>
          <View><Label className="text-xs text-muted-foreground">Hook</Label><Input value={f.hook} onChangeText={(v) => set("hook", v)} className="mt-1.5 rounded-xl" /></View>
          <View><Label className="text-xs text-muted-foreground">Video Concept</Label><Input value={f.video_concept} onChangeText={(v) => set("video_concept", v)} className="mt-1.5 rounded-xl" /></View>
          <View><Label className="text-xs text-muted-foreground">Caption</Label><Textarea value={f.caption} onChangeText={(v) => set("caption", v)} rows={4} className="mt-1.5 rounded-xl" /></View>
          <View><Label className="text-xs text-muted-foreground">Hashtags</Label><Input value={f.hashtags} onChangeText={(v) => set("hashtags", v)} className="mt-1.5 rounded-xl" /></View>
          <View className="grid grid-cols-2 gap-3">
            <View><Label className="text-xs text-muted-foreground">CTA</Label><Input value={f.cta} onChangeText={(v) => set("cta", v)} className="mt-1.5 rounded-xl" /></View>
            <View><Label className="text-xs text-muted-foreground">Posting Time</Label><Input value={f.posting_time} onChangeText={(v) => set("posting_time", v)} className="mt-1.5 rounded-xl" placeholder="HH:mm" /></View>
          </View>
        </View>
        <DialogFooter>
          <Button variant="ghost" onPress={onClose}>Cancel</Button>
          <Button onPress={save} className="rounded-full">Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
