import { useEffect, useMemo, useRef } from "react";
import { Player } from "@remotion/player";
import { PromoComposition } from "./PromoComposition";
import {
  PROMO_FPS,
  PROMO_HEIGHT,
  PROMO_WIDTH,
  buildLyricCues,
  normalizeEditorLook,
  normalizeExportDuration,
  normalizeParticleEffect,
  normalizeVisualStyle,
} from "./styles";
import { waitForPromoFonts } from "./fonts";
import { cn } from "@/lib/utils";

/**
 * Live 9:16 Remotion preview. Cleans up player ref when media sources change.
 */
export default function RemotionPlayerPreview({
  project,
  playing = true,
  className = "",
  playerRef: externalRef,
  onFrame,
}) {
  const playerRef = useRef(null);
  const onFrameRef = useRef(onFrame);
  onFrameRef.current = onFrame;

  const assignRef = (node) => {
    playerRef.current = node;
    if (externalRef) externalRef.current = node;
  };
  const durationSec = normalizeExportDuration(project?.duration);
  const durationInFrames = Math.round(durationSec * PROMO_FPS);

  const inputProps = useMemo(
    () => ({
      artworkUrl: project?.artwork_url || "",
      audioUrl: project?.preview_audio_url || project?.audio_url || "",
      title: project?.title || "",
      artistName: project?.artist_name || "",
      text: project?.text || "",
      visualStyle: normalizeVisualStyle(project?.visual_style),
      particleEffect: normalizeParticleEffect(project?.particle_effect),
      look: normalizeEditorLook(project?.editor_look),
      audioStartTimeOffset: Math.max(0, Number(project?.audioStartTimeOffset) || 0),
      suspendEffects: Boolean(project?.suspendEffects),
      lyricCues: buildLyricCues(
        project?.lyrics,
        durationSec,
        project?.lyric_cues
      ),
    }),
    [
      project?.artwork_url,
      project?.preview_audio_url,
      project?.audio_url,
      project?.title,
      project?.artist_name,
      project?.text,
      project?.visual_style,
      project?.particle_effect,
      project?.editor_look,
      project?.audioStartTimeOffset,
      project?.suspendEffects,
      project?.lyrics,
      project?.lyric_cues,
      durationSec,
    ]
  );

  const mediaKey = `${inputProps.artworkUrl}|${inputProps.audioUrl}|${durationInFrames}`;

  useEffect(() => {
    waitForPromoFonts().catch(() => {});
  }, []);

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    try {
      player.setVolume?.(0);
      if (playing) player.play();
      else player.pause();
    } catch {
      /* player may be unmounting */
    }
  }, [playing, mediaKey]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player?.addEventListener) return undefined;
    const handle = (event) => {
      const frame = event?.detail?.frame;
      const current = typeof frame === "number" ? frame : player.getCurrentFrame?.();
      if (typeof current === "number") onFrameRef.current?.(current);
    };
    player.addEventListener("frameupdate", handle);
    return () => player.removeEventListener("frameupdate", handle);
  }, [mediaKey]);

  useEffect(() => {
    return () => {
      try {
        playerRef.current?.pause?.();
      } catch {
        /* ignore */
      }
    };
  }, [mediaKey]);

  return (
    <div
      className={cn(
        "relative aspect-[9/16] overflow-hidden rounded-[1.6rem] border border-white/10 bg-black shadow-2xl shadow-black/50",
        className || "mx-auto w-full max-w-[280px]"
      )}
    >
      <Player
        key={mediaKey}
        ref={assignRef}
        component={PromoComposition}
        inputProps={inputProps}
        durationInFrames={durationInFrames}
        compositionWidth={PROMO_WIDTH}
        compositionHeight={PROMO_HEIGHT}
        fps={PROMO_FPS}
        style={{ width: "100%", height: "100%" }}
        controls={false}
        loop
        autoPlay={playing}
        acknowledgeRemotionLicense
      />
      <div className="pointer-events-none absolute left-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-600 uppercase tracking-wide text-white/90">
        Live
      </div>
    </div>
  );
}
