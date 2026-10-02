import { CalendarClock, CalendarDays, Clock, ExternalLink, Film, LayoutGrid, Pencil, RefreshCw, Share2 } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, View } from 'react-native';

import { db } from '@/api/base44Client';
import CopyButton from '@/components/CopyButton';
import StatusBadge from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Input, Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Text } from '@/components/ui/text';
import { toast } from '@/components/ui/use-toast';
import CreateVideoButton from '@/components/video/CreateVideoButton';
import { aiService } from '@/services/aiService';
import { platformColor } from '@/services/constants';
import { fmtDate } from '@/services/format';
import { buildComposePath, loadPosts, scheduleCampaignDay } from '@/services/socialService';

const DAY_STATUSES = [
  { value: 'planned', label: 'Planned' },
  { value: 'ready', label: 'Ready' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'processing', label: 'Publishing' },
  { value: 'posted', label: 'Live' },
  { value: 'failed', label: 'Failed' },
  { value: 'skipped', label: 'Skipped' },
];

/** Live countdown to an ISO `scheduled_at` timestamp; ticks every second while mounted. */
export function useCountdown(iso?: string | null) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!iso) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [iso]);

  if (!iso) return { label: '', overdue: false, ms: null as number | null };

  const target = Date.parse(iso);
  if (Number.isNaN(target)) return { label: '', overdue: false, ms: null as number | null };

  const ms = target - now;
  if (ms <= 0) return { label: 'Due — waiting for auto-publish', overdue: true, ms };

  const totalSec = Math.floor(ms / 1000);
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;

  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0 || d > 0) parts.push(`${h}h`);
  parts.push(`${m}m`);
  if (d === 0) parts.push(`${s}s`);

  return { label: `Goes live in ${parts.join(' ')}`, overdue: false, ms };
}

function LinkText({ url, children }: { url: string; children: string }) {
  return (
    <Pressable hitSlop={6} onPress={() => Linking.openURL(url)} className="flex-row items-center gap-1">
      <Text className="text-xs text-primary">{children}</Text>
      <Icon as={ExternalLink} size={12} className="text-primary" />
    </Pressable>
  );
}

function DayScheduleMeta({ day, posts }: { day: any; posts: any[] }) {
  const countdown = useCountdown(day.scheduled_at);
  const live = posts.find((p) => p.status === 'published' && p.externalPermalink);
  const anyPublishing = posts.some((p) => p.status === 'publishing') || day.status === 'processing';
  const anyScheduled = posts.some((p) => p.status === 'scheduled') || day.status === 'scheduled';
  const anyFailed = posts.some((p) => p.status === 'failed') || day.status === 'failed';

  if (live || day.status === 'posted') {
    const liveUrl = live?.externalPermalink || day.live_permalink;
    return (
      <View className="mt-2 flex-row flex-wrap items-center gap-2">
        <StatusBadge status="posted" />
        {liveUrl ? <LinkText url={liveUrl}>Live link</LinkText> : null}
        {posts
          .filter((p) => p.status === 'published')
          .map((p) => (
            <View key={p.id} className="flex-row items-center gap-1 rounded-full border border-border/60 px-2 py-0.5">
              <Text className="text-xs capitalize text-muted-foreground">{p.provider}</Text>
              {p.externalPermalink ? (
                <Pressable hitSlop={6} onPress={() => Linking.openURL(p.externalPermalink)}>
                  <Text className="text-xs text-primary">· open</Text>
                </Pressable>
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
        <ActivityIndicator size="small" />
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
    return (
      <View className="mt-2 gap-1">
        <StatusBadge status="failed" />
        <Text className="text-xs text-destructive/90">{day.publish_error || posts.find((p) => p.errorMessage)?.errorMessage}</Text>
      </View>
    );
  }

  return null;
}

function PillButton({ icon, label, onPress, disabled, loading, variant = 'outline' }: { icon: any; label: string; onPress: () => void; disabled?: boolean; loading?: boolean; variant?: 'outline' | 'default' | 'ghost' }) {
  const primary = variant === 'default';
  return (
    <Button size="sm" variant={variant} className="rounded-full" onPress={onPress} disabled={disabled} loading={loading}>
      {!loading ? <Icon as={icon} size={14} className={primary ? 'text-primary-foreground' : undefined} /> : null}
      <Text className={primary ? 'text-xs font-medium text-primary-foreground' : 'text-xs font-medium'}>{label}</Text>
    </Button>
  );
}

export default function CampaignPlan({ campaign, days, song, onRefresh }: { campaign: any; days: any[]; song: any; onRefresh: () => void }) {
  const router = useRouter();
  const [editing, setEditing] = useState<any>(null);
  const [regenerating, setRegenerating] = useState<string | null>(null);
  const [schedulingId, setSchedulingId] = useState<string | null>(null);
  const [posts, setPosts] = useState<any[]>([]);

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
    const map: Record<string, any[]> = {};
    for (const p of posts) {
      const key = p.campaignDayId || '';
      if (!key) continue;
      if (!map[key]) map[key] = [];
      map[key].push(p);
    }
    return map;
  }, [posts]);

  const setStatus = async (day: any, status: string) => {
    try {
      await db.entities.CampaignDay.update(day.id, { status });
      onRefresh();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Could not update status', description: e?.message });
    }
  };

  const scheduleDay = async (day: any) => {
    setSchedulingId(day.id);
    try {
      const res = await scheduleCampaignDay({ campaignDayId: day.id } as any);
      if (!res?.ok) {
        toast({
          variant: 'destructive',
          title: 'Could not schedule',
          description: res?.error || 'Connect social accounts and try again.',
        });
        return;
      }
      toast({
        title: 'Auto-publish scheduled',
        description: `Worker will publish around ${new Date(res.scheduledAt).toLocaleString()}.`,
      });
      const refreshed = await loadPosts({ campaignId: campaign.id });
      setPosts(refreshed?.posts || []);
      onRefresh();
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: 'Could not schedule',
        description: e?.message || 'Please try again.',
      });
    } finally {
      setSchedulingId(null);
    }
  };

  const regenerateDay = async (day: any) => {
    setRegenerating(day.id);
    try {
      const songData = { ...song, artistName: song?.artistName };
      const platform = day.platform || 'TikTok';
      const [cap, tags, cta] = await Promise.all([
        aiService.generateCaptions({ song: songData, analysis: song?.analysis, platform }),
        aiService.generateHashtags({ song: songData, analysis: song?.analysis, platform }),
        aiService.generateCTA({ song: songData, analysis: song?.analysis, campaignGoals: campaign?.goals }),
      ]);
      const caption = cap.captions?.[0]?.text || day.caption;
      const hashtags = tags.categories?.[0]?.tags?.join(' ') || day.hashtags;
      const ctaText = cta.ctas?.[0]?.text || day.cta;
      await db.entities.CampaignDay.update(day.id, { caption, hashtags, cta: ctaText });
      onRefresh();
    } catch {
      toast({ variant: 'destructive', title: 'Could not regenerate', description: 'Please try again.' });
    } finally {
      setRegenerating(null);
    }
  };

  const openCalendar = () => router.push(`/releases/${campaign.release_id}/calendar` as any);
  const openContent = () => router.push(`/campaigns/${campaign.id}/content` as any);

  if (!days.length) {
    return (
      <View className="gap-3">
        <Text className="text-sm text-muted-foreground">No campaign days yet.</Text>
        <View className="flex-row flex-wrap gap-2">
          {campaign?.release_id ? <PillButton icon={CalendarDays} label="View Calendar" onPress={openCalendar} /> : null}
          <PillButton icon={LayoutGrid} label="View Content" onPress={openContent} />
        </View>
      </View>
    );
  }

  return (
    <View className="gap-3">
      <Text className="text-xs text-muted-foreground">
        Use <Text className="text-xs text-foreground">Schedule auto-publish</Text> to queue Instagram, TikTok, and YouTube. The background worker runs hourly (:38 UTC) and publishes due posts without manual action.
      </Text>
      <View className="flex-row flex-wrap justify-end gap-2">
        {campaign?.release_id ? <PillButton icon={CalendarDays} label="View Calendar" onPress={openCalendar} /> : null}
        <PillButton icon={LayoutGrid} label="View Content" onPress={openContent} />
      </View>
      {days.map((day) => {
        const statusId = DAY_STATUSES.find((s) => s.value === day.status)?.value || 'planned';
        const dayPosts = postsByDay[day.id] || [];
        const canSchedule = !['processing', 'posted'].includes(day.status);
        const color = platformColor(day.platform);
        return (
          <View key={day.id} className="rounded-2xl border border-border/60 bg-card/50 p-4">
            <View className="flex-row items-start justify-between gap-3">
              <View className="flex-1 flex-row items-start gap-3">
                <View className="size-11 items-center justify-center rounded-xl bg-muted/60">
                  <Text className="font-heading-bold text-sm">D{day.day_number}</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-xs text-muted-foreground">{fmtDate(day.date)}</Text>
                  <View className="mt-1 flex-row flex-wrap items-center gap-2">
                    <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: `${color}22` }}>
                      <Text className="text-xs font-semibold" style={{ color }}>
                        {day.platform}
                      </Text>
                    </View>
                    <Text className="text-xs text-muted-foreground">{day.content_type}</Text>
                  </View>
                  <DayScheduleMeta day={day} posts={dayPosts} />
                </View>
              </View>
              <Select className="h-8 w-28 rounded-full" title="Status" value={statusId} onValueChange={(v) => setStatus(day, v)} options={DAY_STATUSES} />
            </View>

            <Text className="mt-3 text-sm font-semibold">{day.objective}</Text>
            {day.hook ? <Text className="mt-1 text-xs text-primary">⚡ {day.hook}</Text> : null}
            {day.video_concept ? <Text className="mt-1 text-xs text-muted-foreground">🎬 {day.video_concept}</Text> : null}

            <View className="mt-3 rounded-xl bg-muted/30 p-3">
              <Text className="text-sm">{day.caption}</Text>
              {day.hashtags ? <Text className="mt-2 text-xs text-primary">{day.hashtags}</Text> : null}
            </View>

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

            <View className="mt-3 flex-row flex-wrap items-center gap-2">
              {canSchedule ? (
                <PillButton
                  variant="default"
                  icon={CalendarClock}
                  label={day.status === 'scheduled' || day.status === 'failed' ? 'Reschedule' : 'Schedule auto-publish'}
                  onPress={() => scheduleDay(day)}
                  disabled={schedulingId === day.id}
                  loading={schedulingId === day.id}
                />
              ) : null}
              <PillButton icon={Pencil} label="Edit" onPress={() => setEditing(day)} />
              <CopyButton text={day.caption} label="Copy Caption" />
              {day.hook ? <CopyButton text={day.hook} label="Copy Hook" /> : null}
              {day.hashtags ? <CopyButton text={day.hashtags} label="Copy Hashtags" /> : null}
              <PillButton icon={LayoutGrid} label="Content" onPress={() => router.push(`/campaigns/${campaign.id}/content?day=${day.id}` as any)} />
              <PillButton
                icon={Share2}
                label="Post now"
                onPress={() => router.push(buildComposePath({ campaignId: campaign.id, campaignDayId: day.id, releaseId: campaign.release_id || '' }) as any)}
              />
              <CreateVideoButton campaignId={campaign.id} dayId={day.id} className="rounded-full">
                <Icon as={Film} size={14} />
                <Text className="text-xs font-medium">Create Video</Text>
              </CreateVideoButton>
              <PillButton variant="ghost" icon={RefreshCw} label="Regenerate" onPress={() => regenerateDay(day)} disabled={regenerating === day.id} loading={regenerating === day.id} />
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </View>
  );
}

function EditDayDialog({ day, onClose, onSaved }: { day: any; onClose: () => void; onSaved: () => void }) {
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({
    caption: day.caption || '',
    hashtags: day.hashtags || '',
    cta: day.cta || '',
    posting_time: day.posting_time || '',
    objective: day.objective || '',
    video_concept: day.video_concept || '',
    hook: day.hook || '',
    platform: day.platform || '',
    content_type: day.content_type || '',
  });
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));
  const save = async () => {
    setSaving(true);
    try {
      await db.entities.CampaignDay.update(day.id, f);
      toast({ title: 'Day updated' });
      onSaved();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Could not save', description: e?.message });
      setSaving(false);
    }
  };
  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      variant="sheet"
      title={`Edit Day ${day.day_number}`}
      footer={
        <>
          <Button variant="ghost" onPress={onClose}>
            Cancel
          </Button>
          <Button className="rounded-full" onPress={save} loading={saving}>
            Save
          </Button>
        </>
      }>
      <View className="gap-4 pb-2">
        <Field label="Platform">
          <Input value={f.platform} onChangeText={(v) => set('platform', v)} className="rounded-xl" />
        </Field>
        <Field label="Content Type">
          <Input value={f.content_type} onChangeText={(v) => set('content_type', v)} className="rounded-xl" />
        </Field>
        <Field label="Objective">
          <Input value={f.objective} onChangeText={(v) => set('objective', v)} className="rounded-xl" />
        </Field>
        <Field label="Hook">
          <Input value={f.hook} onChangeText={(v) => set('hook', v)} className="rounded-xl" />
        </Field>
        <Field label="Video Concept">
          <Input value={f.video_concept} onChangeText={(v) => set('video_concept', v)} className="rounded-xl" />
        </Field>
        <Field label="Caption">
          <Textarea value={f.caption} onChangeText={(v) => set('caption', v)} numberOfLines={4} className="rounded-xl" />
        </Field>
        <Field label="Hashtags">
          <Input value={f.hashtags} onChangeText={(v) => set('hashtags', v)} autoCapitalize="none" className="rounded-xl" />
        </Field>
        <Field label="CTA">
          <Input value={f.cta} onChangeText={(v) => set('cta', v)} className="rounded-xl" />
        </Field>
        <Field label="Posting Time">
          <Input value={f.posting_time} onChangeText={(v) => set('posting_time', v)} placeholder="HH:mm" className="rounded-xl" />
        </Field>
      </View>
    </Dialog>
  );
}
