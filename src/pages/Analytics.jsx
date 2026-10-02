import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, Heart, TrendingUp, Users, BarChart3, Instagram, Youtube, Music2, Disc3, RefreshCw } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
  Legend,
} from "recharts";
import { sum } from "@/services/format";
import { selectAnalyticsWorkspace } from "@/services/studioRecords";
import StatCard from "@/components/StatCard";
import EmptyState from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { useWorkspaceRefresh } from "@/lib/AuthContext";

const CHART_COLORS = ["hsl(265 90% 68%)", "hsl(326 85% 62%)", "hsl(190 90% 55%)", "hsl(43 90% 60%)", "hsl(0 80% 62%)", "hsl(150 70% 50%)"];
const METRICS = ["views", "likes", "comments", "shares", "saves", "followers_gained", "streams", "playlist_adds", "clicks"];

const PLATFORM_CARDS = [
  { key: "Instagram", label: "Instagram", icon: Instagram, color: "#e1306c" },
  { key: "TikTok", label: "TikTok", icon: Music2, color: "#ff2d55" },
  { key: "YouTube", label: "YouTube", icon: Youtube, color: "#ff0000" },
  { key: "Spotify", label: "Spotify", icon: Disc3, color: "#1db954" },
];

function normalizePlatform(name) {
  const n = String(name || "").toLowerCase();
  if (n.includes("instagram")) return "Instagram";
  if (n.includes("tiktok")) return "TikTok";
  if (n.includes("youtube") || n.includes("short")) return "YouTube";
  if (n.includes("spotify")) return "Spotify";
  return name || "Other";
}

export default function Analytics() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [campaigns, setCampaigns] = useState(null);
  const [analytics, setAnalytics] = useState([]);
  const [syncing, setSyncing] = useState(false);

  const reload = useCallback(
    () =>
      selectAnalyticsWorkspace()
        .then(({ campaigns: c, analytics: a }) => {
          setCampaigns(c);
          setAnalytics(a);
        })
        .catch((err) => {
          console.error("--- ANALYTICS LOAD ERROR ---", err);
          setCampaigns([]);
          setAnalytics([]);
          throw err;
        }),
    []
  );

  useEffect(() => {
    reload();
  }, [reload]);
  useWorkspaceRefresh(reload);

  const totals = useMemo(() => {
    const t = {};
    METRICS.forEach((m) => (t[m] = sum(analytics, m)));
    return t;
  }, [analytics]);

  const byPlatform = useMemo(() => {
    const map = {};
    analytics.forEach((a) => {
      const key = normalizePlatform(a.platform);
      map[key] = (map[key] || 0) + (a.views || 0);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [analytics]);

  const byContentType = useMemo(() => {
    const map = {};
    analytics.forEach((a) => {
      map[a.content_type || "Other"] = (map[a.content_type || "Other"] || 0) + (a.views || 0);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [analytics]);

  const platformBreakdown = useMemo(() => {
    return PLATFORM_CARDS.map((p) => {
      const rows = analytics.filter((a) => normalizePlatform(a.platform) === p.key);
      const views = sum(rows, "views");
      const likes = sum(rows, "likes");
      const comments = sum(rows, "comments");
      const shares = sum(rows, "shares");
      const engagement = likes + comments + shares + sum(rows, "saves");
      const rate = views > 0 ? (engagement / views) * 100 : 0;
      return { ...p, views, likes, comments, shares, engagement, rate, entries: rows.length };
    });
  }, [analytics]);

  /** Side-by-side daily stream / view series for IG · TikTok · YouTube. */
  const streamSeries = useMemo(() => {
    const byDate = {};
    analytics.forEach((a) => {
      const date = a.date || "unknown";
      if (!byDate[date]) {
        byDate[date] = { date, Instagram: 0, TikTok: 0, YouTube: 0, engagement: 0 };
      }
      const plat = normalizePlatform(a.platform);
      if (plat === "Instagram" || plat === "TikTok" || plat === "YouTube") {
        byDate[date][plat] += Number(a.views || a.streams || 0);
      }
      byDate[date].engagement +=
        Number(a.likes || 0) + Number(a.comments || 0) + Number(a.shares || 0) + Number(a.saves || 0);
    });
    return Object.values(byDate).sort((a, b) => String(a.date).localeCompare(String(b.date)));
  }, [analytics]);

  const engagement = (totals.likes + totals.comments + totals.shares + totals.saves) || 0;
  const loading = campaigns === null;
  const syncedCount = analytics.filter((a) => a.source === "synced").length;

  const onSync = async () => {
    setSyncing(true);
    try {
      await reload();
      toast({
        title: "Analytics refreshed",
        description: "Loaded the latest views, likes, and engagement saved to your account.",
      });
    } catch (err) {
      console.error("--- SOCIAL STATS SYNC ERROR ---", err);
      toast({
        variant: "destructive",
        title: "Sync failed",
        description: err?.message || "Could not sync platform stats.",
      });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-700 tracking-tight">Analytics</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Live platform stats auto-sync daily via the background worker
            {syncedCount ? ` · ${syncedCount} synced entries` : ""}.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="rounded-full"
          onClick={onSync}
          disabled={syncing}
        >
          <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Syncing…" : "Sync from platforms"}
        </Button>
      </div>

      {loading ? (
        <div className="h-40 animate-shimmer rounded-2xl" />
      ) : analytics.length === 0 ? (
        <EmptyState
          icon={BarChart3}
          title="No analytics yet"
          description="Publish short videos from Social Hub — daily sync (or Sync now) fills views and engagement graphs."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <button
                onClick={onSync}
                className="rounded-full border border-border px-4 py-2 text-sm font-600"
              >
                Sync from platforms
              </button>
              <button
                onClick={() => navigate("/campaigns")}
                className="rounded-full bg-primary px-4 py-2 text-sm font-600 text-primary-foreground"
              >
                Go to Campaigns
              </button>
            </div>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Total Views" value={totals.views.toLocaleString()} icon={Eye} />
            <StatCard label="Engagement" value={engagement.toLocaleString()} icon={Heart} accent="accent" />
            <StatCard label="Streams" value={totals.streams.toLocaleString()} icon={TrendingUp} accent="chart-3" />
            <StatCard label="Followers +" value={totals.followers_gained.toLocaleString()} icon={Users} accent="chart-1" />
          </div>

          <section>
            <h2 className="mb-3 font-heading text-sm font-600 uppercase tracking-wider text-muted-foreground">
              Short video platforms
            </h2>
            <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:grid-cols-4">
              {platformBreakdown.map((p) => {
                const Icon = p.icon;
                return (
                  <div
                    key={p.key}
                    className="rounded-2xl border border-border/60 bg-card/50 p-4"
                  >
                    <div className="mb-3 flex items-center gap-2">
                      <span
                        className="flex h-8 w-8 items-center justify-center rounded-full"
                        style={{ background: `${p.color}22`, color: p.color }}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="text-sm font-600">{p.label}</p>
                        <p className="text-xs text-muted-foreground">{p.entries} entries</p>
                      </div>
                    </div>
                    <dl className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <dt className="text-xs text-muted-foreground">Views</dt>
                        <dd className="font-600">{p.views.toLocaleString()}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">Likes</dt>
                        <dd className="font-600">{p.likes.toLocaleString()}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">Engagement</dt>
                        <dd className="font-600">{p.engagement.toLocaleString()}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">Eng. rate</dt>
                        <dd className="font-600">{p.rate.toFixed(1)}%</dd>
                      </div>
                    </dl>
                  </div>
                );
              })}
            </div>
          </section>

          {streamSeries.length > 0 && (
            <div className="grid gap-4 lg:grid-cols-2">
              <ChartCard title="Views over time (side-by-side platforms)">
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={streamSeries}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
                    <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 12, color: "hsl(var(--popover-foreground))" }} />
                    <Legend />
                    <Line type="monotone" dataKey="Instagram" stroke="#e1306c" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="TikTok" stroke="#ff2d55" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="YouTube" stroke="#ff0000" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>
              <ChartCard title="Engagement over time">
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={streamSeries}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
                    <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 12, color: "hsl(var(--popover-foreground))" }} />
                    <Line type="monotone" dataKey="engagement" stroke="hsl(190 90% 55%)" strokeWidth={2} dot={false} name="Engagement" />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard title="Views by Platform">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={byPlatform}>
                  <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} width={36} />
                  <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 12, color: "hsl(var(--popover-foreground))" }} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]} fill="hsl(265 90% 68%)" />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Views by Content Type">
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={byContentType} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} innerRadius={45}>
                    {byContentType.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 12, color: "hsl(var(--popover-foreground))" }} />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          <div>
            <h2 className="mb-3 font-heading text-sm font-600 uppercase tracking-wider text-muted-foreground">Campaigns</h2>
            <div className="space-y-2">
              {(campaigns || []).map((c) => {
                const entries = analytics.filter((a) => a.campaign_id === c.id);
                const views = sum(entries, "views");
                return (
                  <button
                    key={c.id}
                    onClick={() => navigate(`/campaigns/${c.id}/analytics`)}
                    className="flex w-full items-center justify-between rounded-xl border border-border/50 bg-card/40 p-3 text-left transition hover:border-primary/40"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-600">{c.song?.title || "Untitled"}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {c.artist?.name} · {entries.length} entries
                      </p>
                    </div>
                    <span className="text-sm font-600">{views.toLocaleString()} views</span>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function ChartCard({ title, children }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/50 p-4">
      <h3 className="mb-3 text-sm font-600">{title}</h3>
      {children}
    </div>
  );
}
