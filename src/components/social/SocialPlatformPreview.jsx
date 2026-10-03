import { useMemo, useState } from "react";
import ArtworkImage from "@/components/ArtworkImage";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const PLATFORMS = [
  { id: "instagram", label: "IG Reels", aspect: "9/16", crop: "rounded-2xl" },
  { id: "tiktok", label: "TikTok", aspect: "9/16", crop: "rounded-xl" },
  { id: "youtube", label: "Shorts", aspect: "9/16", crop: "rounded-xl" },
  { id: "x", label: "X", aspect: "16/9", crop: "rounded-xl" },
];

function PreviewFrame({ platform, caption, mediaUrl, artworkUrl, username }) {
  const image = mediaUrl || artworkUrl;
  const isVertical = platform.aspect === "9/16";
  const handle = username ? `@${username.replace(/^@+/, "")}` : "@artist";

  if (platform.id === "x") {
    return (
      <div className="mx-auto w-full max-w-sm rounded-2xl border border-border/60 bg-card p-3 shadow-sm">
        <div className="flex gap-2">
          <div className="h-10 w-10 shrink-0 rounded-full bg-muted" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-600">{handle}</p>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-snug">{caption || "Your caption…"}</p>
            {image ? (
              <div className="mt-2 overflow-hidden rounded-xl border border-border/40">
                <img src={image} alt="" className="aspect-video w-full object-cover" />
              </div>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`relative mx-auto overflow-hidden border border-border/60 bg-black shadow-lg ${platform.crop}`}
      style={{ aspectRatio: platform.aspect, maxWidth: isVertical ? "220px" : "100%" }}
    >
      {image ? (
        <img src={image} alt="" className="h-full w-full object-cover opacity-90" />
      ) : (
        <div className="grid h-full w-full place-items-center bg-muted/30 text-xs text-muted-foreground">
          Artwork / video
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3 pt-8">
        <p className="text-[10px] font-semibold text-white/90">{handle}</p>
        <p className="line-clamp-3 text-xs leading-snug text-white">{caption || "Caption preview"}</p>
      </div>
      <div className="absolute left-2 top-2 rounded bg-black/50 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-white/80">
        Mock preview
      </div>
    </div>
  );
}

/**
 * Static platform preview mocks (not official embeds).
 */
export default function SocialPlatformPreview({
  caption = "",
  mediaUrl = "",
  artworkUrl = "",
  username = "",
  defaultPlatform = "instagram",
  compact = false,
}) {
  const [tab, setTab] = useState(defaultPlatform);
  const platform = useMemo(() => PLATFORMS.find((p) => p.id === tab) || PLATFORMS[0], [tab]);

  if (compact) {
    return (
      <PreviewFrame
        platform={platform}
        caption={caption}
        mediaUrl={mediaUrl}
        artworkUrl={artworkUrl}
        username={username}
      />
    );
  }

  return (
    <div className="space-y-3 rounded-2xl border border-border/50 bg-muted/10 p-3">
      <p className="text-xs font-600 uppercase tracking-wider text-muted-foreground">Platform preview</p>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid h-auto w-full grid-cols-4 gap-1 bg-muted/40 p-1">
          {PLATFORMS.map((p) => (
            <TabsTrigger key={p.id} value={p.id} className="rounded-lg px-1 py-1.5 text-[10px] sm:text-xs">
              {p.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {PLATFORMS.map((p) => (
          <TabsContent key={p.id} value={p.id} className="mt-3">
            <PreviewFrame
              platform={p}
              caption={caption}
              mediaUrl={mediaUrl}
              artworkUrl={artworkUrl}
              username={username}
            />
          </TabsContent>
        ))}
      </Tabs>
      {artworkUrl && !mediaUrl ? (
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <ArtworkImage src={artworkUrl} alt="" className="h-6 w-6 rounded" rounded="rounded" />
          Using artwork until video is linked
        </div>
      ) : null}
    </div>
  );
}
