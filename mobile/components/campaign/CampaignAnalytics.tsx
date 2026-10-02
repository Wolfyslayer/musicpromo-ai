// @ts-nocheck
import { View, Text, Pressable, ScrollView, Linking, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { db } from '@/api/db';

import { useMemo, useState } from "react";
import { Plus, Loader2, Sparkles, Trash2, BarChart3, TrendingUp, Eye, Heart } from 'lucide-react-native';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ModalForm';
import { useToast } from '@/lib/toast';
import { useAuth } from '@/lib/AuthContext';

import { aiService } from "@/services/aiService";
import { PLATFORMS, CONTENT_TYPES, platformColor } from "@/services/constants";
import { sum, fmtDate, todayISO } from "@/services/format";
import StatCard from '@/components/StatCard';

const CHART_COLORS = ["hsl(265 90% 68%)", "hsl(326 85% 62%)", "hsl(190 90% 55%)", "hsl(43 90% 60%)", "hsl(0 80% 62%)", "hsl(150 70% 50%)"];
const METRICS = ["views", "likes", "comments", "shares", "saves", "followers_gained", "streams", "playlist_adds", "clicks"];

export default function CampaignAnalytics({ campaign, analytics, days, onRefresh }) {
  const [open, setOpen] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [insights, setInsights] = useState(null);
  const { toast } = useToast();

  const totals = useMemo(() => {
    const t = {};
    METRICS.forEach((m) => (t[m] = sum(analytics, m)));
    return t;
  }, [analytics]);

  const byPlatform = useMemo(() => {
    const map = {};
    analytics.forEach((a) => { map[a.platform] = (map[a.platform] || 0) + (a.views || 0); });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [analytics]);

  const byType = useMemo(() => {
    const map = {};
    analytics.forEach((a) => { map[a.content_type || "Other"] = (map[a.content_type || "Other"] || 0) + (a.views || 0); });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [analytics]);

  const engagement = (totals.likes + totals.comments + totals.shares + totals.saves) || 0;

  const analyze = async () => {
    setAnalyzing(true);
    setInsights(null);
    try {
      const res = await aiService.analyzeCampaignPerformance({ campaign, days, analytics });
      setInsights(res);
    } catch (e) {
      toast({ variant: "destructive", title: "Analysis failed", description: e.message });
    } finally {
      setAnalyzing(false);
    }
  };

  const remove = async (id) => {
    await db.entities.AnalyticsEntry.delete(id);
    onRefresh();
  };

  return (
    <View className="space-y-5">
      <View className="flex items-center justify-between">
        <View className="text-sm text-muted-foreground">Manually enter performance data. The app never invents analytics.</View>
        <Button onPress={() => setOpen(true)} className="rounded-full"><Plus />Add Entry</Button>
      </View>

      {/* Totals */}
      <View className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total Views" value={totals.views.toLocaleString()} icon={Eye} />
        <StatCard label="Engagement" value={engagement.toLocaleString()} icon={Heart} accent="accent" />
        <StatCard label="Streams" value={totals.streams.toLocaleString()} icon={TrendingUp} accent="chart-3" />
        <StatCard label="Followers +" value={totals.followers_gained.toLocaleString()} icon={BarChart3} accent="chart-1" />
      </View>

      {analytics.length > 0 && (
        <View className="gap-4">
          <ChartCard title="Views by Platform">
            {byPlatform.map((row) => (
              <View key={row.name} className="mb-2 flex-row items-center justify-between">
                <Text className="text-sm text-foreground">{row.name}</Text>
                <Text className="text-sm text-muted-foreground">{row.value.toLocaleString()}</Text>
              </View>
            ))}
          </ChartCard>
          <ChartCard title="Views by Content Type">
            {byType.map((row, i) => (
              <View key={row.name} className="mb-2 flex-row items-center justify-between">
                <Text className="text-sm text-foreground">{row.name}</Text>
                <Text className="text-sm text-muted-foreground">{row.value.toLocaleString()}</Text>
              </View>
            ))}
          </ChartCard>
        </View>
      )}

      {/* Entries */}
      {analytics.length ? (
        <View className="space-y-2">
          {analytics.map((a) => (
            <View key={a.id} className="flex items-center justify-between rounded-xl border border-border/50 bg-card/40 p-3">
              <View className="flex items-center gap-3">
                <View className="rounded-full px-2 py-0.5 text-xs font-600" style={{ background: `${platformColor(a.platform)}22`, color: platformColor(a.platform) }}>{a.platform}</View>
                <View className="text-xs text-muted-foreground">{a.content_type || "—"} · {fmtDate(a.date)}</View>
              </View>
              <View className="flex items-center gap-3 text-xs text-muted-foreground">
                <View>{(a.views || 0).toLocaleString()} views</View>
                <View>{(a.likes || 0).toLocaleString()} likes</View>
                <View onPress={() => remove(a.id)} className="text-muted-foreground hover:text-destructive"><Trash2 /></View>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <View className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-8 text-center text-sm text-muted-foreground">No analytics entered yet. Add your first entry to start tracking.</View>
      )}

      {/* AI analysis */}
      <View className="rounded-2xl border border-border/60 card-gradient p-5">
        <View className="flex items-center justify-between">
          <View>
            <View className="font-heading font-600">Analyze Campaign</View>
            <View className="text-xs text-muted-foreground">AI reviews your entered data and suggests cautious improvements.</View>
          </View>
          <Button onPress={analyze} disabled={analyzing || analytics.length === 0} className="rounded-full"><Sparkles />{analyzing ? "Analyzing…" : "Analyze"}</Button>
        </View>
        {analyzing && <View className="mt-4 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 /> Reviewing performance…</View>}
        {insights && (
          <View className="mt-4 space-y-4 animate-fade-in">
            <View className="text-sm">{insights.summary}</View>
            <View className="space-y-2">
              {insights.insights?.map((ins, i) => (
                <View key={i} className="rounded-xl bg-muted/30 p-3">
                  <View className="text-sm font-600">{ins.title}</View>
                  <View className="mt-0.5 text-sm text-muted-foreground">{ins.description}</View>
                </View>
              ))}
            </View>
            {insights.recommendations?.length > 0 && (
              <View>
                <View className="mb-2 text-xs font-600 uppercase tracking-wider text-muted-foreground">Recommendations</View>
                <View className="space-y-1.5">
                  {insights.recommendations.map((r, i) => (
                    <View key={i} className="flex gap-2 text-sm text-muted-foreground"><View className="text-primary">•</View>{r}</View>
                  ))}
                </View>
              </View>
            )}
            <View className="text-xs text-muted-foreground/70">Suggestions are based on the data you entered and are not guarantees of future results.</View>
          </View>
        )}
      </View>

      <AddEntryDialog open={open} onClose={() => setOpen(false)} campaign={campaign} onSaved={() => { setOpen(false); onRefresh(); }} />
    </View>
  );
}

function ChartCard({ title, children }) {
  return (
    <View className="rounded-2xl border border-border/60 bg-card/50 p-4">
      <View className="mb-3 text-sm font-600">{title}</View>
      {children}
    </View>
  );
}

function AddEntryDialog({ open, onClose, campaign, onSaved }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [f, setF] = useState({ platform: "TikTok", content_type: "", date: todayISO(), views: 0, likes: 0, comments: 0, shares: 0, saves: 0, followers_gained: 0, streams: 0, playlist_adds: 0, clicks: 0 });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const save = async () => {
    await db.entities.AnalyticsEntry.create({
      ...f,
      campaign_id: campaign.id,
      is_demo: false,
      user_id: user?.id || "",
    });
    toast({ title: "Entry added" });
    onSaved();
  };
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Add Performance Entry</DialogTitle></DialogHeader>
        <View className="space-y-4">
          <View className="grid grid-cols-2 gap-3">
            <View><Label className="text-xs text-muted-foreground">Platform</Label>
              <Select value={f.platform} onValueChange={(v) => set("platform", v)}>
                <SelectTrigger className="mt-1.5 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>{PLATFORMS.map((p) => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}</SelectContent>
              </Select>
            </View>
            <View><Label className="text-xs text-muted-foreground">Content Type</Label>
              <Select value={f.content_type} onValueChange={(v) => set("content_type", v)}>
                <SelectTrigger className="mt-1.5 rounded-xl"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{CONTENT_TYPES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </View>
          </View>
          <View><Label className="text-xs text-muted-foreground">Date</Label><Input type="date" value={f.date} onChangeText={(v) => set("date", v)} className="mt-1.5 rounded-xl" /></View>
          <View className="grid grid-cols-3 gap-3">
            {METRICS.map((m) => (
              <View key={m}>
                <Label className="text-[11px] text-muted-foreground capitalize">{m.replace(/_/g, " ")}</Label>
                <Input type="number" min={0} value={f[m]} onChange={(e) => set(m, Number(e.target.value))} className="mt-1 rounded-lg" />
              </View>
            ))}
          </View>
        </View>
        <DialogFooter>
          <Button variant="ghost" onPress={onClose}>Cancel</Button>
          <Button onPress={save} className="rounded-full">Add Entry</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
