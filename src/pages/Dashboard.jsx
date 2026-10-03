import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Sparkles, BarChart3, CalendarDays, Film, ArrowRight, PlayCircle, Globe2 } from "lucide-react";
import { Link } from "react-router-dom";
import SurfacePanel from "@/components/SurfacePanel";
import { Button } from "@/components/ui/button";
import { loadCampaigns } from "@/services/data";
import { selectCampaignVideos } from "@/services/studioRecords";
import ArtworkImage from "@/components/ArtworkImage";
import StatusBadge from "@/components/StatusBadge";
import ProgressBar from "@/components/ProgressBar";
import EmptyState from "@/components/EmptyState";
import CampaignCard from "@/components/CampaignCard";
import { useAuth, useWorkspaceRefresh } from "@/lib/AuthContext";
import PageHeader from "@/components/PageHeader";

export default function Dashboard() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [data, setData] = useState(null);
  const [readyVideos, setReadyVideos] = useState([]);
  const [error, setError] = useState("");

  const reload = useCallback(() => {
    setError("");
    loadCampaigns()
      .then(async (campaigns) => {
        setData(campaigns);
        const active = campaigns.find((c) =>
          ["active", "scheduled", "preparing"].includes(c.status)
        );
        if (!active?.id) {
          setReadyVideos([]);
          return;
        }
        try {
          const videos = await selectCampaignVideos(active.id);
          setReadyVideos(
            (videos || []).filter(
              (v) =>
                v.rendering_status === "complete" &&
                v.render_output_url &&
                /^https:\/\//i.test(v.render_output_url)
            )
          );
        } catch {
          setReadyVideos([]);
        }
      })
      .catch((e) => {
        setData([]);
        setReadyVideos([]);
        setError(isAuthenticated ? e.message || "Could not load campaigns." : "");
      });
  }, [isAuthenticated]);

  useEffect(() => {
    reload();
  }, [reload]);
  useWorkspaceRefresh(reload);

  const campaigns = data || [];
  const active = campaigns.find((c) => ["active", "scheduled", "preparing"].includes(c.status));
  const recent = campaigns.slice(0, 6);
  const renderingCount = active
    ? (active.videosCount || 0) - readyVideos.length
    : 0;

  const quickActions = [
    { label: "New Campaign", icon: Plus, to: "/create" },
    { label: "Generate Content", icon: Sparkles, to: active ? `/campaigns/${active.id}/library` : "/campaigns" },
    { label: "View Analytics", icon: BarChart3, to: "/analytics" },
    { label: "View Campaign Plan", icon: CalendarDays, to: active ? `/campaigns/${active.id}/plan` : "/campaigns" },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Overview"
        title={
          <>
            MusicPromo <span className="text-gradient">AI</span>
          </>
        }
        description="Hands-off promo: auto videos, scheduled publishing, and live analytics."
        actions={
          <Button onClick={() => navigate("/create")} className="rounded-full px-5" size="lg">
            <Plus className="mr-1.5 h-4 w-4" /> New Campaign
          </Button>
        }
      />

      {error && <p className="text-sm text-destructive">{error}</p>}

      <SurfacePanel className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary">
            <Globe2 className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <p className="font-heading text-base font-semibold">Community</p>
            <p className="text-sm text-muted-foreground">
              Discover public artist profiles, follow creators, and explore featured spotlights.
            </p>
          </div>
        </div>
        <Button className="min-h-11 shrink-0 rounded-full" asChild>
          <Link to="/community">Open Community</Link>
        </Button>
      </SurfacePanel>

      {active ? (
        <section>
          <SectionTitle>Active Campaign</SectionTitle>
          <button
            onClick={() => navigate(`/campaigns/${active.id}/plan`)}
            className="surface-interactive group block w-full overflow-hidden rounded-3xl text-left animate-slide-up"
          >
            <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:gap-5">
              <ArtworkImage src={active.song?.artwork_url} alt={active.song?.title} className="h-40 w-40 shrink-0 sm:h-28 sm:w-28" rounded="rounded-2xl" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <StatusBadge status={active.status} />
                </div>
                <h2 className="mt-2 truncate font-heading text-xl font-semibold">{active.song?.title || "Untitled"}</h2>
                <p className="truncate text-sm text-muted-foreground">{active.artist?.name}</p>
                <div className="mt-3">
                  <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                    <span>Campaign progress</span>
                    <span>{active.progressValue || 0}%</span>
                  </div>
                  <ProgressBar value={active.progressValue || 0} />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <Film className="h-4 w-4 text-primary" />
                    {readyVideos.length} ready
                    {renderingCount > 0 ? ` · ${Math.max(0, renderingCount)} rendering` : ""}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays className="h-4 w-4 text-primary" />
                    {active.daysCount || 0} posts
                  </span>
                </div>
              </div>
              <ArrowRight className="hidden h-5 w-5 shrink-0 text-muted-foreground transition group-hover:translate-x-1 sm:block" />
            </div>
          </button>
        </section>
      ) : (
        !data && <div className="h-40 animate-shimmer rounded-2xl" />
      )}

      {active && readyVideos.length > 0 && (
        <section>
          <SectionTitle>Ready for schedule</SectionTitle>
          <p className="mb-3 text-sm text-muted-foreground">
            Auto-generated 9:16 promo videos — linked to campaign days for scheduled publish.
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {readyVideos.slice(0, 8).map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => navigate(`/campaigns/${active.id}/video?project=${v.id}`)}
                className="group relative min-h-11 w-full overflow-hidden rounded-2xl border border-border/60 bg-card/50 text-left transition hover:border-primary/40"
              >
                <div className="aspect-[9/16] bg-muted/40">
                  {v.artwork_url ? (
                    <img src={v.artwork_url} alt="" className="h-full w-full object-cover opacity-90" />
                  ) : null}
                  <span className="absolute inset-0 flex items-center justify-center bg-black/25 opacity-0 transition group-hover:opacity-100">
                    <PlayCircle className="h-8 w-8 text-white" />
                  </span>
                </div>
                <div className="p-2">
                  <p className="truncate text-xs font-600">{v.title || "Promo video"}</p>
                  <p className="text-[10px] text-muted-foreground">{v.duration || 15}s · ready</p>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      <section>
        <SectionTitle>Quick Actions</SectionTitle>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {quickActions.map((a) => {
            const Icon = a.icon;
            return (
              <button
                key={a.label}
                onClick={() => navigate(a.to)}
                className="flex flex-col items-start gap-3 rounded-2xl border border-border/60 bg-card/60 p-4 text-left transition hover:border-primary/40 hover:bg-card animate-slide-up"
              >
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/15 text-primary">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="text-sm font-600">{a.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <SectionTitle>Recent Campaigns</SectionTitle>
        {recent.length ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {recent.map((c) => (
              <CampaignCard key={c.id} campaign={c} song={c.song} artist={c.artist} daysCount={c.daysCount} videosCount={c.videosCount} />
            ))}
          </div>
        ) : (
          data && (
            <EmptyState
              icon={Sparkles}
              title="No campaigns yet"
              description="Create your first campaign and let AI build a complete promotion plan with auto videos."
              action={<Button onClick={() => navigate("/create")} className="rounded-full"><Plus className="mr-1.5 h-4 w-4" />New Campaign</Button>}
            />
          )
        )}
      </section>
    </div>
  );
}

function SectionTitle({ children }) {
  return <h2 className="mb-3 font-heading text-sm font-600 uppercase tracking-wider text-muted-foreground">{children}</h2>;
}
