import ArtworkImage from "@/components/ArtworkImage";
import StatusBadge from "@/components/StatusBadge";

/** Shared release summary header (detail, calendar, content). */
export default function ReleaseHero({
  release,
  artist,
  status,
  badge,
  children,
  artworkUrl,
  title,
}) {
  const art = artworkUrl || release?.artwork_url;
  const name = title || release?.title || "Untitled";

  return (
    <div className="surface overflow-hidden rounded-3xl">
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
        <ArtworkImage src={art} alt={name} className="h-28 w-28 shrink-0 rounded-2xl" rounded="rounded-2xl" />
        <div className="min-w-0 flex-1">
          {badge || (status ? <StatusBadge status={status} /> : null)}
          <h1 className="mt-2 truncate font-heading text-2xl font-semibold tracking-tight">{name}</h1>
          {artist?.name ? <p className="truncate text-sm text-muted-foreground">{artist.name}</p> : null}
          {children}
        </div>
      </div>
    </div>
  );
}
