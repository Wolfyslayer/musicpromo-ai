import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, BarChart3, ArrowRight, PlayCircle, Globe2, Rocket, Activity, Film, Palette } from "lucide-react";
import ReleaseCommandHero from "@/components/ux/ReleaseCommandHero";
import DashboardProfileNudge from "@/components/ux/DashboardProfileNudge";
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
import PromoPathCards from "@/components/ux/PromoPathCards";

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

  const launchReleaseId = active?.release_id || active?.release?.id || null;

  const quickActions = [
    { label: "New promo", icon: Plus, to: "/create" },
    { label: "Video studio", icon: Film, to: "/studio" },
    { label: "Cover lab", icon: Palette, to: "/artwork" },
    {
      label: "Launch board",
      icon: Rocket,
      to: launchReleaseId ? `/releases/${launchReleaseId}/launch` : active ? `/campaigns/${active.id}/plan` : "/campaigns",
    },
    { label: "Social health", icon: Activity, to: "/social/health" },
    { label: "Analytics", icon: BarChart3, to: "/analytics" },
  ];

  return (
    <div className="page-stack">
      <PageHeader
        compact
        eyebrow="Home"
        title={
          <>
            Release promos, <span className="text-gradient">on autopilot</span>
          </>
        }
        description="Promo videos, day-by-day posts, and scheduled publishing for your releases."
        actions={
          <Button onClick={() => navigate("/create")} className="rounded-full px-4" size="default">
            <Plus className="mr-1.5 h-4 w-4" /> New promo
          </Button>
        }
      />

      <PromoPathCards />

      {error && <p className="text-sm text-destructive">{error}</p>}

      {active && launchReleaseId ? (
        <ReleaseCommandHero
          campaign={active}
          releaseId={launchReleaseId}
          releaseTitle={active.release?.title || active.song?.title}
          artworkUrl={active.release?.artwork_url || active.song?.artwork_url}
          readyVideosCount={readyVideos.length}
        />
      ) : null}

      <DashboardProfileNudge />

      <SurfacePanel className="flex flex-col gap-2.5 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary">
            <Globe2 className="h-4 w-4" aria-hidden />
          </div>
          <div>
            <p className="font-heading text-sm font-semibold">Community</p>
            <p className="text-xs text-muted-foreground">Discover artists and follow their promo updates.</p>
          </div>
        </div>
        <Button size="sm" className="shrink-0 rounded-full" asChild>
          <Link to="/community">Open</Link>
        </Button>
      </SurfacePanel>

      {active && !launchReleaseId ? (
        <section className="space-y-4">
          <SectionTitle>Active campaign</SectionTitle>
          <button
            onClick={() => navigate(`/campaigns/${active.id}/plan`)}
            className="surface-interactive group block w-full overflow-hidden rounded-3xl text-left animate-slide-up"
          >
            <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:gap-5">
              <ArtworkImage src={active.song?.artwork_url} alt={active.song?.title} className="h-40 w-40 shrink-0 sm:h-28 sm:w-28" rounded="rounded-2xl" />
              <div className="min-w-0 flex-1">
                <StatusBadge status={active.status} />
                <h2 className="mt-2 truncate font-heading text-xl font-semibold">{active.song?.title || "Untitled"}</h2>
                <p className="truncate text-sm text-muted-foreground">{active.artist?.name}</p>
                <p className="mt-2 text-xs text-muted-foreground">Link a release to unlock the release command center.</p>
                <div className="mt-3">
                  <ProgressBar value={active.progressValue || 0} showLabel />
                </div>
              </div>
              <ArrowRight className="hidden h-5 w-5 shrink-0 text-muted-foreground transition group-hover:translate-x-1 sm:block" />
            </div>
          </button>
        </section>
      ) : !active ? (
        !data && <div className="h-40 animate-shimmer rounded-2xl" />
      ) : null}

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
        <SectionTitle>Quick actions</SectionTitle>
        <div className="segmented-scroll">
          <div className="flex min-w-max gap-2 sm:grid sm:min-w-0 sm:w-full sm:grid-cols-3 lg:grid-cols-6">
            {quickActions.map((a) => {
              const Icon = a.icon;
              return (
                <button
                  key={a.label}
                  type="button"
                  onClick={() => navigate(a.to)}
                  className="flex min-h-11 w-[8.5rem] shrink-0 items-center gap-2 rounded-2xl border border-border/60 bg-card/60 px-3 py-2.5 text-left transition hover:border-primary/40 hover:bg-card sm:w-auto"
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="text-xs font-600 leading-tight">{a.label}</span>
                </button>
              );
            })}
          </div>
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
              icon={Plus}
              title="No promo campaigns yet"
              description="Start with your release and audio — we'll build hooks, captions, and video drafts for each plan day."
              action={<Button onClick={() => navigate("/create")} className="rounded-full"><Plus className="mr-1.5 h-4 w-4" />New promo</Button>}
            />
          )
        )}
      </section>
    </div>
  );
}

function SectionTitle({ children }) {
  return <h2 className="mb-2 font-heading text-xs font-600 uppercase tracking-wider text-muted-foreground">{children}</h2>;
}
