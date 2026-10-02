import { BarChart3, Eye, Heart, Plus, Sparkles, TrendingUp, Trash2 } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { db } from '@/api/base44Client';
import BarChartCard from '@/components/charts/BarChartCard';
import PieChartCard from '@/components/charts/PieChartCard';
import StatCard from '@/components/StatCard';
import { Button } from '@/components/ui/button';
import { DateField } from '@/components/ui/date-field';
import { Dialog } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Text } from '@/components/ui/text';
import { toast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';
import { aiService } from '@/services/aiService';
import { CONTENT_TYPES, PLATFORMS, platformColor } from '@/services/constants';
import { fmtDate, sum, todayISO } from '@/services/format';

const METRICS = ['views', 'likes', 'comments', 'shares', 'saves', 'followers_gained', 'streams', 'playlist_adds', 'clicks'];

export default function CampaignAnalytics({ campaign, analytics, days, onRefresh }: { campaign: any; analytics: any[]; days?: any[]; onRefresh: () => void }) {
  const [open, setOpen] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [insights, setInsights] = useState<any>(null);

  const totals = useMemo(() => {
    const t: Record<string, number> = {};
    METRICS.forEach((m) => (t[m] = sum(analytics, m)));
    return t;
  }, [analytics]);

  const byPlatform = useMemo(() => {
    const map: Record<string, number> = {};
    analytics.forEach((a) => {
      map[a.platform] = (map[a.platform] || 0) + (a.views || 0);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [analytics]);

  const byType = useMemo(() => {
    const map: Record<string, number> = {};
    analytics.forEach((a) => {
      map[a.content_type || 'Other'] = (map[a.content_type || 'Other'] || 0) + (a.views || 0);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [analytics]);

  const engagement = totals.likes + totals.comments + totals.shares + totals.saves || 0;

  const analyze = async () => {
    setAnalyzing(true);
    setInsights(null);
    try {
      const res = await aiService.analyzeCampaignPerformance({ campaign, days, analytics });
      setInsights(res);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Analysis failed', description: e.message });
    } finally {
      setAnalyzing(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await db.entities.AnalyticsEntry.delete(id);
      onRefresh();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Could not delete entry', description: e?.message });
    }
  };

  return (
    <View className="gap-5">
      <View className="gap-3">
        <Text className="text-sm text-muted-foreground">Manually enter performance data. The app never invents analytics.</Text>
        <Button onPress={() => setOpen(true)} className="self-start rounded-full">
          <Icon as={Plus} size={16} className="text-primary-foreground" />
          <Text className="text-sm font-medium text-primary-foreground">Add Entry</Text>
        </Button>
      </View>

      <View className="flex-row flex-wrap gap-3">
        <StatCard className="min-w-[44%] flex-1" label="Total Views" value={totals.views.toLocaleString()} icon={Eye} />
        <StatCard className="min-w-[44%] flex-1" label="Engagement" value={engagement.toLocaleString()} icon={Heart} accent="accent" />
        <StatCard className="min-w-[44%] flex-1" label="Streams" value={totals.streams.toLocaleString()} icon={TrendingUp} accent="chart-3" />
        <StatCard className="min-w-[44%] flex-1" label="Followers +" value={totals.followers_gained.toLocaleString()} icon={BarChart3} accent="chart-1" />
      </View>

      {analytics.length > 0 ? (
        <View className="gap-4">
          <BarChartCard title="Views by Platform" data={byPlatform} height={180} />
          <PieChartCard title="Views by Content Type" data={byType} radius={80} />
        </View>
      ) : null}

      {analytics.length ? (
        <View className="gap-2">
          {analytics.map((a) => {
            const color = platformColor(a.platform);
            return (
              <View key={a.id} className="gap-2 rounded-xl border border-border/50 bg-card/40 p-3">
                <View className="flex-row items-center justify-between gap-2">
                  <View className="flex-1 flex-row flex-wrap items-center gap-2">
                    <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: `${color}22` }}>
                      <Text className="text-xs font-semibold" style={{ color }}>
                        {a.platform}
                      </Text>
                    </View>
                    <Text className="text-xs text-muted-foreground">
                      {a.content_type || '—'} · {fmtDate(a.date)}
                    </Text>
                  </View>
                  <Pressable hitSlop={10} onPress={() => remove(a.id)} accessibilityLabel="Delete entry">
                    <Icon as={Trash2} size={16} className="text-muted-foreground" />
                  </Pressable>
                </View>
                <View className="flex-row gap-3">
                  <Text className="text-xs text-muted-foreground">{(a.views || 0).toLocaleString()} views</Text>
                  <Text className="text-xs text-muted-foreground">{(a.likes || 0).toLocaleString()} likes</Text>
                </View>
              </View>
            );
          })}
        </View>
      ) : (
        <Text className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-8 text-center text-sm text-muted-foreground">
          No analytics entered yet. Add your first entry to start tracking.
        </Text>
      )}

      <View className="rounded-2xl border border-border/60 bg-card p-5">
        <View className="gap-3">
          <View>
            <Text className="font-heading">Analyze Campaign</Text>
            <Text className="text-xs text-muted-foreground">AI reviews your entered data and suggests cautious improvements.</Text>
          </View>
          <Button onPress={analyze} disabled={analyzing || analytics.length === 0} className="self-start rounded-full">
            <Icon as={Sparkles} size={16} className="text-primary-foreground" />
            <Text className="text-sm font-medium text-primary-foreground">{analyzing ? 'Analyzing…' : 'Analyze'}</Text>
          </Button>
        </View>
        {analyzing ? (
          <View className="mt-4 flex-row items-center gap-2">
            <ActivityIndicator size="small" />
            <Text className="text-sm text-muted-foreground">Reviewing performance…</Text>
          </View>
        ) : null}
        {insights ? (
          <View className="mt-4 gap-4">
            <Text className="text-sm">{insights.summary}</Text>
            <View className="gap-2">
              {insights.insights?.map((ins: any, i: number) => (
                <View key={i} className="rounded-xl bg-muted/30 p-3">
                  <Text className="text-sm font-semibold">{ins.title}</Text>
                  <Text className="mt-0.5 text-sm text-muted-foreground">{ins.description}</Text>
                </View>
              ))}
            </View>
            {insights.recommendations?.length > 0 ? (
              <View>
                <Text className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recommendations</Text>
                <View className="gap-1.5">
                  {insights.recommendations.map((r: string, i: number) => (
                    <View key={i} className="flex-row gap-2">
                      <Text className="text-sm text-primary">•</Text>
                      <Text className="flex-1 text-sm text-muted-foreground">{r}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
            <Text className="text-xs text-muted-foreground/70">Suggestions are based on the data you entered and are not guarantees of future results.</Text>
          </View>
        ) : null}
      </View>

      <AddEntryDialog
        open={open}
        onClose={() => setOpen(false)}
        campaign={campaign}
        onSaved={() => {
          setOpen(false);
          onRefresh();
        }}
      />
    </View>
  );
}

function AddEntryDialog({ open, onClose, campaign, onSaved }: { open: boolean; onClose: () => void; campaign: any; onSaved: () => void }) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState<Record<string, any>>({
    platform: 'TikTok',
    content_type: '',
    date: todayISO(),
    ...Object.fromEntries(METRICS.map((m) => [m, '0'])),
  });
  const set = (k: string, v: any) => setF((p) => ({ ...p, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      const metrics = Object.fromEntries(METRICS.map((m) => [m, Math.max(0, Number(f[m]) || 0)]));
      await db.entities.AnalyticsEntry.create({
        platform: f.platform,
        content_type: f.content_type,
        date: f.date,
        ...metrics,
        campaign_id: campaign.id,
        is_demo: false,
        user_id: user?.id || '',
      });
      toast({ title: 'Entry added' });
      onSaved();
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Could not add entry', description: e?.message || 'Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      variant="sheet"
      title="Add Performance Entry"
      footer={
        <>
          <Button variant="ghost" onPress={onClose}>
            Cancel
          </Button>
          <Button onPress={save} loading={saving} className="rounded-full">
            Add Entry
          </Button>
        </>
      }>
      <View className="gap-4 pb-2">
        <View>
          <Label className="text-xs text-muted-foreground">Platform</Label>
          <Select value={f.platform} onValueChange={(v) => set('platform', v)} options={PLATFORMS.map((p: any) => ({ value: p.id, label: p.label }))} title="Platform" className="rounded-xl" />
        </View>
        <View>
          <Label className="text-xs text-muted-foreground">Content Type</Label>
          <Select value={f.content_type} onValueChange={(v) => set('content_type', v)} options={CONTENT_TYPES} placeholder="Select" title="Content Type" className="rounded-xl" />
        </View>
        <View>
          <Label className="text-xs text-muted-foreground">Date</Label>
          <DateField value={f.date} onChange={(v) => set('date', v)} className="rounded-xl" />
        </View>
        <View className="flex-row flex-wrap gap-3">
          {METRICS.map((m) => (
            <View key={m} className="w-[30%] flex-grow">
              <Label className="text-[11px] capitalize text-muted-foreground">{m.replace(/_/g, ' ')}</Label>
              <Input
                keyboardType="number-pad"
                value={String(f[m])}
                onChangeText={(t) => set(m, t.replace(/[^0-9]/g, ''))}
                selectTextOnFocus
                className="rounded-lg"
              />
            </View>
          ))}
        </View>
      </View>
    </Dialog>
  );
}
