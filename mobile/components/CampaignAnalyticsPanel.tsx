import { useMemo, useState } from "react";
import { View } from "react-native";
import { ShareChart } from "@/components/AnalyticsCharts";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import { ViewsChart } from "@/components/ViewsChart";
import { Button, Card, Field, Muted, P, SelectField } from "@/components/ui";
import { aiService } from "@/lib/ai";
import { CONTENT_TYPES, PLATFORMS } from "@/lib/constants";
import { db } from "@/lib/db";
import { errorMessage, fmtDate, sum, todayISO } from "@/lib/format";
import type { Row } from "@/lib/types";

const METRICS = ["views", "likes", "comments", "shares", "saves", "followers_gained", "streams", "playlist_adds", "clicks"];

export function CampaignAnalyticsPanel({
  campaign,
  analytics,
  days,
  onRefresh,
}: {
  campaign: Row;
  analytics: Row[];
  days: Row[];
  onRefresh: () => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [insights, setInsights] = useState<Row | null>(null);
  const [form, setForm] = useState<Record<string, string>>({
    platform: "TikTok",
    content_type: CONTENT_TYPES[0],
    date: todayISO(),
    ...Object.fromEntries(METRICS.map((metric) => [metric, "0"])),
  });

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
      const key = String(row.platform || "Other");
      map[key] = (map[key] || 0) + (Number(row.views) || 0);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [analytics]);

  const byType = useMemo(() => {
    const map: Record<string, number> = {};
    analytics.forEach((row) => {
      const key = String(row.content_type || "Other");
      map[key] = (map[key] || 0) + (Number(row.views) || 0);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [analytics]);

  const analyze = async () => {
    setAnalyzing(true);
    setInsights(null);
    try {
      setInsights(await aiService.analyzeCampaignPerformance({ campaign, days, analytics }));
    } catch (err) {
      toast({ title: "Analysis failed", description: errorMessage(err), variant: "destructive" });
    } finally {
      setAnalyzing(false);
    }
  };

  const save = async () => {
    const numbers = Object.fromEntries(METRICS.map((metric) => [metric, Number(form[metric]) || 0]));
    await db.entities.AnalyticsEntry.create({
      platform: form.platform,
      content_type: form.content_type,
      date: form.date,
      ...numbers,
      campaign_id: campaign.id,
      is_demo: false,
      user_id: user?.id || "",
    });
    toast({ title: "Entry added" });
    setOpen(false);
    onRefresh();
  };

  return (
    <View className="gap-3">
      <Muted>Enter performance yourself. The app does not invent analytics.</Muted>
      <Button label="Add entry" onPress={() => setOpen((value) => !value)} />
      <View className="flex-row flex-wrap gap-3">
        {[
          ["Views", totals.views],
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
      {byPlatform.length ? (
        <Card className="gap-2">
          <P className="font-semibold">Views by platform</P>
          <ViewsChart data={byPlatform} />
        </Card>
      ) : null}
      {byType.length ? (
        <Card className="gap-2">
          <P className="font-semibold">Views by content type</P>
          <ShareChart data={byType} />
        </Card>
      ) : null}
      {analytics.length ? (
        analytics.map((row) => (
          <Card key={row.id} className="gap-1">
            <P className="font-semibold">{row.platform || "Platform"}</P>
            <Muted>
              {row.content_type || "—"} · {fmtDate(row.date)}
            </Muted>
            <Muted>
              {(Number(row.views) || 0).toLocaleString()} views · {(Number(row.likes) || 0).toLocaleString()} likes
            </Muted>
            <Button
              label="Delete"
              variant="ghost"
              onPress={() => db.entities.AnalyticsEntry.delete(row.id).then(onRefresh)}
            />
          </Card>
        ))
      ) : (
        <Muted>No analytics entered yet. Add your first entry to start tracking.</Muted>
      )}
      <Card className="gap-2">
        <P className="font-semibold">Analyze campaign</P>
        <Muted>AI reviews the numbers you entered and suggests cautious improvements.</Muted>
        <Button label={analyzing ? "Analyzing…" : "Analyze"} loading={analyzing} disabled={!analytics.length} onPress={analyze} />
        {insights?.summary ? <P>{insights.summary}</P> : null}
        {(insights?.insights || []).map((item: Row, index: number) => (
          <View key={`${item.title}-${index}`}>
            <P className="font-semibold">{item.title}</P>
            <Muted>{item.description}</Muted>
          </View>
        ))}
        {(insights?.recommendations || []).map((item: string) => (
          <Muted key={item}>• {item}</Muted>
        ))}
        {insights ? <Muted>Suggestions are based on the data you entered and are not guarantees.</Muted> : null}
      </Card>
      {open ? (
        <Card className="gap-3">
          <P className="font-semibold">Add performance entry</P>
          <SelectField label="Platform" value={form.platform} options={PLATFORMS.map((item) => ({ label: item.label, value: item.id }))} onChange={(value) => setForm((current) => ({ ...current, platform: value }))} />
          <SelectField label="Content type" value={form.content_type} options={CONTENT_TYPES.map((item) => ({ label: item, value: item }))} onChange={(value) => setForm((current) => ({ ...current, content_type: value }))} />
          <Field label="Date" value={form.date} onChangeText={(value) => setForm((current) => ({ ...current, date: value }))} placeholder="YYYY-MM-DD" />
          {METRICS.map((metric) => (
            <Field
              key={metric}
              label={metric.replace(/_/g, " ")}
              value={form[metric]}
              keyboardType="numeric"
              onChangeText={(value) => setForm((current) => ({ ...current, [metric]: value }))}
            />
          ))}
          <Button label="Save entry" onPress={save} />
        </Card>
      ) : null}
    </View>
  );
}
