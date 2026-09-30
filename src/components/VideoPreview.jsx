import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { getTemplate } from "@/services/videoTemplates";

/**
 * Live CSS preview of a 9:16 promotional video project. This is a real
 * in-browser preview of how the template composes artwork + text + waveform.
 * It is NOT a rendered MP4 (see videoService.js — mock export).
 */
export default function VideoPreview({ project, playing = false }) {
  const tpl = getTemplate(project.template);
  const anim = project.animation_style || tpl.animationDefault;
  const showWave = tpl.supportsWaveform && project.waveform;

  const overlay = useMemo(() => {
    const map = {
      title: project.title || "",
      artist: project.artist_name || "",
      hook: project.text || "",
      lyrics: project.lyrics || "",
      subtitle: project.text || "",
      releaseDate: project.text || "",
      cta: project.text || "",
    };
    return map;
  }, [project]);

  const textStyleClass = {
    bold: "font-heading font-700 tracking-tight",
    elegant: "font-serif italic",
    mono: "font-mono",
    neon: "font-heading font-700 tracking-tight",
  }[project.text_style] || "font-heading font-700 tracking-tight";

  const neonStyle = project.text_style === "neon"
    ? { textShadow: "0 0 12px hsl(265 90% 68%), 0 0 24px hsl(326 85% 62%)" }
    : {};

  return (
    <div className="relative mx-auto aspect-[9/16] w-full max-w-[260px] overflow-hidden rounded-3xl border border-border/70 bg-black shadow-2xl shadow-black/50">
      {/* Artwork background */}
      {project.artwork_url ? (
        <div
          className={cn(
            "absolute inset-0 bg-cover bg-center transition-transform ease-out",
            anim === "zoom-pan" && playing && "scale-110 translate-x-2",
            anim === "parallax" && playing && "scale-105",
            anim === "pulse" && playing && "animate-float"
          )}
          style={{ backgroundImage: `url(${project.artwork_url})` }}
        />
      ) : (
        <div className="absolute inset-0 grid place-items-center bg-muted/30 text-muted-foreground text-xs">No artwork</div>
      )}

      {/* Scrim */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/80" />

      {/* Waveform */}
      {showWave && (
        <div className="absolute inset-x-0 bottom-24 flex h-16 items-end justify-center gap-0.5 px-4">
          {Array.from({ length: 40 }).map((_, i) => (
            <span
              key={i}
              className="w-1 rounded-full bg-primary/70"
              style={{
                height: `${20 + Math.abs(Math.sin(i * 0.7)) * 80}%`,
                animation: playing ? `float ${0.6 + (i % 5) * 0.1}s ease-in-out infinite alternate` : "none",
              }}
            />
          ))}
        </div>
      )}

      {/* Text overlays by template */}
      <div className="absolute inset-0 flex flex-col justify-end p-5 text-white">
        {tpl.id === "LYRICS" && (
          <p className={cn("whitespace-pre-line text-lg leading-snug", textStyleClass)} style={neonStyle}>
            {overlay.lyrics || overlay.title || "Your lyrics here"}
          </p>
        )}
        {tpl.id === "HOOK" && (
          <>
            <p className={cn("text-2xl leading-tight", textStyleClass)} style={neonStyle}>{overlay.title}</p>
            {overlay.hook && <p className="mt-1 text-base text-white/80">{overlay.hook}</p>}
          </>
        )}
        {tpl.id === "CINEMATIC" && (
          <>
            <p className={cn("text-xl", textStyleClass)} style={neonStyle}>{overlay.title}</p>
            {overlay.subtitle && <p className="mt-1 text-sm text-white/70">{overlay.subtitle}</p>}
          </>
        )}
        {tpl.id === "WAVEFORM" && (
          <>
            <p className={cn("text-xl", textStyleClass)} style={neonStyle}>{overlay.title}</p>
            <p className="text-sm text-white/80">{overlay.artist}</p>
          </>
        )}
        {tpl.id === "RELEASE" && (
          <>
            <p className={cn("text-2xl", textStyleClass)} style={neonStyle}>{overlay.title}</p>
            <p className="mt-1 text-sm text-white/80">{overlay.releaseDate}</p>
            {overlay.cta && <p className="mt-2 inline-block rounded-full bg-white/15 px-3 py-1 text-xs">{overlay.cta}</p>}
          </>
        )}
        {tpl.id === "MINIMAL" && (
          <>
            <p className={cn("text-xl", textStyleClass)} style={neonStyle}>{overlay.title}</p>
            <p className="text-sm text-white/70">{overlay.artist}</p>
          </>
        )}
      </div>

      {/* fade-in animation hint */}
      {anim === "fade" && playing && (
        <div className="absolute inset-0 animate-fade-in" />
      )}
    </div>
  );
}