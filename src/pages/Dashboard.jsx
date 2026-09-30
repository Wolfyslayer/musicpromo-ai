import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Sparkles, BarChart3, CalendarDays, Film, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { loadCampaigns } from "@/services/data";
import { campaignProgress } from "@/services/format";
import ArtworkImage from "@/components/ArtworkImage";
import StatusBadge from "@/components/StatusBadge";
import ProgressBar from "@/components/ProgressBar";
import EmptyState from "@/components/EmptyState";
import CampaignCard from "@/components/CampaignCard";

export default function Dashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    loadCampaigns().then(setData).catch((e) => setError(e.message));
  }, []);

  const campaigns = data || [];
  const active = campaigns.find((c) => ["active", "scheduled", "preparing"].includes(c.status));
  const recent = campaigns.slice(0, 6);

  const quickActions = [
    { label: "New Campaign", icon: Plus, to: "/create" },
    { label: "Generate Content", icon: Sparkles, to: active ? `/campaigns/${active.id}?tab=content` : "/campaigns" },
    { label: "View Analytics", icon: BarChart3, to: "/analytics" },
    { label: "View Campaign Plan", icon: CalendarDays, to: active ? `/campaigns/${active.id}?tab=plan` : "/campaigns" },
  ];

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="animate-fade-in">
        <h1 className="font-heading text-3xl font-700 tracking-tight md:text-4xl">
          MusicPromo <span className="text-gradient">AI</span>
        </h1>
        <p className="mt-2 max-w-md text-muted-foreground">
          Turn one song into a complete promotion campaign.
        </p>
        <Button
          onClick={() => navigate("/create")}
          className="mt-5 h-11 rounded-full px-5 text-sm font-600"
          size="lg"
        >
          <Plus className="mr-1.5 h-4 w-4" /> New Campaign
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Active campaign */}
      {active ? (
        <section>
          <SectionTitle>Active Campaign</SectionTitle>
          <button
            onClick={() => navigate(`/campaigns/${active.id}`)}
            className="group block w-full overflow-hidden rounded-3xl border border-border/60 card-gradient text-left transition hover:border-primary/40 animate-slide-up"
          >
            <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:gap-5">
              <ArtworkImage src={active.song?.artwork_url} alt={active.song?.title} className="h-40 w-40 shrink-0 sm:h-28 sm:w-28" rounded="rounded-2xl" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <StatusBadge status={active.status} />
                  {active.is_demo && <DemoTag />}
                </div>
                <h2 className="mt-2 truncate font-heading text-xl font-700">{active.song?.title || "Untitled"}</h2>
                <p className="truncate text-sm text-muted-foreground">{active.artist?.name}</p>
                <div className="mt-3">
                  <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                    <span>Campaign progress</span>
                    <span>{active.progressValue || 0}%</span>
                  </div>
                  <ProgressBar value={active.progressValue || 0} />
                </div>
                <div className="mt-3 flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5"><Film className="h-4 w-4 text-primary" />{active.videosCount || 0} videos</span>
                  <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-4 w-4 text-primary" />{active.daysCount || 0} posts</span>
                </div>
              </div>
              <ArrowRight className="hidden h-5 w-5 shrink-0 text-muted-foreground transition group-hover:translate-x-1 sm:block" />
            </div>
          </button>
        </section>
      ) : (
        !data && <div className="h-40 animate-shimmer rounded-2xl" />
      )}

      {/* Quick actions */}
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

      {/* Recent campaigns */}
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
              description="Create your first campaign and let AI build a complete promotion plan."
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

function DemoTag() {
  return (
    <span className="rounded-full border border-border/70 bg-muted/40 px-2 py-0.5 text-[10px] font-500 uppercase tracking-wider text-muted-foreground">
      Demo
    </span>
  );
}