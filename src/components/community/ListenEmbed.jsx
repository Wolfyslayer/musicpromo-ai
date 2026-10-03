export default function ListenEmbed({ listen }) {
  if (!listen?.embedUrl) return null;
  const isSpotify = listen.type === "spotify";
  return (
    <div className="space-y-2">
      <p className="font-heading text-xs font-600 uppercase tracking-wider text-muted-foreground">
        {listen.label || "Listen"}
      </p>
      <div
        className={`overflow-hidden rounded-xl border border-border/50 bg-muted/20 ${
          isSpotify ? "h-[152px]" : "aspect-video"
        }`}
      >
        <iframe
          title={listen.label || "Listen embed"}
          src={listen.embedUrl}
          className="h-full w-full border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          loading="lazy"
        />
      </div>
    </div>
  );
}
