import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, Heart, TrendingUp, Users, BarChart3 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { loadCampaigns, loadAnalytics } from "@/services/data";
import { sum } from "@/services/format";
import { platformColor } from "@/services/constants";
import StatCard from "@/components/StatCard";
import EmptyState from "@/components/EmptyState";

const CHART_COLORS = ["hsl(265 90% 68%)", "hsl(326 85% 62%)", "hsl(190 90% 55%)", "hsl(43 90% 60%)", "hsl(0 80% 62%)", "hsl(150 70% 50%)"];
const METRICS = ["views", "likes", "comments", "shares", "saves", "followers_gained", "streams", "playlist_adds", "clicks"];

export default function Analytics() {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState(null);
  const [analytics, setAnalytics] = useState([]);

  useEffect(() => {
    Promise.all([loadCampaigns(), loadAnalytics()]).then(([c, a]) => { setCampaigns(c); setAnalytics(a); }).catch(() => { setCampaigns([]); setAnalytics([]); });
  }, []);

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

  const byContentType = useMemo(() => {
    const map = {};
    analytics.forEach((a) => { map[a.content_type || "Other"] = (map[a.content_type || "Other"] || 0) + (a.views || 0); });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [analytics]);

  const engagement = (totals.likes + totals.comments + totals.shares + totals.saves) || 0;
  const loading = campaigns === null;

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-700 tracking-tight">Analytics</h1>

      {loading ? (
        <div className="h-40 animate-shimmer rounded-2xl" />
      ) : analytics.length === 0 ? (
        <EmptyState
          icon={BarChart3}
          title="No analytics yet"
          description="Performance data is entered per campaign. Open a campaign and add your results to see them here."
          action={<button onClick={() => navigate("/campaigns")} className="rounded-full bg-primary px-4 py-2 text-sm font-600 text-primary-foreground">Go to Campaigns</button>}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Total Views" value={totals.views.toLocaleString()} icon={Eye} />
            <StatCard label="Engagement" value={engagement.toLocaleString()} icon={Heart} accent="accent" />
            <StatCard label="Streams" value={totals.streams.toLocaleString()} icon={TrendingUp} accent="chart-3" />
            <StatCard label="Followers +" value={totals.followers_gained.toLocaleString()} icon={Users} accent="chart-1" />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard title="Views by Platform">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={byPlatform}>
                  <XAxis dataKey="name" tick={{ fill: "hsl(240 6% 62%)", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "hsl(240 6% 62%)", fontSize: 11 }} axisLine={false} tickLine={false} width={36} />
                  <Tooltip contentStyle={{ background: "hsl(250 14% 9%)", border: "1px solid hsl(250 10% 16%)", borderRadius: 12, color: "#fff" }} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]} fill="hsl(265 90% 68%)" />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Views by Content Type">
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={byContentType} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} innerRadius={45}>
                    {byContentType.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "hsl(250 14% 9%)", border: "1px solid hsl(250 10% 16%)", borderRadius: 12, color: "#fff" }} />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          {/* Per campaign */}
          <div>
            <h2 className="mb-3 font-heading text-sm font-600 uppercase tracking-wider text-muted-foreground">Campaigns</h2>
            <div className="space-y-2">
              {(campaigns || []).map((c) => {
                const entries = analytics.filter((a) => a.campaign_id === c.id);
                const views = sum(entries, "views");
                return (
                  <button key={c.id} onClick={() => navigate(`/campaigns/${c.id}?tab=analytics`)} className="flex w-full items-center justify-between rounded-xl border border-border/50 bg-card/40 p-3 text-left transition hover:border-primary/40">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-600">{c.song?.title || "Untitled"}</p>
                      <p className="truncate text-xs text-muted-foreground">{c.artist?.name} · {entries.length} entries</p>
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