import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, useWindowDimensions, View } from "react-native";
import { BarChart, PieChart } from "@/components/ui/charts";
import { BarChart3, Eye, Heart, Plus, Sparkles, Trash2, TrendingUp } from "lucide-react-native";
import { db } from "@/api/db";
import { useAuth } from "@/lib/AuthContext";
import { useThemeColors } from "@/lib/theme";
import { aiService } from "@/services/aiService";
import { CONTENT_TYPES, PLATFORMS, platformColor } from "@/services/constants";
import { fmtDate, sum, todayISO } from "@/services/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Dialog } from "@/components/ui/dialog";
import { Text } from "@/components/ui/text";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import StatCard from "@/components/StatCard";

const METRICS = ["views", "likes", "comments", "shares", "saves", "followers_gained", "streams", "playlist_adds", "clicks"];

export default function CampaignAnalytics({ campaign, analytics, days, onRefresh }) {
  const [open, setOpen] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [insights, setInsights] = useState(null);
  const { toast } = useToast();
  const colors = useThemeColors();
  const { width: screenWidth } = useWindowDimensions();
  const chartColors = [colors.chart1, colors.chart2, colors.chart3, colors.chart4, colors.chart5, "#26D97F"];

  const totals = useMemo(() => {
    const t = {};
    METRICS.forEach((m) => (t[m] = sum(analytics, m)));
    return t;
  }, [analytics]);

  const byPlatform = useMemo(() => {
    const map = {};
    analytics.forEach((a) => {
      map[a.platform] = (map[a.platform] || 0) + (a.views || 0);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [analytics]);

  const byType = useMemo(() => {
    const map = {};
    analytics.forEach((a) => {
      map[a.content_type || "Other"] = (map[a.content_type || "Other"] || 0) + (a.views || 0);
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

  const chartWidth = screenWidth - 110;
  const barWidth = Math.max(16, Math.min(48, chartWidth / Math.max(1, byPlatform.length) - 18));
  const axisText = { color: colors.mutedForeground, fontSize: 10 };

  return (
    <View className="gap-5">
      <View className="gap-3">
        <Text className="text-sm text-muted-foreground">Manually enter performance data. The app never invents analytics.</Text>
        <Button onPress={() => setOpen(true)} icon={Plus} className="self-start rounded-full">
          Add Entry
        </Button>
      </View>

      <View className="gap-3">
        <View className="flex-row gap-3">
          <StatCard label="Total Views" value={totals.views.toLocaleString()} icon={Eye} />
          <StatCard label="Engagement" value={engagement.toLocaleString()} icon={Heart} accent="accent" />
        </View>
        <View className="flex-row gap-3">
          <StatCard label="Streams" value={totals.streams.toLocaleString()} icon={TrendingUp} accent="chart-3" />
          <StatCard label="Followers +" value={totals.followers_gained.toLocaleString()} icon={BarChart3} accent="chart-1" />
        </View>
      </View>

      {analytics.length > 0 ? (
        <View className="gap-4">
          <ChartCard title="Views by Platform">
            <BarChart
              data={byPlatform.map((d) => ({ value: d.value, label: d.name, frontColor: colors.primary }))}
              barWidth={barWidth}
              spacing={18}
              roundedTop
              barBorderTopLeftRadius={6}
              barBorderTopRightRadius={6}
              width={chartWidth}
              height={180}
              noOfSections={4}
              yAxisTextStyle={axisText}
              xAxisLabelTextStyle={axisText}
              rulesColor={colors.border}
              xAxisColor={colors.border}
              yAxisColor={colors.border}
              yAxisThickness={0}
              xAxisThickness={0}
              yAxisLabelWidth={36}
              isAnimated
            />
          </ChartCard>
          <ChartCard title="Views by Content Type">
            <View className="items-center">
              <PieChart
                data={byType.map((d, i) => ({ value: d.value, color: chartColors[i % chartColors.length] }))}
                donut
                radius={80}
                innerRadius={40}
                innerCircleColor={colors.card}
              />
            </View>
            <View className="mt-3 flex-row flex-wrap justify-center gap-3">
              {byType.map((d, i) => (
                <View key={d.name} className="flex-row items-center gap-1.5">
                  <View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: chartColors[i % chartColors.length] }} />
                  <Text className="text-xs text-muted-foreground">
                    {d.name} · {d.value.toLocaleString()}
                  </Text>
                </View>
              ))}
            </View>
          </ChartCard>
        </View>
      ) : null}

      {analytics.length ? (
        <View className="gap-2">
          {analytics.map((a) => (
            <View key={a.id} className="gap-2 rounded-xl border border-border/50 bg-card/40 p-3">
              <View className="flex-row items-center justify-between gap-3">
                <View className="min-w-0 flex-1 flex-row items-center gap-3">
                  <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: `${platformColor(a.platform)}22` }}>
                    <Text className="text-xs font-600" style={{ color: platformColor(a.platform) }}>
                      {a.platform}
                    </Text>
                  </View>
                  <Text className="shrink text-xs text-muted-foreground" numberOfLines={1}>
                    {a.content_type || "—"} · {fmtDate(a.date)}
                  </Text>
                </View>
                <Pressable onPress={() => remove(a.id)} hitSlop={8} accessibilityLabel="Delete entry">
                  <Icon as={Trash2} size={16} className="text-muted-foreground" />
                </Pressable>
              </View>
              <View className="flex-row gap-3">
                <Text className="text-xs text-muted-foreground">{(a.views || 0).toLocaleString()} views</Text>
                <Text className="text-xs text-muted-foreground">{(a.likes || 0).toLocaleString()} likes</Text>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <View className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-8">
          <Text className="text-center text-sm text-muted-foreground">
            No analytics entered yet. Add your first entry to start tracking.
          </Text>
        </View>
      )}

      <View className="gap-3 rounded-2xl border border-border/60 bg-card p-5">
        <View className="flex-row items-center justify-between gap-3">
          <View className="flex-1">
            <Text className="font-heading-medium text-base">Analyze Campaign</Text>
            <Text className="text-xs text-muted-foreground">AI reviews your entered data and suggests cautious improvements.</Text>
          </View>
          <Button onPress={analyze} disabled={analyzing || analytics.length === 0} icon={Sparkles} className="rounded-full">
            {analyzing ? "Analyzing…" : "Analyze"}
          </Button>
        </View>
        {analyzing ? (
          <View className="mt-1 flex-row items-center gap-2">
            <ActivityIndicator size="small" color={colors.primary} />
            <Text className="text-sm text-muted-foreground">Reviewing performance…</Text>
          </View>
        ) : null}
        {insights ? (
          <View className="mt-1 gap-4">
            {insights.summary ? <Text className="text-sm">{insights.summary}</Text> : null}
            <View className="gap-2">
              {insights.insights?.map((ins, i) => (
                <View key={i} className="rounded-xl bg-muted/30 p-3">
                  <Text className="text-sm font-600">{ins.title}</Text>
                  <Text className="mt-0.5 text-sm text-muted-foreground">{ins.description}</Text>
                </View>
              ))}
            </View>
            {insights.recommendations?.length > 0 ? (
              <View>
                <Text className="mb-2 text-xs font-600 uppercase tracking-wider text-muted-foreground">Recommendations</Text>
                <View className="gap-1.5">
                  {insights.recommendations.map((r, i) => (
                    <View key={i} className="flex-row gap-2">
                      <Text className="text-sm text-primary">•</Text>
                      <Text className="flex-1 text-sm text-muted-foreground">{r}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
            <Text className="text-xs text-muted-foreground/70">
              Suggestions are based on the data you entered and are not guarantees of future results.
            </Text>
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

function ChartCard({ title, children }) {
  return (
    <View className="overflow-hidden rounded-2xl border border-border/60 bg-card/50 p-4">
      <Text className="mb-3 text-sm font-600">{title}</Text>
      {children}
    </View>
  );
}

const initialEntry = () => ({
  platform: "TikTok",
  content_type: "",
  date: todayISO(),
  ...Object.fromEntries(METRICS.map((m) => [m, "0"])),
});

function AddEntryDialog({ open, onClose, campaign, onSaved }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [f, setF] = useState(initialEntry);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      await db.entities.AnalyticsEntry.create({
        ...f,
        ...Object.fromEntries(METRICS.map((m) => [m, Number(f[m]) || 0])),
        campaign_id: campaign.id,
        is_demo: false,
        user_id: user?.id || "",
      });
      toast({ title: "Entry added" });
      onSaved();
    } catch (e) {
      toast({ variant: "destructive", title: "Could not add entry", description: e?.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
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
      }
    >
      <View className="flex-row gap-3">
        <View className="flex-1 gap-1.5">
          <Label className="text-xs text-muted-foreground">Platform</Label>
          <Select
            value={f.platform}
            onValueChange={(v) => set("platform", v)}
            options={PLATFORMS.map((p) => ({ value: p.id, label: p.label }))}
            title="Platform"
          />
        </View>
        <View className="flex-1 gap-1.5">
          <Label className="text-xs text-muted-foreground">Content Type</Label>
          <Select
            value={f.content_type}
            onValueChange={(v) => set("content_type", v)}
            options={CONTENT_TYPES}
            placeholder="Select"
            title="Content Type"
          />
        </View>
      </View>
      <View className="gap-1.5">
        <Label className="text-xs text-muted-foreground">Date</Label>
        <Input value={f.date} onChangeText={(v) => set("date", v)} placeholder="YYYY-MM-DD" autoCapitalize="none" />
      </View>
      <View className="flex-row flex-wrap gap-3">
        {METRICS.map((m) => (
          <View key={m} className="w-[30%] grow gap-1">
            <Label className="text-[11px] capitalize text-muted-foreground">{m.replace(/_/g, " ")}</Label>
            <Input
              value={String(f[m])}
              onChangeText={(v) => set(m, v.replace(/[^0-9]/g, ""))}
              keyboardType="numeric"
              className="rounded-lg"
            />
          </View>
        ))}
      </View>
    </Dialog>
  );
}
