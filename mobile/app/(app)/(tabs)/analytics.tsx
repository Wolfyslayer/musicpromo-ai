import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { SeriesChart, ShareChart } from "@/components/AnalyticsCharts";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import { ViewsChart } from "@/components/ViewsChart";
import { Button, Card, Empty, H1, Muted, P, Screen } from "@/components/ui";
import { errorMessage, sum } from "@/lib/format";
import { selectAnalyticsWorkspace, syncSocialStats } from "@/lib/social";
import type { Row } from "@/lib/types";

const PLATFORM_CARDS = [
  { key: "Instagram", color: "#e1306c" },
  { key: "TikTok", color: "#ff2d55" },
  { key: "YouTube", color: "#ff0000" },
  { key: "Spotify", color: "#1db954" },
];

function normalizePlatform(name?: string) {
  const value = String(name || "").toLowerCase();
  if (value.includes("instagram")) return "Instagram";
  if (value.includes("tiktok")) return "TikTok";
  if (value.includes("youtube") || value.includes("short")) return "YouTube";
  if (value.includes("spotify")) return "Spotify";
  return name || "Other";
}

export default function Analytics() {
  const router = useRouter();
  const { refreshKey } = useAuth();
  const { toast } = useToast();
  const [campaigns, setCampaigns] = useState<Row[] | null>(null);
  const [analytics, setAnalytics] = useState<Row[]>([]);
  const [error, setError] = useState("");
  const [syncing, setSyncing] = useState(false);

  const reload = useCallback(() => {
    setError("");
    return selectAnalyticsWorkspace()
      .then((workspace) => {
        setCampaigns(workspace.campaigns);
        setAnalytics(workspace.analytics);
      })
      .catch((err) => {
        setCampaigns([]);
        setAnalytics([]);
        setError(errorMessage(err));
        throw err;
      });
  }, []);

  useEffect(() => {
    reload().catch(() => {});
  }, [reload, refreshKey]);

  const totals = useMemo(() => {
    const engagement = sum(analytics, "likes") + sum(analytics, "comments") + sum(analytics, "shares") + sum(analytics, "saves");
    return {
      views: sum(analytics, "views"),
      engagement,
      streams: sum(analytics, "streams"),
      followers: sum(analytics, "followers_gained"),
    };
  }, [analytics]);

  const byPlatform = useMemo(() => {
    const map: Record<string, number> = {};
    analytics.forEach((row) => {
      const key = normalizePlatform(row.platform);
      map[key] = (map[key] || 0) + (Number(row.views) || 0);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [analytics]);

  const byContentType = useMemo(() => {
    const map: Record<string, number> = {};
    analytics.forEach((row) => {
      const key = String(row.content_type || "Other");
      map[key] = (map[key] || 0) + (Number(row.views) || 0);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [analytics]);

  const platformBreakdown = useMemo(
    () =>
      PLATFORM_CARDS.map((platform) => {
        const rows = analytics.filter((row) => normalizePlatform(row.platform) === platform.key);
        const views = sum(rows, "views");
        const likes = sum(rows, "likes");
        const engagement = likes + sum(rows, "comments") + sum(rows, "shares") + sum(rows, "saves");
        const rate = views > 0 ? (engagement / views) * 100 : 0;
        return { ...platform, views, likes, engagement, rate, entries: rows.length };
      }),
    [analytics]
  );

  const streamSeries = useMemo(() => {
    const byDate: Record<string, { date: string; Instagram: number; TikTok: number; YouTube: number; engagement: number }> = {};
    analytics.forEach((row) => {
      const date = String(row.date || "unknown");
      if (!byDate[date]) byDate[date] = { date, Instagram: 0, TikTok: 0, YouTube: 0, engagement: 0 };
      const platform = normalizePlatform(row.platform);
      if (platform === "Instagram" || platform === "TikTok" || platform === "YouTube") {
        byDate[date][platform] += Number(row.views || row.streams || 0);
      }
      byDate[date].engagement += Number(row.likes || 0) + Number(row.comments || 0) + Number(row.shares || 0) + Number(row.saves || 0);
    });
    return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
  }, [analytics]);

  const syncedCount = analytics.filter((row) => row.source === "synced").length;

  const onSync = async () => {
    setSyncing(true);
    try {
      await syncSocialStats();
      await reload();
      toast({ title: "Analytics synced", description: "Loaded the latest views, likes, and engagement from connected platforms." });
    } catch (err) {
      toast({ title: "Sync failed", description: errorMessage(err, "Could not sync platform stats."), variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Screen>
      <View className="gap-4">
        <View className="flex-row items-center justify-between gap-3">
          <H1>Analytics</H1>
          <Button label={syncing ? "Syncing…" : "Sync"} variant="outline" loading={syncing} onPress={onSync} />
        </View>
        <Muted>
          Live platform stats sync from the same free edge function as the website
          {syncedCount ? ` · ${syncedCount} synced entries` : ""}.
        </Muted>
        {error ? <Muted>{error}</Muted> : null}
        {campaigns && analytics.length === 0 ? (
          <Empty
            title="No analytics yet"
            description="Publish short videos from Social Hub, then sync to fill views and engagement."
            action={<Button label="Sync from platforms" variant="outline" loading={syncing} onPress={onSync} />}
          />
        ) : (
          <>
            <View className="flex-row flex-wrap gap-3">
              {[
                ["Total views", totals.views],
                ["Engagement", totals.engagement],
                ["Streams", totals.streams],
                ["Followers +", totals.followers],
              ].map(([label, value]) => (
                <Card key={String(label)} className="min-w-[46%] flex-1">
                  <Muted>{label}</Muted>
                  <P className="font-heading text-2xl">{Number(value).toLocaleString()}</P>
                </Card>
              ))}
            </View>
            <P className="font-semibold">Short video platforms</P>
            {platformBreakdown.map((platform) => (
              <Card key={platform.key} className="gap-2">
                <View className="flex-row items-center gap-2">
                  <View className="h-3 w-3 rounded-full" style={{ backgroundColor: platform.color }} />
                  <P className="font-semibold">{platform.key}</P>
                  <Muted>{platform.entries} entries</Muted>
                </View>
                <View className="flex-row flex-wrap gap-3">
                  <Muted>Views {platform.views.toLocaleString()}</Muted>
                  <Muted>Likes {platform.likes.toLocaleString()}</Muted>
                  <Muted>Engagement {platform.engagement.toLocaleString()}</Muted>
                  <Muted>Rate {platform.rate.toFixed(1)}%</Muted>
                </View>
              </Card>
            ))}
            {streamSeries.length ? (
              <>
                <Card className="gap-3">
                  <P className="font-semibold">Views over time</P>
                  <SeriesChart
                    data={streamSeries}
                    series={[
                      { key: "Instagram", color: "#e1306c", label: "Instagram" },
                      { key: "TikTok", color: "#ff2d55", label: "TikTok" },
                      { key: "YouTube", color: "#ff0000", label: "YouTube" },
                    ]}
                  />
                </Card>
                <Card className="gap-3">
                  <P className="font-semibold">Engagement over time</P>
                  <SeriesChart data={streamSeries} series={[{ key: "engagement", color: "#2ad4e8", label: "Engagement" }]} />
                </Card>
              </>
            ) : null}
            <Card className="gap-3">
              <P className="font-semibold">Views by platform</P>
              {byPlatform.length ? <ViewsChart data={byPlatform} /> : <Muted>No platform views yet.</Muted>}
            </Card>
            <Card className="gap-3">
              <P className="font-semibold">Views by content type</P>
              {byContentType.length ? <ShareChart data={byContentType} /> : <Muted>No content types yet.</Muted>}
            </Card>
            <P className="font-semibold">Campaigns</P>
            {(campaigns || []).map((campaign) => {
              const entries = analytics.filter((row) => row.campaign_id === campaign.id);
              const views = sum(entries, "views");
              return (
                <Pressable key={campaign.id} onPress={() => router.push(`/campaigns/${campaign.id}`)}>
                  <Card className="flex-row items-center justify-between gap-3">
                    <View className="flex-1">
                      <P className="font-semibold">{campaign.song?.title || campaign.name || "Untitled"}</P>
                      <Muted>
                        {campaign.artist?.name || "Artist"} · {entries.length} entries
                      </Muted>
                    </View>
                    <P>{views.toLocaleString()} views</P>
                  </Card>
                </Pressable>
              );
            })}
          </>
        )}
      </View>
    </Screen>
  );
}
