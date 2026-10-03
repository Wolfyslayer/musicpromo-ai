import { useEffect, useMemo, useState } from "react";
import ArtworkImage from "@/components/ArtworkImage";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const PLATFORMS = [
  { id: "instagram", label: "IG Reels", aspect: "9/16", crop: "rounded-2xl" },
  { id: "tiktok", label: "TikTok", aspect: "9/16", crop: "rounded-xl" },
  { id: "youtube", label: "Shorts", aspect: "9/16", crop: "rounded-xl" },
  { id: "x", label: "X", aspect: "16/9", crop: "rounded-xl" },
];

export function isVideoMediaUrl(url) {
  const raw = String(url || "").trim();
  if (!raw) return false;
  if (/^https?:\/\//i.test(raw) && /\.(mp4|mov|webm|m4v)(\?|#|$)/i.test(raw)) return true;
  return false;
}

function PreviewMedia({ videoUrl, imageUrl, className }) {
  if (videoUrl) {
    return (
      <video
        key={videoUrl}
        src={videoUrl}
        poster={imageUrl && !isVideoMediaUrl(imageUrl) ? imageUrl : undefined}
        className={className}
        muted
        playsInline
        loop
        autoPlay
        preload="metadata"
      />
    );
  }
  if (imageUrl) {
    return <img src={imageUrl} alt="" className={className} />;
  }
  return (
    <div className="grid h-full w-full place-items-center bg-muted/30 text-xs text-muted-foreground">
      Artwork / video
    </div>
  );
}

function PreviewFrame({ platform, caption, mediaUrl, artworkUrl, username, mediaType = "IMAGE" }) {
  const isVertical = platform.aspect === "9/16";
  const handle = username ? `@${username.replace(/^@+/, "")}` : "@artist";

  const type = String(mediaType || "IMAGE").toUpperCase();
  const preferVideo = type === "REELS" || type === "VIDEO";
  const videoUrl =
    (preferVideo && isVideoMediaUrl(mediaUrl) && mediaUrl) ||
    (isVideoMediaUrl(mediaUrl) ? mediaUrl : "") ||
    (preferVideo && isVideoMediaUrl(artworkUrl) ? artworkUrl : "");
  const imageUrl =
    (!isVideoMediaUrl(mediaUrl) && mediaUrl) ||
    (!isVideoMediaUrl(artworkUrl) && artworkUrl) ||
    "";

  if (platform.id === "x") {
    return (
      <div className="mx-auto w-full max-w-sm rounded-2xl border border-border/60 bg-card p-3 shadow-sm">
        <div className="flex gap-2">
          <div className="h-10 w-10 shrink-0 rounded-full bg-muted" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-600">{handle}</p>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-snug">{caption || "Your caption…"}</p>
            {videoUrl || imageUrl ? (
              <div className="mt-2 overflow-hidden rounded-xl border border-border/40">
                <PreviewMedia
                  videoUrl={videoUrl}
                  imageUrl={imageUrl}
                  className="aspect-video w-full object-cover"
                />
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
      <PreviewMedia
        videoUrl={videoUrl}
        imageUrl={imageUrl}
        className="h-full w-full object-cover opacity-95"
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3 pt-8">
        <p className="text-[10px] font-semibold text-white/90">{handle}</p>
        <p className="line-clamp-3 text-xs leading-snug text-white">{caption || "Caption preview"}</p>
      </div>
      <div className="pointer-events-none absolute left-2 top-2 rounded bg-black/50 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-white/80">
        {videoUrl ? "Video preview" : "Mock preview"}
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
  mediaType = "IMAGE",
  defaultPlatform = "instagram",
  lockPlatform = false,
  compact = false,
}) {
  const [tab, setTab] = useState(defaultPlatform);

  useEffect(() => {
    setTab(defaultPlatform);
  }, [defaultPlatform]);

  const visiblePlatforms = useMemo(() => {
    if (lockPlatform && defaultPlatform) {
      return PLATFORMS.filter((p) => p.id === defaultPlatform);
    }
    return PLATFORMS;
  }, [lockPlatform, defaultPlatform]);

  const platform = useMemo(
    () => visiblePlatforms.find((p) => p.id === tab) || visiblePlatforms[0] || PLATFORMS[0],
    [tab, visiblePlatforms]
  );

  const frameProps = {
    caption,
    mediaUrl,
    artworkUrl,
    username,
    mediaType,
  };

  if (compact) {
    return <PreviewFrame platform={platform} {...frameProps} />;
  }

  const showVideoHint = isVideoMediaUrl(mediaUrl) || String(mediaType).toUpperCase() === "REELS";

  return (
    <div className="space-y-3 rounded-2xl border border-border/50 bg-muted/10 p-3">
      <p className="text-xs font-600 uppercase tracking-wider text-muted-foreground">Platform preview</p>
      {lockPlatform && visiblePlatforms.length === 1 ? (
        <PreviewFrame platform={visiblePlatforms[0]} {...frameProps} />
      ) : (
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
              <PreviewFrame platform={p} {...frameProps} />
            </TabsContent>
          ))}
        </Tabs>
      )}
      {showVideoHint ? (
        <p className="text-[10px] text-muted-foreground">Previewing your selected rendered video (muted loop).</p>
      ) : artworkUrl && !mediaUrl ? (
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <ArtworkImage src={artworkUrl} alt="" className="h-6 w-6 rounded" rounded="rounded" />
          Using artwork until video is linked
        </div>
      ) : null}
    </div>
  );
}
