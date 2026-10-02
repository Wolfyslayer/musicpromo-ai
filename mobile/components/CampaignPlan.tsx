import { useEffect, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { View } from "react-native";
import { useToast } from "@/components/Toast";
import { Button, Card, Field, Muted, P, SelectField } from "@/components/ui";
import { aiService } from "@/lib/ai";
import { CAMPAIGN_DAY_STATUSES, PLATFORMS } from "@/lib/constants";
import { db } from "@/lib/db";
import { errorMessage, fmtDate } from "@/lib/format";
import { loadPosts, scheduleCampaignDay } from "@/lib/social";
import type { Row } from "@/lib/types";

async function copyText(value: string) {
  const clipboard = (globalThis.navigator as Navigator | undefined)?.clipboard;
  if (!clipboard?.writeText) throw new Error("Copy is available from the text fields.");
  await clipboard.writeText(value);
}

export function CampaignPlan({
  campaign,
  song,
  days,
  onRefresh,
}: {
  campaign: Row;
  song: Row | null;
  days: Row[];
  onRefresh: () => void;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [posts, setPosts] = useState<Row[]>([]);
  const [schedulingId, setSchedulingId] = useState("");
  const [regenerating, setRegenerating] = useState("");
  const [editing, setEditing] = useState<Row | null>(null);

  useEffect(() => {
    if (!campaign?.id) return;
    loadPosts({ campaignId: campaign.id })
      .then((result) => setPosts(result.data?.posts || []))
      .catch(() => setPosts([]));
  }, [campaign?.id, days]);

  const postsByDay = useMemo(() => {
    const map: Record<string, Row[]> = {};
    for (const post of posts) {
      const key = String(post.campaignDayId || "");
      if (!key) continue;
      map[key] = [...(map[key] || []), post];
    }
    return map;
  }, [posts]);

  const scheduleDay = async (day: Row) => {
    setSchedulingId(day.id);
    try {
      const result = await scheduleCampaignDay({ campaignDayId: day.id });
      if (!result.data?.ok) throw new Error(result.data?.error || "Connect social accounts and try again.");
      toast({ title: "Auto-publish scheduled", description: result.data.scheduledAt ? `Worker will publish around ${result.data.scheduledAt}.` : undefined });
      const refreshed = await loadPosts({ campaignId: campaign.id });
      setPosts(refreshed.data?.posts || []);
      onRefresh();
    } catch (err) {
      toast({ title: "Could not schedule", description: errorMessage(err), variant: "destructive" });
    } finally {
      setSchedulingId("");
    }
  };

  const regenerateDay = async (day: Row) => {
    setRegenerating(day.id);
    try {
      const songData = { ...song, artistName: song?.artistName || song?.artist_name };
      const platform = day.platform || "TikTok";
      const [cap, tags, cta] = await Promise.all([
        aiService.generateCaptions({ song: songData, analysis: song?.analysis, platform }),
        aiService.generateHashtags({ song: songData, analysis: song?.analysis, platform }),
        aiService.generateCTA({ song: songData, analysis: song?.analysis, campaignGoals: campaign?.goals }),
      ]);
      await db.entities.CampaignDay.update(day.id, {
        caption: cap?.captions?.[0]?.text || day.caption,
        hashtags: tags?.categories?.[0]?.tags?.join(" ") || day.hashtags,
        cta: cta?.ctas?.[0]?.text || day.cta,
      });
      toast({ title: "Day regenerated" });
      onRefresh();
    } catch (err) {
      toast({ title: "Could not regenerate", description: errorMessage(err), variant: "destructive" });
    } finally {
      setRegenerating("");
    }
  };

  const copy = async (value: string, label: string) => {
    try {
      await copyText(value);
      toast({ title: `${label} copied` });
    } catch (err) {
      toast({ title: "Could not copy", description: errorMessage(err), variant: "destructive" });
    }
  };

  if (!days.length) {
    return (
      <View className="gap-2">
        <Muted>No campaign days yet.</Muted>
        {campaign.release_id ? (
          <Button label="View calendar" variant="outline" onPress={() => router.push(`/releases/${campaign.release_id}/calendar`)} />
        ) : null}
        <Button label="View content" variant="outline" onPress={() => router.push(`/campaigns/${campaign.id}/content`)} />
      </View>
    );
  }

  return (
    <View className="gap-3">
      <Muted>Schedule auto-publish queues Instagram, TikTok, and YouTube. The background worker publishes due posts.</Muted>
      <Button label="View content" variant="outline" onPress={() => router.push(`/campaigns/${campaign.id}/content`)} />
      {campaign.release_id ? (
        <Button label="View calendar" variant="outline" onPress={() => router.push(`/releases/${campaign.release_id}/calendar`)} />
      ) : null}
      {days.map((day) => {
        const dayPosts = postsByDay[day.id] || [];
        const canSchedule = !["processing", "posted"].includes(String(day.status));
        return (
          <Card key={day.id} className="gap-2">
            <View className="flex-row items-center justify-between">
              <P className="font-semibold">
                Day {day.day_number} · {day.platform}
              </P>
              <Muted>{fmtDate(day.date)}</Muted>
            </View>
            <Muted>
              {day.content_type}
              {day.posting_time ? ` · ${day.posting_time}` : ""}
            </Muted>
            <SelectField
              label="Status"
              value={String(day.status || "planned")}
              options={CAMPAIGN_DAY_STATUSES.map((status) => ({ label: status.label, value: status.id }))}
              onChange={(status) => {
                db.entities.CampaignDay.update(day.id, { status }).then(onRefresh).catch((err) => {
                  toast({ title: "Could not update day", description: errorMessage(err), variant: "destructive" });
                });
              }}
            />
            {day.objective ? <P>{day.objective}</P> : null}
            {day.hook ? <Muted>Hook: {day.hook}</Muted> : null}
            {day.video_concept ? <Muted>{day.video_concept}</Muted> : null}
            {day.caption ? <P>{day.caption}</P> : null}
            {day.hashtags ? <Muted>{Array.isArray(day.hashtags) ? day.hashtags.join(" ") : day.hashtags}</Muted> : null}
            {day.cta ? <Muted>CTA: {day.cta}</Muted> : null}
            {dayPosts.length ? <Muted>{dayPosts.length} scheduled post{dayPosts.length === 1 ? "" : "s"}</Muted> : null}
            {canSchedule ? (
              <Button
                label={day.status === "scheduled" || day.status === "failed" ? "Reschedule" : "Schedule auto-publish"}
                loading={schedulingId === day.id}
                onPress={() => scheduleDay(day)}
              />
            ) : null}
            <Button label="Edit day" variant="outline" onPress={() => setEditing(day)} />
            <Button label="Post now" variant="outline" onPress={() => router.push({ pathname: "/social/compose", params: { campaign: campaign.id, day: day.id, release: campaign.release_id || "" } })} />
            <Button
              label="Create video"
              variant="outline"
              onPress={() => router.push({ pathname: `/campaigns/${campaign.id}/video`, params: { day: day.id, text: day.hook || "" } })}
            />
            <Button label="Regenerate copy" variant="ghost" loading={regenerating === day.id} onPress={() => regenerateDay(day)} />
            {day.caption ? <Button label="Copy caption" variant="ghost" onPress={() => copy(String(day.caption), "Caption")} /> : null}
            {day.hook ? <Button label="Copy hook" variant="ghost" onPress={() => copy(String(day.hook), "Hook")} /> : null}
          </Card>
        );
      })}
      {editing ? (
        <EditDay
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

function EditDay({ day, onClose, onSaved }: { day: Row; onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    platform: String(day.platform || ""),
    content_type: String(day.content_type || ""),
    objective: String(day.objective || ""),
    hook: String(day.hook || ""),
    video_concept: String(day.video_concept || ""),
    caption: String(day.caption || ""),
    hashtags: Array.isArray(day.hashtags) ? day.hashtags.join(" ") : String(day.hashtags || ""),
    cta: String(day.cta || ""),
    posting_time: String(day.posting_time || ""),
  });
  const set = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const save = async () => {
    await db.entities.CampaignDay.update(day.id, form);
    toast({ title: "Day updated" });
    onSaved();
  };
  return (
    <Card className="gap-3">
      <P className="font-semibold">Edit day {day.day_number}</P>
      <SelectField label="Platform" value={form.platform} options={PLATFORMS.map((item) => ({ label: item.label, value: item.id }))} onChange={(value) => set("platform", value)} />
      <Field label="Content type" value={form.content_type} onChangeText={(value) => set("content_type", value)} />
      <Field label="Objective" value={form.objective} onChangeText={(value) => set("objective", value)} />
      <Field label="Hook" value={form.hook} onChangeText={(value) => set("hook", value)} />
      <Field label="Video concept" value={form.video_concept} onChangeText={(value) => set("video_concept", value)} />
      <Field label="Caption" value={form.caption} onChangeText={(value) => set("caption", value)} multiline />
      <Field label="Hashtags" value={form.hashtags} onChangeText={(value) => set("hashtags", value)} />
      <Field label="CTA" value={form.cta} onChangeText={(value) => set("cta", value)} />
      <Field label="Posting time" value={form.posting_time} onChangeText={(value) => set("posting_time", value)} placeholder="HH:mm" />
      <Button label="Save day" onPress={save} />
      <Button label="Cancel" variant="outline" onPress={onClose} />
    </Card>
  );
}
