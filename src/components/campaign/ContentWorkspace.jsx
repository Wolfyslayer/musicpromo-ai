import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, Film, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

import { platformColor } from "@/services/constants";
import ArtworkImage from "@/components/ArtworkImage";
import EmptyState from "@/components/EmptyState";
import VideoPreview from "@/components/VideoPreview";
import ContentLibrary from "@/components/campaign/ContentLibrary";
import CampaignDayContentCard from "@/components/campaign/CampaignDayContentCard";
import PromoTextCard from "@/components/campaign/PromoTextCard";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "captions", label: "Captions" },
  { id: "hooks", label: "Hooks" },
  { id: "hashtags", label: "Hashtags" },
  { id: "videos", label: "Videos" },
  { id: "artwork", label: "Artwork" },
  { id: "library", label: "Library" },
];

/**
 * Campaign Content Workspace — organizes CampaignDay promo fields +
 * GeneratedContent library + VideoProjects. Does not change AI generation.
 */
export default function ContentWorkspace({
  campaign,
  song,
  artist,
  release,
  days = [],
  content = [],
  videos = [],
  onRefresh,
  focusDayId,
  embedLibrary = false,
}) {
  const navigate = useNavigate();
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    if (!focusDayId) return;
    const t = setTimeout(() => {
      document.getElementById(`day-${focusDayId}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);
    return () => clearTimeout(t);
  }, [focusDayId, days]);

  const videoById = useMemo(
    () => Object.fromEntries((videos || []).map((v) => [v.id, v])),
    [videos]
  );

  const dayHasAsset = (day) =>
    !!(day.caption || day.hook || day.hashtags || day.cta || day.video_concept || day.video_project_id);

  const libraryByType = useMemo(() => {
    const map = { caption: [], hook: [], hashtags: [], cta: [], video_concept: [], idea: [] };
    for (const item of content || []) {
      const key = map[item.type] ? item.type : "idea";
      map[key].push(item);
    }
    return map;
  }, [content]);

  const artworkUrl = release?.artwork_url || song?.artwork_url || null;
  const hasDayCopy = days.some(dayHasAsset);
  const hasLibrary = (content || []).length > 0;
  const hasVideos = (videos || []).length > 0;
  const hasAnything = hasDayCopy || hasLibrary || hasVideos || !!artworkUrl;

  if (!hasAnything) {
    return (
      <EmptyState
        icon={Sparkles}
        title="No promotional content yet"
        description="Generate content from your campaign plan to start building your promotion."
        action={
          <div className="flex flex-wrap justify-center gap-2">
            {embedLibrary ? (
              <Button className="rounded-full" onClick={() => setFilter("library")}>
                Create Content
              </Button>
            ) : (
              <Button className="rounded-full" onClick={() => navigate(`/campaigns/${campaign.id}/library`)}>
                Create Content
              </Button>
            )}
            <Button variant="outline" className="rounded-full" onClick={() => navigate(`/campaigns/${campaign.id}/plan`)}>
              Open Campaign Plan
            </Button>
          </div>
        }
      />
    );
  }

  const filterEmptyMessage = () => {
    if (filter === "captions" && !days.some((d) => d.caption) && !(libraryByType.caption || []).length) {
      return "No captions yet.";
    }
    if (filter === "hooks" && !days.some((d) => d.hook) && !(libraryByType.hook || []).length) {
      return "No hooks yet.";
    }
    if (filter === "hashtags" && !days.some((d) => d.hashtags) && !(libraryByType.hashtags || []).length) {
      return "No hashtags yet.";
    }
    if (filter === "videos" && !hasVideos) {
      return "No videos yet.";
    }
    return null;
  };

  const emptyMsg = filterEmptyMessage();

  return (
    <div className="space-y-5">
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Content filters">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            role="tab"
            aria-selected={filter === f.id}
            onClick={() => setFilter(f.id)}
            className={`min-h-10 shrink-0 rounded-full px-3.5 py-2 text-xs font-600 transition ${
              filter === f.id
                ? "bg-primary text-primary-foreground"
                : "border border-border/60 bg-muted/30 text-muted-foreground hover:text-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {(filter === "artwork" || filter === "all") && artworkUrl && (
        <section className="rounded-2xl border border-border/60 bg-card/50 p-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-600">
            <ImageIcon className="h-4 w-4 text-primary" /> Artwork
          </h2>
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <ArtworkImage
              src={artworkUrl}
              alt={release?.title || song?.title || "Artwork"}
              className="h-40 w-40"
              rounded="rounded-2xl"
            />
            <div className="min-w-0 text-sm text-muted-foreground">
              <p className="font-600 text-foreground">{release?.title || song?.title || "Untitled"}</p>
              <p className="mt-0.5">{artist?.name || "Unknown artist"}</p>
              {release ? <p className="mt-1 text-xs">Release artwork</p> : null}
              {!release && song?.artwork_url ? <p className="mt-1 text-xs">Song artwork</p> : null}
            </div>
          </div>
        </section>
      )}

      {filter === "artwork" && !artworkUrl && (
        <p className="rounded-2xl border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
          No artwork attached to this campaign yet.
        </p>
      )}

      {filter === "videos" && hasVideos && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-600">
            <Film className="h-4 w-4 text-primary" /> Videos ({videos.length})
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {videos.map((v) => (
              <div key={v.id} className="rounded-2xl border border-border/60 bg-card/50 p-3">
                <div className="mx-auto max-w-[200px]">
                  <VideoPreview project={{ ...v, lyrics: song?.lyrics }} />
                </div>
                <p className="mt-2 truncate text-sm font-600">{v.title || song?.title || "Video"}</p>
                <Button
                  size="sm"
                  className="mt-2 min-h-10 w-full rounded-full"
                  onClick={() => navigate(`/campaigns/${campaign.id}/video?project=${v.id}`)}
                >
                  <Film className="mr-1.5 h-3.5 w-3.5" /> Open Video
                </Button>
              </div>
            ))}
          </div>
        </section>
      )}

      {filter !== "library" && filter !== "artwork" && filter !== "videos" && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-600 uppercase tracking-wider text-muted-foreground">
              Campaign Days
            </h2>
            {!embedLibrary && (
              <Button
                size="sm"
                variant="outline"
                className="rounded-full"
                onClick={() => navigate(`/campaigns/${campaign.id}/library`)}
              >
                <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Generate more
              </Button>
            )}
          </div>

          {!days.length ? (
            <p className="rounded-2xl border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
              No campaign days planned yet.
            </p>
          ) : (
            <div className="space-y-3">
              {days.map((day) => (
                <CampaignDayContentCard
                  key={day.id}
                  day={day}
                  campaignId={campaign.id}
                  video={day.video_project_id ? videoById[day.video_project_id] : null}
                  song={song}
                  filter={filter}
                  highlight={focusDayId === day.id}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Library filter: full ContentLibrary (generation). All filter: read-only summary. */}
      {filter === "library" && (
        <section className="space-y-3">
          <h2 className="text-sm font-600 uppercase tracking-wider text-muted-foreground">
            Content Library
          </h2>
          <ContentLibrary
            campaign={campaign}
            song={{ ...song, artistName: artist?.name }}
            content={content}
            onRefresh={onRefresh}
          />
        </section>
      )}

      {filter === "all" && hasLibrary && (
        <section className="space-y-3">
          <h2 className="text-sm font-600 uppercase tracking-wider text-muted-foreground">
            Content Library
          </h2>
          <p className="text-xs text-muted-foreground">
            Campaign-level AI content (not tied to a specific CampaignDay).
          </p>
          <div className="space-y-3">
            {["hook", "caption", "hashtags", "cta", "video_concept"].map((type) => {
              const items = libraryByType[type] || [];
              if (!items.length) return null;
              return (
                <div key={type} className="rounded-2xl border border-border/60 bg-card/50 p-4">
                  <h3 className="mb-2 text-sm font-600 capitalize">{type.replace("_", " ")}s</h3>
                  <div className="space-y-2">
                    {items.map((item) => (
                      <div key={item.id} className="space-y-1 rounded-xl bg-muted/30 p-3">
                        {item.platform && (
                          <span
                            className="inline-block rounded-full px-2 py-0.5 text-[10px] font-600"
                            style={{ background: `${platformColor(item.platform)}22`, color: platformColor(item.platform) }}
                          >
                            {item.platform}
                          </span>
                        )}
                        <PromoTextCard label={String(type).replace("_", " ").toUpperCase()} text={item.content} />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <Button variant="outline" className="rounded-full" onClick={() => setFilter("library")}>
            Open Content Library
          </Button>
        </section>
      )}

      {emptyMsg && (
        <p className="rounded-2xl border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
          {emptyMsg}
        </p>
      )}
    </div>
  );
}
