import { db } from "@/api/base44Client";

import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Pencil, Music2, ListMusic, Sparkles, Film, Plus, Link2, CalendarDays, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";

import { loadRelease } from "@/services/data";
import { fmtDate } from "@/services/format";
import ArtworkImage from "@/components/ArtworkImage";
import StatusBadge from "@/components/StatusBadge";
import EmptyState from "@/components/EmptyState";
import CampaignCard from "@/components/CampaignCard";

export default function ReleaseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [songToAdd, setSongToAdd] = useState("");
  const [linking, setLinking] = useState(false);

  const reload = () =>
    loadRelease(id)
      .then(setData)
      .catch((e) => setError(e.message || "Failed to load release"));

  useEffect(() => { reload(); }, [id]);

  const addSong = async () => {
    if (!songToAdd) return;
    setLinking(true);
    try {
      await db.entities.Song.update(songToAdd, { release_id: id });
      toast({ title: "Song added to release" });
      setSongToAdd("");
      reload();
    } catch (e) {
      toast({ variant: "destructive", title: "Could not add song", description: e.message });
    } finally {
      setLinking(false);
    }
  };

  if (error) {
    return (
      <div className="space-y-4">
        <button onClick={() => navigate("/releases")} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to releases
        </button>
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  if (!data) return <div className="h-64 animate-shimmer rounded-2xl" />;

  const { release, artist, songs, campaigns, contentCount, videosCount, daysCount, unassignedSongs } = data;

  return (
    <div className="space-y-6">
      <button onClick={() => navigate("/releases")} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to releases
      </button>

      <div className="overflow-hidden rounded-3xl border border-border/60 card-gradient">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
          <ArtworkImage
            src={release.artwork_url}
            alt={release.title}
            className="h-36 w-36 shrink-0 sm:h-28 sm:w-28"
            rounded="rounded-2xl"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={release.status || "draft"} />
            </div>
            <h1 className="mt-2 truncate font-heading text-2xl font-700">{release.title || "Untitled"}</h1>
            <p className="truncate text-sm text-muted-foreground">
              {artist?.name || "Unknown artist"} · {fmtDate(release.release_date)}
            </p>
            {release.description && (
              <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{release.description}</p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() => navigate(`/releases/${id}/edit`)}
              >
                <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
              </Button>
              <Button
                size="sm"
                className="rounded-full"
                onClick={() => navigate(`/releases/${id}/calendar`)}
              >
                <CalendarDays className="mr-1.5 h-3.5 w-3.5" /> View Campaign Calendar
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() => navigate(`/releases/${id}/content`)}
              >
                <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Content
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() => navigate("/social")}
              >
                <Share2 className="mr-1.5 h-3.5 w-3.5" /> Social
              </Button>
            </div>
          </div>
        </div>
      </div>

      <section>
        <h2 className="mb-3 font-heading text-sm font-600 uppercase tracking-wider text-muted-foreground">Overview</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Stat label="Songs" value={songs.length} icon={Music2} />
          <Stat label="Campaigns" value={campaigns.length} icon={ListMusic} />
          <Stat label="Campaign days" value={daysCount || 0} icon={CalendarDays} />
          <Stat label="Content" value={contentCount} icon={Sparkles} />
          <Stat label="Videos" value={videosCount} icon={Film} />
        </div>
        {campaigns.length > 0 && !(daysCount > 0) && (
          <p className="mt-3 text-sm text-muted-foreground">
            No campaign days planned yet.{" "}
            <button
              type="button"
              className="text-primary underline-offset-2 hover:underline"
              onClick={() => navigate(`/releases/${id}/calendar`)}
            >
              Open calendar
            </button>
          </p>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-heading text-sm font-600 uppercase tracking-wider text-muted-foreground">Songs</h2>
          <Button size="sm" className="rounded-full" onClick={() => navigate("/create")}>
            <Plus className="mr-1.5 h-3.5 w-3.5" /> New Campaign
          </Button>
        </div>

        {unassignedSongs?.length > 0 && (
          <div className="flex flex-col gap-2 rounded-2xl border border-border/60 bg-muted/20 p-3 sm:flex-row sm:items-center">
            <Select value={songToAdd} onValueChange={setSongToAdd}>
              <SelectTrigger className="rounded-xl"><SelectValue placeholder="Add existing song…" /></SelectTrigger>
              <SelectContent>
                {unassignedSongs.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={addSong} disabled={!songToAdd || linking} variant="outline" className="rounded-full">
              <Link2 className="mr-1.5 h-3.5 w-3.5" />{linking ? "Adding…" : "Add Song"}
            </Button>
          </div>
        )}

        {songs.length ? (
          <div className="space-y-2">
            {songs.map((s) => {
              const related = campaigns.find((c) => c.song_id === s.id);
              return (
                <button
                  key={s.id}
                  onClick={() => related ? navigate(`/campaigns/${related.id}`) : navigate("/create")}
                  className="flex w-full items-center gap-3 rounded-xl border border-border/50 bg-card/40 p-3 text-left transition hover:border-primary/40"
                >
                  <ArtworkImage src={s.artwork_url} alt={s.title} className="h-12 w-12 shrink-0" rounded="rounded-lg" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-600">{s.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {related ? "Open campaign" : "No campaign yet — create one"}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon={Music2}
            title="No songs on this release"
            description="Create a campaign with this release selected, or add an existing unassigned song."
          />
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-sm font-600 uppercase tracking-wider text-muted-foreground">Campaigns</h2>
        {campaigns.length ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {campaigns.map((c) => (
              <CampaignCard
                key={c.id}
                campaign={c}
                song={c.song}
                artist={artist}
                daysCount={c.daysCount || 0}
                videosCount={0}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={ListMusic}
            title="No campaigns yet"
            description="Create a campaign and optionally attach this release."
            action={
              <Button onClick={() => navigate("/create")} className="rounded-full">
                <Plus className="mr-1.5 h-3.5 w-3.5" /> New Campaign
              </Button>
            }
          />
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, icon: Icon }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/50 p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4 text-primary" />
        <span className="text-xs uppercase tracking-wider">{label}</span>
      </div>
      <p className="mt-2 font-heading text-2xl font-700">{value}</p>
    </div>
  );
}
