import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { getTemplate } from "@/services/videoTemplates";

/**
 * Preview for a 9:16 promo project.
 * Shows the real exported MP4 when available; otherwise a live CSS composition mock.
 */
export default function VideoPreview({ project, playing = false }) {
  const videoRef = useRef(null);
  const tpl = getTemplate(project.template);
  const anim = project.animation_style || tpl.animationDefault;
  const showWave = tpl.supportsWaveform && project.waveform;
  const liveUrl =
    project?.render_output_url && /^https:\/\//i.test(project.render_output_url)
      ? project.render_output_url
      : null;

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !liveUrl) return;
    if (playing) {
      el.play().catch(() => {});
    } else {
      el.pause();
    }
  }, [playing, liveUrl]);

  if (liveUrl) {
    return (
      <div className="relative mx-auto aspect-[9/16] w-full max-w-[260px] overflow-hidden rounded-3xl border border-border/70 bg-black shadow-2xl shadow-black/50">
        <video
          ref={videoRef}
          src={liveUrl}
          className="h-full w-full object-cover"
          playsInline
          loop
          muted={false}
          controls={false}
        />
        <div className="pointer-events-none absolute left-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-600 uppercase tracking-wide text-white/90">
          MP4
        </div>
      </div>
    );
  }

  const overlay = {
    title: project.title || "",
    artist: project.artist_name || "",
    hook: project.text || "",
    lyrics: project.lyrics || "",
    subtitle: project.text || "",
    releaseDate: project.text || "",
    cta: project.text || "",
  };

  const textStyleClass =
    {
      bold: "font-heading font-700 tracking-tight",
      elegant: "font-serif italic",
      mono: "font-mono",
      neon: "font-heading font-700 tracking-tight",
    }[project.text_style] || "font-heading font-700 tracking-tight";

  const neonStyle =
    project.text_style === "neon"
      ? { textShadow: "0 0 12px hsl(265 90% 68%), 0 0 24px hsl(326 85% 62%)" }
      : {};

  return (
    <div className="relative mx-auto aspect-[9/16] w-full max-w-[260px] overflow-hidden rounded-3xl border border-border/70 bg-black shadow-2xl shadow-black/50">
      {project.artwork_url ? (
        <div
          className={cn(
            "absolute inset-0 bg-cover bg-center will-change-transform",
            playing && anim === "zoom-pan" && "animate-[vp-zoom_12s_ease-in-out_forwards]",
            playing && anim === "parallax" && "animate-[vp-parallax_10s_ease-in-out_infinite_alternate]",
            playing && anim === "pulse" && "animate-[vp-pulse_2.4s_ease-in-out_infinite]",
            playing && anim === "slide" && "animate-[vp-slide_1.4s_ease-out_forwards]",
            playing && anim === "fade" && "animate-[vp-fade_1.2s_ease-out_forwards]"
          )}
          style={{
            backgroundImage: `url(${project.artwork_url})`,
            ...(playing && anim === "zoom-pan"
              ? { transformOrigin: "center center" }
              : {}),
          }}
        />
      ) : (
        <div className="absolute inset-0 grid place-items-center bg-muted/30 text-xs text-muted-foreground">
          No artwork
        </div>
      )}

      <style>{`
        @keyframes vp-zoom {
          from { transform: scale(1); }
          to { transform: scale(1.18); }
        }
        @keyframes vp-parallax {
          from { transform: scale(1.05) translateX(-2%); }
          to { transform: scale(1.12) translateX(2%); }
        }
        @keyframes vp-pulse {
          0%, 100% { transform: scale(1.06); }
          50% { transform: scale(1.12); }
        }
        @keyframes vp-slide {
          from { transform: translateY(8%) scale(1.05); }
          to { transform: translateY(0) scale(1.05); }
        }
        @keyframes vp-fade {
          from { opacity: 0.35; transform: scale(1.08); }
          to { opacity: 1; transform: scale(1.08); }
        }
      `}</style>

      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/80" />

      {showWave && (
        <div className="absolute inset-x-0 bottom-24 flex h-16 items-end justify-center gap-0.5 px-4">
          {Array.from({ length: 40 }).map((_, i) => (
            <span
              key={i}
              className="w-1 rounded-full bg-primary/70"
              style={{
                height: `${20 + Math.abs(Math.sin(i * 0.7)) * 80}%`,
                animation: playing
                  ? `float ${0.6 + (i % 5) * 0.1}s ease-in-out infinite alternate`
                  : "none",
              }}
            />
          ))}
        </div>
      )}

      <div className="absolute inset-0 flex flex-col justify-end p-5 text-white">
        {tpl.id === "LYRICS" && (
          <p className={cn("whitespace-pre-line text-lg leading-snug", textStyleClass)} style={neonStyle}>
            {overlay.lyrics || overlay.title || "Your lyrics here"}
          </p>
        )}
        {tpl.id === "HOOK" && (
          <>
            <p className={cn("text-2xl leading-tight", textStyleClass)} style={neonStyle}>
              {overlay.title}
            </p>
            {overlay.hook && <p className="mt-1 text-base text-white/80">{overlay.hook}</p>}
          </>
        )}
        {tpl.id === "CINEMATIC" && (
          <>
            <p className={cn("text-xl", textStyleClass)} style={neonStyle}>
              {overlay.title}
            </p>
            {overlay.subtitle && <p className="mt-1 text-sm text-white/70">{overlay.subtitle}</p>}
          </>
        )}
        {tpl.id === "WAVEFORM" && (
          <>
            <p className={cn("text-xl", textStyleClass)} style={neonStyle}>
              {overlay.title}
            </p>
            <p className="text-sm text-white/80">{overlay.artist}</p>
          </>
        )}
        {tpl.id === "RELEASE" && (
          <>
            <p className={cn("text-2xl", textStyleClass)} style={neonStyle}>
              {overlay.title}
            </p>
            <p className="mt-1 text-sm text-white/80">{overlay.releaseDate}</p>
            {overlay.cta && (
              <p className="mt-2 inline-block rounded-full bg-white/15 px-3 py-1 text-xs">{overlay.cta}</p>
            )}
          </>
        )}
        {tpl.id === "MINIMAL" && (
          <>
            <p className={cn("text-xl", textStyleClass)} style={neonStyle}>
              {overlay.title}
            </p>
            <p className="text-sm text-white/70">{overlay.artist}</p>
          </>
        )}
      </div>
    </div>
  );
}
