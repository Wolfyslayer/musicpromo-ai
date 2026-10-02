import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import * as WebBrowser from "expo-web-browser";
import {
  CalendarClock,
  CalendarDays,
  Clock,
  ExternalLink,
  Film,
  LayoutGrid,
  Pencil,
  RefreshCw,
  Share2,
} from "lucide-react-native";
import { db } from "@/api/db";
import { useThemeColors } from "@/lib/theme";
import { aiService } from "@/services/aiService";
import { platformColor } from "@/services/constants";
import { fmtDate } from "@/services/format";
import { buildComposePath, loadPosts, scheduleCampaignDay } from "@/services/socialService";
import { useCountdown } from "@/hooks/useCountdown";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Dialog } from "@/components/ui/dialog";
import { Text } from "@/components/ui/text";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import CopyButton from "@/components/CopyButton";
import CreateVideoButton from "@/components/video/CreateVideoButton";
import StatusBadge from "@/components/StatusBadge";

const DAY_STATUSES = [
  { id: "planned", label: "Planned", color: "#8b8b9a" },
  { id: "ready", label: "Ready", color: "#3b82f6" },
  { id: "scheduled", label: "Scheduled", color: "#f59e0b" },
  { id: "processing", label: "Publishing", color: "#3b82f6" },
  { id: "posted", label: "Live", color: "#22c55e" },
  { id: "failed", label: "Failed", color: "#ef4444" },
  { id: "skipped", label: "Skipped", color: "#f59e0b" },
];

const openLink = (url) => {
  if (url) WebBrowser.openBrowserAsync(url).catch(() => {});
};

function DayScheduleMeta({ day, posts }) {
  const countdown = useCountdown(day.scheduled_at);
  const colors = useThemeColors();
  const live = posts.find((p) => p.status === "published" && p.externalPermalink);
  const anyPublishing = posts.some((p) => p.status === "publishing") || day.status === "processing";
  const anyScheduled = posts.some((p) => p.status === "scheduled") || day.status === "scheduled";
  const anyFailed = posts.some((p) => p.status === "failed") || day.status === "failed";

  if (live || day.status === "posted") {
    const liveUrl = live?.externalPermalink || day.live_permalink;
    return (
      <View className="mt-2 flex-row flex-wrap items-center gap-2">
        <StatusBadge status="posted" />
        {liveUrl ? (
          <Pressable onPress={() => openLink(liveUrl)} className="flex-row items-center gap-1">
            <Text className="text-xs text-primary">Live link</Text>
            <Icon as={ExternalLink} size={12} className="text-primary" />
          </Pressable>
        ) : null}
        {posts
          .filter((p) => p.status === "published")
          .map((p) => (
            <View key={p.id} className="flex-row items-center rounded-full border border-border/60 px-2 py-0.5">
              <Text className="text-xs capitalize text-muted-foreground">{p.provider}</Text>
              {p.externalPermalink ? (
                <>
                  <Text className="text-xs text-muted-foreground">{" · "}</Text>
                  <Pressable onPress={() => openLink(p.externalPermalink)}>
                    <Text className="text-xs text-primary">open</Text>
                  </Pressable>
                </>
              ) : null}
            </View>
          ))}
      </View>
    );
  }

  if (anyPublishing) {
    return (
      <View className="mt-2 flex-row flex-wrap items-center gap-2">
        <StatusBadge status="processing" />
        <ActivityIndicator size="small" color={colors.mutedForeground} />
        <Text className="text-xs text-muted-foreground">Auto-publishing across connected platforms…</Text>
      </View>
    );
  }

  if (anyScheduled && day.scheduled_at) {
    return (
      <View className="mt-2 flex-row flex-wrap items-center gap-2">
        <StatusBadge status="scheduled" />
        <View className="flex-row items-center gap-1">
          <Icon as={Clock} size={12} className="text-muted-foreground" />
          <Text className="text-xs text-muted-foreground">{countdown.label || new Date(day.scheduled_at).toLocaleString()}</Text>
        </View>
      </View>
    );
  }

  if (anyFailed || day.publish_error) {
    const message = day.publish_error || posts.find((p) => p.errorMessage)?.errorMessage;
    return (
      <View className="mt-2 gap-1">
        <StatusBadge status="failed" />
        {message ? <Text className="text-xs text-destructive/90">{message}</Text> : null}
      </View>
    );
  }

  return null;
}

export default function CampaignPlan({ campaign, days, song, onRefresh }) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(null);
  const [regenerating, setRegenerating] = useState(null);
  const [schedulingId, setSchedulingId] = useState(null);

  const postsQuery = useQuery({
    queryKey: ["campaignPosts", campaign?.id, days],
    queryFn: async () => {
      try {
        const res = await loadPosts({ campaignId: campaign.id });
        return res?.posts || [];
      } catch {
        return [];
      }
    },
    enabled: Boolean(campaign?.id),
  });
  const posts = postsQuery.data;

  const postsByDay = useMemo(() => {
    const map = {};
    for (const p of posts || []) {
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
      await postsQuery.refetch();
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
    } catch {
      // keep simple
    } finally {
      setRegenerating(null);
    }
  };

  const calendarButton = campaign?.release_id ? (
    <Button
      variant="outline"
      size="sm"
      icon={CalendarDays}
      className="rounded-full"
      onPress={() => router.push(`/releases/${campaign.release_id}/calendar`)}
    >
      View Calendar
    </Button>
  ) : null;
  const contentButton = (
    <Button
      variant="outline"
      size="sm"
      icon={LayoutGrid}
      className="rounded-full"
      onPress={() => router.push(`/campaigns/${campaign.id}/content`)}
    >
      View Content
    </Button>
  );

  if (!days.length) {
    return (
      <View className="gap-3">
        <Text className="text-sm text-muted-foreground">No campaign days yet.</Text>
        <View className="flex-row flex-wrap gap-2">
          {calendarButton}
          {contentButton}
        </View>
      </View>
    );
  }

  return (
    <View className="gap-3">
      <Text className="text-xs text-muted-foreground">
        Use <Text className="text-xs text-foreground">Schedule auto-publish</Text> to queue Instagram, TikTok, and YouTube.
        The background worker runs hourly (:38 UTC) and publishes due posts without manual action.
      </Text>
      <View className="flex-row flex-wrap justify-end gap-2">
        {calendarButton}
        {contentButton}
      </View>

      {days.map((day) => {
        const sm = DAY_STATUSES.find((s) => s.id === day.status) || DAY_STATUSES[0];
        const dayPosts = postsByDay[day.id] || [];
        const canSchedule = !["processing", "posted"].includes(day.status);
        const pColor = platformColor(day.platform);
        return (
          <View key={day.id} className="rounded-2xl border border-border/60 bg-card/50 p-4">
            <View className="flex-row items-start justify-between gap-3">
              <View className="min-w-0 flex-1 flex-row items-start gap-3">
                <View className="h-11 w-11 items-center justify-center rounded-xl bg-muted/60">
                  <Text className="font-heading text-sm">D{day.day_number}</Text>
                </View>
                <View className="min-w-0 flex-1">
                  <Text className="text-xs text-muted-foreground">{fmtDate(day.date)}</Text>
                  <View className="mt-1 flex-row flex-wrap items-center gap-2">
                    {day.platform ? (
                      <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: `${pColor}22` }}>
                        <Text className="text-xs font-600" style={{ color: pColor }}>
                          {day.platform}
                        </Text>
                      </View>
                    ) : null}
                    {day.content_type ? <Text className="text-xs text-muted-foreground">{day.content_type}</Text> : null}
                  </View>
                  <DayScheduleMeta day={day} posts={dayPosts} />
                </View>
              </View>
              <Select
                value={sm.id}
                onValueChange={(v) => setStatus(day, v)}
                options={DAY_STATUSES.map((s) => ({ value: s.id, label: s.label }))}
                title="Day status"
                className="h-8 w-32 rounded-full"
              />
            </View>

            {day.objective ? <Text className="mt-3 text-sm font-600">{day.objective}</Text> : null}
            {day.hook ? <Text className="mt-1 text-xs text-primary">⚡ {day.hook}</Text> : null}
            {day.video_concept ? <Text className="mt-1 text-xs text-muted-foreground">🎬 {day.video_concept}</Text> : null}

            <View className="mt-3 rounded-xl bg-muted/30 p-3">
              <Text className="text-sm">{day.caption || ""}</Text>
              {day.hashtags ? <Text className="mt-2 text-xs text-primary">{day.hashtags}</Text> : null}
            </View>

            {day.cta || day.posting_time ? (
              <View className="mt-3 flex-row flex-wrap items-center gap-2">
                {day.cta ? (
                  <View className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1">
                    <Text className="text-xs text-primary">CTA: {day.cta}</Text>
                  </View>
                ) : null}
                {day.posting_time ? (
                  <View className="flex-row items-center gap-1">
                    <Icon as={Clock} size={12} className="text-muted-foreground" />
                    <Text className="text-xs text-muted-foreground">{day.posting_time}</Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            <View className="mt-3 flex-row flex-wrap gap-2">
              {canSchedule ? (
                <Button
                  size="sm"
                  onPress={() => scheduleDay(day)}
                  loading={schedulingId === day.id}
                  icon={CalendarClock}
                  className="rounded-full"
                >
                  {day.status === "scheduled" || day.status === "failed" ? "Reschedule" : "Schedule auto-publish"}
                </Button>
              ) : null}
              <Button variant="outline" size="sm" icon={Pencil} onPress={() => setEditing(day)} className="rounded-full">
                Edit
              </Button>
              <CopyButton text={day.caption} label="Copy Caption" />
              {day.hook ? <CopyButton text={day.hook} label="Copy Hook" /> : null}
              {day.hashtags ? <CopyButton text={day.hashtags} label="Copy Hashtags" /> : null}
              <Button
                variant="outline"
                size="sm"
                icon={LayoutGrid}
                onPress={() => router.push(`/campaigns/${campaign.id}/content?day=${day.id}`)}
                className="rounded-full"
              >
                Content
              </Button>
              <Button
                variant="outline"
                size="sm"
                icon={Share2}
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
                Post now
              </Button>
              <CreateVideoButton campaignId={campaign.id} dayId={day.id} icon={Film} className="rounded-full">
                Create Video
              </CreateVideoButton>
              <Button
                variant="ghost"
                size="sm"
                icon={RefreshCw}
                onPress={() => regenerateDay(day)}
                loading={regenerating === day.id}
                className="rounded-full"
              >
                Regenerate
              </Button>
            </View>
          </View>
        );
      })}

      {editing ? (
        <EditDayDialog
          day={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            onRefresh();
          }}
        />
      ) : null}
    </View>
  );
}

function EditDayDialog({ day, onClose, onSaved }) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState(() => ({
    caption: day.caption || "",
    hashtags: day.hashtags || "",
    cta: day.cta || "",
    posting_time: day.posting_time || "",
    objective: day.objective || "",
    video_concept: day.video_concept || "",
    hook: day.hook || "",
    platform: day.platform || "",
    content_type: day.content_type || "",
  }));
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const save = async () => {
    setSaving(true);
    try {
      await db.entities.CampaignDay.update(day.id, f);
      toast({ title: "Day updated" });
      onSaved();
    } catch (e) {
      toast({ variant: "destructive", title: "Could not save", description: e?.message });
    } finally {
      setSaving(false);
    }
  };

  const field = (key, label, props = {}) => (
    <View className="flex-1 gap-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input value={f[key]} onChangeText={(v) => set(key, v)} {...props} />
    </View>
  );

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={`Edit Day ${day.day_number}`}
      footer={
        <>
          <Button variant="ghost" onPress={onClose}>
            Cancel
          </Button>
          <Button onPress={save} loading={saving} className="rounded-full">
            Save
          </Button>
        </>
      }
    >
      <View className="flex-row gap-3">
        {field("platform", "Platform")}
        {field("content_type", "Content Type")}
      </View>
      {field("objective", "Objective")}
      {field("hook", "Hook")}
      {field("video_concept", "Video Concept")}
      <View className="gap-1.5">
        <Label className="text-xs text-muted-foreground">Caption</Label>
        <Textarea value={f.caption} onChangeText={(v) => set("caption", v)} numberOfLines={4} />
      </View>
      {field("hashtags", "Hashtags", { autoCapitalize: "none" })}
      <View className="flex-row gap-3">
        {field("cta", "CTA")}
        {field("posting_time", "Posting Time", { placeholder: "HH:mm", autoCapitalize: "none" })}
      </View>
    </Dialog>
  );
}
