import { useCallback, useState } from "react";
import { Pressable, View, useWindowDimensions } from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { BarChart, LineChart, PieChart } from "@/components/ui/charts";
import { BarChart3, Camera, Disc3, Eye, Heart, Music2, PlayCircle, RefreshCw, TrendingUp, Users } from "lucide-react-native";
import { sum } from "@/services/format";
import { selectAnalyticsWorkspace } from "@/services/studioRecords";
import { useAuth, useWorkspaceRefresh } from "@/lib/AuthContext";
import { useThemeColors } from "@/lib/theme";
import { Screen } from "@/components/Screen";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { toast } from "@/components/ui/toast";
import StatCard from "@/components/StatCard";
import EmptyState from "@/components/EmptyState";

const METRICS = ["views", "likes", "comments", "shares", "saves", "followers_gained", "streams", "playlist_adds", "clicks"];

// lucide-react-native v1 has no brand icons; generic glyphs carry the brand color instead.
const PLATFORM_CARDS = [
  { key: "Instagram", label: "Instagram", icon: Camera, color: "#e1306c" },
  { key: "TikTok", label: "TikTok", icon: Music2, color: "#ff2d55" },
  { key: "YouTube", label: "YouTube", icon: PlayCircle, color: "#ff0000" },
  { key: "Spotify", label: "Spotify", icon: Disc3, color: "#1db954" },
];

const LINE_SERIES = [
  { key: "Instagram", color: "#e1306c" },
  { key: "TikTok", color: "#ff2d55" },
  { key: "YouTube", color: "#ff0000" },
];

const EMPTY = { campaigns: [], analytics: [] };

function normalizePlatform(name) {
  const n = String(name || "").toLowerCase();
  if (n.includes("instagram")) return "Instagram";
  if (n.includes("tiktok")) return "TikTok";
  if (n.includes("youtube") || n.includes("short")) return "YouTube";
  if (n.includes("spotify")) return "Spotify";
  return name || "Other";
}

const shortDate = (d) => (/^\d{4}-\d{2}-\d{2}/.test(String(d)) ? String(d).slice(5, 10) : String(d));

async function loadAnalytics() {
  try {
    return await selectAnalyticsWorkspace();
  } catch (err) {
    console.error("--- ANALYTICS LOAD ERROR ---", err);
    throw err;
  }
}

export default function Analytics() {
  const { user } = useAuth();
  const colors = useThemeColors();
  const { width: screenWidth } = useWindowDimensions();
  const [syncing, setSyncing] = useState(false);

  const query = useQuery({ queryKey: ["analytics-workspace", user?.id], queryFn: loadAnalytics });
  const { refetch } = query;
  const reload = useCallback(() => refetch(), [refetch]);
  useWorkspaceRefresh(reload);

  const loading = query.isLoading;
  const { campaigns, analytics } = query.data || EMPTY;

  const totals = {};
  METRICS.forEach((m) => (totals[m] = sum(analytics, m)));

  const platformViews = {};
  const contentTypeViews = {};
  analytics.forEach((a) => {
    const key = normalizePlatform(a.platform);
    platformViews[key] = (platformViews[key] || 0) + (a.views || 0);
    const type = a.content_type || "Other";
    contentTypeViews[type] = (contentTypeViews[type] || 0) + (a.views || 0);
  });
  const byPlatform = Object.entries(platformViews).map(([name, value]) => ({ name, value }));
  const chartColors = [colors.chart1, colors.chart2, colors.chart3, colors.chart4, colors.chart5, "#26d980"];
  const byContentType = Object.entries(contentTypeViews).map(([name, value], i) => ({
    name,
    value,
    color: chartColors[i % chartColors.length],
  }));

  const platformBreakdown = PLATFORM_CARDS.map((p) => {
    const rows = analytics.filter((a) => normalizePlatform(a.platform) === p.key);
    const views = sum(rows, "views");
    const likes = sum(rows, "likes");
    const comments = sum(rows, "comments");
    const shares = sum(rows, "shares");
    const engagement = likes + comments + shares + sum(rows, "saves");
    const rate = views > 0 ? (engagement / views) * 100 : 0;
    return { ...p, views, likes, comments, shares, engagement, rate, entries: rows.length };
  });

  const byDate = {};
  analytics.forEach((a) => {
    const date = a.date || "unknown";
    if (!byDate[date]) byDate[date] = { date, Instagram: 0, TikTok: 0, YouTube: 0, engagement: 0 };
    const plat = normalizePlatform(a.platform);
    if (plat === "Instagram" || plat === "TikTok" || plat === "YouTube") {
      byDate[date][plat] += Number(a.views || a.streams || 0);
    }
    byDate[date].engagement += Number(a.likes || 0) + Number(a.comments || 0) + Number(a.shares || 0) + Number(a.saves || 0);
  });
  const streamSeries = Object.values(byDate).sort((a, b) => String(a.date).localeCompare(String(b.date)));

  const engagement = totals.likes + totals.comments + totals.shares + totals.saves || 0;
  const syncedCount = analytics.filter((a) => a.source === "synced").length;

  const onSync = async () => {
    setSyncing(true);
    try {
      const res = await refetch();
      if (res.isError) throw res.error;
      toast({
        title: "Analytics refreshed",
        description: "Loaded the latest views, likes, and engagement saved to your account.",
      });
    } catch (err) {
      console.error("--- SOCIAL STATS SYNC ERROR ---", err);
      toast({ variant: "destructive", title: "Sync failed", description: err?.message || "Could not sync platform stats." });
    } finally {
      setSyncing(false);
    }
  };

  const chartWidth = Math.max(160, screenWidth - 32 - 34 - 48);
  const lineSpacing = streamSeries.length > 1 ? Math.max(24, (chartWidth - 20) / (streamSeries.length - 1)) : 40;
  const axisProps = {
    yAxisTextStyle: { color: colors.mutedForeground, fontSize: 10 },
    xAxisLabelTextStyle: { color: colors.mutedForeground, fontSize: 10 },
    rulesColor: colors.border,
    rulesType: "dashed",
    xAxisColor: colors.border,
    yAxisColor: "transparent",
    yAxisLabelWidth: 40,
    noOfSections: 4,
    width: chartWidth,
  };
  const lineData = (key) => streamSeries.map((row) => ({ value: row[key], label: shortDate(row.date) }));

  return (
    <Screen refreshing={query.isRefetching && !syncing} onRefresh={reload} contentClassName="gap-6">
      <View className="gap-3">
        <View>
          <Text className="font-heading text-2xl tracking-tight">Analytics</Text>
          <Text className="mt-1 text-sm text-muted-foreground">
            Live platform stats auto-sync daily via the background worker
            {syncedCount ? ` · ${syncedCount} synced entries` : ""}.
          </Text>
        </View>
        <Button size="sm" variant="outline" icon={RefreshCw} className="self-start rounded-full" onPress={onSync} loading={syncing}>
          {syncing ? "Syncing…" : "Sync from platforms"}
        </Button>
      </View>

      {loading ? (
        <View className="h-40 rounded-2xl bg-muted/40" />
      ) : analytics.length === 0 ? (
        <EmptyState
          icon={BarChart3}
          title="No analytics yet"
          description="Publish short videos from Social Hub — daily sync (or Sync now) fills views and engagement graphs."
          action={
            <View className="flex-row flex-wrap justify-center gap-2">
              <Button variant="outline" className="rounded-full" onPress={onSync}>
                Sync from platforms
              </Button>
              <Button className="rounded-full" onPress={() => router.push("/campaigns")}>
                Go to Campaigns
              </Button>
            </View>
          }
        />
      ) : (
        <>
          <View className="gap-3">
            <View className="flex-row gap-3">
              <StatCard label="Total Views" value={totals.views.toLocaleString()} icon={Eye} />
              <StatCard label="Engagement" value={engagement.toLocaleString()} icon={Heart} accent="accent" />
            </View>
            <View className="flex-row gap-3">
              <StatCard label="Streams" value={totals.streams.toLocaleString()} icon={TrendingUp} accent="chart-3" />
              <StatCard label="Followers +" value={totals.followers_gained.toLocaleString()} icon={Users} accent="chart-1" />
            </View>
          </View>

          <View>
            <SectionLabel>Short video platforms</SectionLabel>
            <View className="gap-3">
              {platformBreakdown.map((p) => {
                const PlatformIcon = p.icon;
                return (
                  <View key={p.key} className="rounded-2xl border border-border/60 bg-card p-4">
                    <View className="mb-3 flex-row items-center gap-2">
                      <View
                        className="h-8 w-8 items-center justify-center rounded-full"
                        style={{ backgroundColor: `${p.color}22` }}
                      >
                        <PlatformIcon size={16} color={p.color} strokeWidth={2} />
                      </View>
                      <View>
                        <Text className="text-sm font-600">{p.label}</Text>
                        <Text className="text-xs text-muted-foreground">{p.entries} entries</Text>
                      </View>
                    </View>
                    <View className="flex-row flex-wrap gap-y-2">
                      <Metric label="Views" value={p.views.toLocaleString()} />
                      <Metric label="Likes" value={p.likes.toLocaleString()} />
                      <Metric label="Engagement" value={p.engagement.toLocaleString()} />
                      <Metric label="Eng. rate" value={`${p.rate.toFixed(1)}%`} />
                    </View>
                  </View>
                );
              })}
            </View>
          </View>

          {streamSeries.length > 0 ? (
            <>
              <ChartCard title="Views over time (side-by-side platforms)">
                <LineChart
                  {...axisProps}
                  data={lineData("Instagram")}
                  data2={lineData("TikTok")}
                  data3={lineData("YouTube")}
                  color1={LINE_SERIES[0].color}
                  color2={LINE_SERIES[1].color}
                  color3={LINE_SERIES[2].color}
                  thickness={2}
                  hideDataPoints
                  curved
                  spacing={lineSpacing}
                  initialSpacing={10}
                  height={200}
                />
                <View className="mt-3 flex-row flex-wrap justify-center gap-4">
                  {LINE_SERIES.map((s) => (
                    <LegendItem key={s.key} color={s.color} label={s.key} />
                  ))}
                </View>
              </ChartCard>
              <ChartCard title="Engagement over time">
                <LineChart
                  {...axisProps}
                  data={lineData("engagement")}
                  color={colors.chart3}
                  thickness={2}
                  hideDataPoints
                  curved
                  spacing={lineSpacing}
                  initialSpacing={10}
                  height={200}
                  areaChart
                  startFillColor={colors.chart3}
                  startOpacity={0.25}
                  endOpacity={0}
                />
              </ChartCard>
            </>
          ) : null}

          <ChartCard title="Views by Platform">
            <BarChart
              {...axisProps}
              data={byPlatform.map((d) => ({ value: d.value, label: d.name }))}
              frontColor={colors.chart1}
              barWidth={Math.min(48, Math.max(20, chartWidth / Math.max(byPlatform.length, 1) / 1.8))}
              spacing={Math.max(16, chartWidth / Math.max(byPlatform.length, 1) / 2.4)}
              initialSpacing={12}
              barBorderTopLeftRadius={6}
              barBorderTopRightRadius={6}
              height={200}
            />
          </ChartCard>

          <ChartCard title="Views by Content Type">
            <View className="items-center">
              <PieChart
                data={byContentType.map((d) => ({ value: d.value || 0.0001, color: d.color }))}
                donut
                radius={85}
                innerRadius={45}
                innerCircleColor={colors.card}
              />
            </View>
            <View className="mt-3 gap-1.5">
              {byContentType.map((d) => (
                <View key={d.name} className="flex-row items-center justify-between">
                  <LegendItem color={d.color} label={d.name} />
                  <Text className="text-xs text-muted-foreground">{d.value.toLocaleString()}</Text>
                </View>
              ))}
            </View>
          </ChartCard>

          <View>
            <SectionLabel>Campaigns</SectionLabel>
            <View className="gap-2">
              {(campaigns || []).map((c) => {
                const entries = analytics.filter((a) => a.campaign_id === c.id);
                const views = sum(entries, "views");
                return (
                  <Pressable
                    key={c.id}
                    onPress={() => router.push(`/campaigns/${c.id}?tab=analytics`)}
                    className="flex-row items-center justify-between gap-3 rounded-xl border border-border/50 bg-card p-3 active:border-primary/40"
                  >
                    <View className="min-w-0 flex-1">
                      <Text className="text-sm font-600" numberOfLines={1}>
                        {c.song?.title || "Untitled"}
                      </Text>
                      <Text className="text-xs text-muted-foreground" numberOfLines={1}>
                        {c.artist?.name} · {entries.length} entries
                      </Text>
                    </View>
                    <Text className="text-sm font-600">{views.toLocaleString()} views</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </>
      )}
    </Screen>
  );
}

function SectionLabel({ children }) {
  return <Text className="mb-3 font-heading text-sm uppercase tracking-wider text-muted-foreground">{children}</Text>;
}

function Metric({ label, value }) {
  return (
    <View className="w-1/2">
      <Text className="text-xs text-muted-foreground">{label}</Text>
      <Text className="text-sm font-600">{value}</Text>
    </View>
  );
}

function LegendItem({ color, label }) {
  return (
    <View className="flex-row items-center gap-1.5">
      <View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
      <Text className="text-xs text-muted-foreground">{label}</Text>
    </View>
  );
}

function ChartCard({ title, children }) {
  return (
    <View className="overflow-hidden rounded-2xl border border-border/60 bg-card p-4">
      <Text className="mb-3 text-sm font-600">{title}</Text>
      {children}
    </View>
  );
}
