import { useCallback, useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { ViewsChart } from "@/components/ViewsChart";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import { Button, Card, Empty, H1, Muted, P, Screen } from "@/components/ui";
import { errorMessage, sum } from "@/lib/format";
import { selectAnalyticsWorkspace } from "@/lib/social";
import type { Row } from "@/lib/types";

function normalizePlatform(name?: string) {
  const value = String(name || "").toLowerCase();
  if (value.includes("instagram")) return "Instagram";
  if (value.includes("tiktok")) return "TikTok";
  if (value.includes("youtube") || value.includes("short")) return "YouTube";
  if (value.includes("spotify")) return "Spotify";
  return name || "Other";
}

export default function Analytics() {
  const { refreshKey } = useAuth();
  const { toast } = useToast();
  const [analytics, setAnalytics] = useState<Row[] | null>(null);
  const [error, setError] = useState("");

  const reload = useCallback(() => {
    setError("");
    selectAnalyticsWorkspace()
      .then((workspace) => setAnalytics(workspace.analytics))
      .catch((err) => {
        setAnalytics([]);
        setError(errorMessage(err));
      });
  }, []);

  useEffect(() => {
    reload();
  }, [reload, refreshKey]);

  const totals = useMemo(() => {
    const rows = analytics || [];
    return {
      views: sum(rows, "views"),
      likes: sum(rows, "likes"),
      comments: sum(rows, "comments"),
      shares: sum(rows, "shares"),
    };
  }, [analytics]);

  const byPlatform = useMemo(() => {
    const map: Record<string, number> = {};
    (analytics || []).forEach((row) => {
      const key = normalizePlatform(row.platform);
      map[key] = (map[key] || 0) + (Number(row.views) || 0);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [analytics]);

  return (
    <Screen>
      <View className="gap-4">
        <View className="flex-row items-center justify-between">
          <H1>Analytics</H1>
          <Button
            label="Refresh"
            variant="outline"
            onPress={() => {
              reload();
              toast({ title: "Analytics refreshed" });
            }}
          />
        </View>
        {error ? <Muted>{error}</Muted> : null}
        <View className="flex-row flex-wrap gap-3">
          {[
            ["Views", totals.views],
            ["Likes", totals.likes],
            ["Comments", totals.comments],
            ["Shares", totals.shares],
          ].map(([label, value]) => (
            <Card key={String(label)} className="min-w-[46%] flex-1">
              <Muted>{label}</Muted>
              <P className="font-heading text-2xl">{value}</P>
            </Card>
          ))}
        </View>
        <Card className="gap-3">
          <P className="font-semibold">Views by platform</P>
          <Muted>Native builds draw this with Victory Native. Web shows the same totals as bars.</Muted>
          {analytics && byPlatform.length ? <ViewsChart data={byPlatform} /> : <Empty title="No analytics yet" description="Connect a platform and publish to see views." />}
        </Card>
      </View>
    </Screen>
  );
}
