import { db } from '@/api/base44Client';

import { useMemo, useState } from "react";
import { Plus, Loader2, Sparkles, Trash2, BarChart3, TrendingUp, Eye, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

import { aiService } from "@/services/aiService";
import { PLATFORMS, CONTENT_TYPES, platformColor } from "@/services/constants";
import { sum, fmtDate, todayISO } from "@/services/format";
import StatCard from "@/components/StatCard";

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
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Manually enter performance data. The app never invents analytics.</p>
        <Button onClick={() => setOpen(true)} className="rounded-full"><Plus className="mr-1.5 h-4 w-4" />Add Entry</Button>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total Views" value={totals.views.toLocaleString()} icon={Eye} />
        <StatCard label="Engagement" value={engagement.toLocaleString()} icon={Heart} accent="accent" />
        <StatCard label="Streams" value={totals.streams.toLocaleString()} icon={TrendingUp} accent="chart-3" />
        <StatCard label="Followers +" value={totals.followers_gained.toLocaleString()} icon={BarChart3} accent="chart-1" />
      </div>

      {analytics.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard title="Views by Platform">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={byPlatform}>
                <XAxis dataKey="name" tick={{ fill: "hsl(240 6% 62%)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "hsl(240 6% 62%)", fontSize: 11 }} axisLine={false} tickLine={false} width={36} />
                <Tooltip contentStyle={{ background: "hsl(250 14% 9%)", border: "1px solid hsl(250 10% 16%)", borderRadius: 12, color: "#fff" }} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} fill="hsl(265 90% 68%)" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Views by Content Type">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={byType} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={40}>
                  {byType.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(250 14% 9%)", border: "1px solid hsl(250 10% 16%)", borderRadius: 12, color: "#fff" }} />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      )}

      {/* Entries */}
      {analytics.length ? (
        <div className="space-y-2">
          {analytics.map((a) => (
            <div key={a.id} className="flex items-center justify-between rounded-xl border border-border/50 bg-card/40 p-3">
              <div className="flex items-center gap-3">
                <span className="rounded-full px-2 py-0.5 text-xs font-600" style={{ background: `${platformColor(a.platform)}22`, color: platformColor(a.platform) }}>{a.platform}</span>
                <span className="text-xs text-muted-foreground">{a.content_type || "—"} · {fmtDate(a.date)}</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>{(a.views || 0).toLocaleString()} views</span>
                <span>{(a.likes || 0).toLocaleString()} likes</span>
                <button onClick={() => remove(a.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-8 text-center text-sm text-muted-foreground">No analytics entered yet. Add your first entry to start tracking.</p>
      )}

      {/* AI analysis */}
      <div className="rounded-2xl border border-border/60 card-gradient p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-heading font-600">Analyze Campaign</h3>
            <p className="text-xs text-muted-foreground">AI reviews your entered data and suggests cautious improvements.</p>
          </div>
          <Button onClick={analyze} disabled={analyzing || analytics.length === 0} className="rounded-full"><Sparkles className="mr-1.5 h-4 w-4" />{analyzing ? "Analyzing…" : "Analyze"}</Button>
        </div>
        {analyzing && <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Reviewing performance…</div>}
        {insights && (
          <div className="mt-4 space-y-4 animate-fade-in">
            <p className="text-sm">{insights.summary}</p>
            <div className="space-y-2">
              {insights.insights?.map((ins, i) => (
                <div key={i} className="rounded-xl bg-muted/30 p-3">
                  <p className="text-sm font-600">{ins.title}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{ins.description}</p>
                </div>
              ))}
            </div>
            {insights.recommendations?.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-600 uppercase tracking-wider text-muted-foreground">Recommendations</p>
                <ul className="space-y-1.5">
                  {insights.recommendations.map((r, i) => (
                    <li key={i} className="flex gap-2 text-sm text-muted-foreground"><span className="text-primary">•</span>{r}</li>
                  ))}
                </ul>
              </div>
            )}
            <p className="text-xs text-muted-foreground/70">Suggestions are based on the data you entered and are not guarantees of future results.</p>
          </div>
        )}
      </div>

      <AddEntryDialog open={open} onClose={() => setOpen(false)} campaign={campaign} onSaved={() => { setOpen(false); onRefresh(); }} />
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

function AddEntryDialog({ open, onClose, campaign, onSaved }) {
  const { toast } = useToast();
  const [f, setF] = useState({ platform: "TikTok", content_type: "", date: todayISO(), views: 0, likes: 0, comments: 0, shares: 0, saves: 0, followers_gained: 0, streams: 0, playlist_adds: 0, clicks: 0 });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const save = async () => {
    await db.entities.AnalyticsEntry.create({ ...f, campaign_id: campaign.id, is_demo: false });
    toast({ title: "Entry added" });
    onSaved();
  };
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Add Performance Entry</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs text-muted-foreground">Platform</Label>
              <Select value={f.platform} onValueChange={(v) => set("platform", v)}>
                <SelectTrigger className="mt-1.5 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>{PLATFORMS.map((p) => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs text-muted-foreground">Content Type</Label>
              <Select value={f.content_type} onValueChange={(v) => set("content_type", v)}>
                <SelectTrigger className="mt-1.5 rounded-xl"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{CONTENT_TYPES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div><Label className="text-xs text-muted-foreground">Date</Label><Input type="date" value={f.date} onChange={(e) => set("date", e.target.value)} className="mt-1.5 rounded-xl" /></div>
          <div className="grid grid-cols-3 gap-3">
            {METRICS.map((m) => (
              <div key={m}>
                <Label className="text-[11px] text-muted-foreground capitalize">{m.replace(/_/g, " ")}</Label>
                <Input type="number" min={0} value={f[m]} onChange={(e) => set(m, Number(e.target.value))} className="mt-1 rounded-lg" />
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} className="rounded-full">Add Entry</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
