import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Disc3, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";

import { loadReleases } from "@/services/data";
import { fmtDate } from "@/services/format";
import EmptyState from "@/components/EmptyState";
import ArtworkImage from "@/components/ArtworkImage";
import StatusBadge from "@/components/StatusBadge";
import PageHeader from "@/components/PageHeader";

export default function Releases() {
  const navigate = useNavigate();
  const [releases, setReleases] = useState(null);
  const [error, setError] = useState("");

  const reload = () =>
    loadReleases()
      .then(setReleases)
      .catch((e) => {
        setError(e.message || "Failed to load releases");
        setReleases([]);
      });

  useEffect(() => { reload(); }, []);

  return (
    <div className="page-stack">
      <PageHeader
        compact
        eyebrow="Catalog"
        title="Releases"
        description="Cover art, audio, and launch dates — start a promo from any release."
        actions={
          <Button onClick={() => navigate("/releases/new")} className="rounded-full">
            <Plus className="mr-1.5 h-4 w-4" /> New release
          </Button>
        }
      />

      {error && <p className="text-sm text-destructive">{error}</p>}

      {releases?.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {releases.map((r) => (
            <div
              key={r.id}
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/releases/${r.id}`)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  navigate(`/releases/${r.id}`);
                }
              }}
              className="list-row flex cursor-pointer gap-3 p-3 text-left animate-slide-up"
            >
              <ArtworkImage
                src={r.artwork_url}
                alt={r.title}
                className="h-20 w-20 shrink-0"
                rounded="rounded-xl"
              />
              <div className="min-w-0 flex-1">
                <h3 className="truncate font-heading font-600">{r.title || "Untitled"}</h3>
                <p className="truncate text-sm text-muted-foreground">{r.artist?.name || "Unknown artist"}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <StatusBadge status={r.status || "draft"} />
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3 w-3" />{fmtDate(r.release_date)}
                  </span>
                  <span>{r.songsCount || 0} songs</span>
                  <span>{r.campaignsCount || 0} campaigns</span>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/releases/${r.id}/calendar`);
                    }}
                  >
                    Calendar
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : releases ? (
        <EmptyState
          icon={Disc3}
          title="No releases yet"
          description="Create a release to organize songs and campaigns."
          action={
            <Button onClick={() => navigate("/releases/new")} className="rounded-full">
              <Plus className="mr-1.5 h-4 w-4" />New Release
            </Button>
          }
        />
      ) : (
        <div className="h-40 animate-shimmer rounded-2xl" />
      )}
    </div>
  );
}
