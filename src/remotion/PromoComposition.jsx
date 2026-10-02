import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Audio, Video } from "@remotion/media";
import { PromoAudioMotion } from "./audioReactive";
import ParticleOverlay from "./ParticleOverlay";
import {
  activeLyricCueIndex,
  cuesInAudioWindow,
  normalizeAiClipOpacity,
  normalizeArtworkMotion,
  isAiStudioMotion,
  normalizeCompositingMode,
  normalizeEditorLook,
  normalizeParticleEffect,
  normalizeVisualStyle,
} from "./styles";
import { fontForChoice, fontForStyle } from "./fonts";
import ArtworkStack from "./ArtworkStack";
import PromoPolishOverlay from "./PromoPolishOverlay";

function LyricLine({
  text,
  visualStyle,
  appearFrame,
  fps,
  fontFamily,
  fontSize,
  color,
  letterSpacing,
  animationMs,
  polish = false,
}) {
  const frame = useCurrentFrame();
  const local = frame - appearFrame;
  if (local < 0) return null;

  const animFrames = Math.max(6, Math.round(((Number(animationMs) || 280) / 1000) * fps));
  const opacity = interpolate(local, [0, animFrames], [0, 1], { extrapolateRight: "clamp" });
  const y = interpolate(local, [0, animFrames], [36, 0], { extrapolateRight: "clamp" });
  const blur = polish
    ? interpolate(local, [0, animFrames], [14, 0], { extrapolateRight: "clamp" })
    : 0;
  const scale = polish
    ? interpolate(local, [0, animFrames], [1.06, 1], { extrapolateRight: "clamp" })
    : 1;
  const display = visualStyle === "hiphop" || visualStyle === "electronic";
  const typeStep = Math.max(1, animFrames / Math.max(1, text.length));
  const chars = visualStyle === "rock" ? Math.min(text.length, Math.floor(local / typeStep) + 1) : text.length;
  const shown = text.slice(0, chars);
  const rnbLower = visualStyle === "rnb";

  return (
    <div
      style={{
        fontFamily,
        fontSize,
        fontWeight: display ? 400 : 700,
        letterSpacing,
        textTransform: display ? "uppercase" : rnbLower ? "lowercase" : "none",
        color,
        textAlign: "center",
        opacity,
        transform: `translateY(${y}px) scale(${scale})`,
        filter: blur > 0.01 ? `blur(${blur}px)` : undefined,
        textShadow: polish
          ? "0 0 24px rgba(167,139,250,0.45), 0 8px 28px rgba(0,0,0,0.55)"
          : "0 8px 28px rgba(0,0,0,0.55)",
        lineHeight: 1.15,
        padding: "0 48px",
      }}
    >
      {shown}
      {visualStyle === "rock" && chars < text.length ? (
        <span style={{ opacity: local % 10 < 5 ? 1 : 0 }}>|</span>
      ) : null}
    </div>
  );
}

/**
 * 9:16 audio-reactive promo composition for Remotion Player + web-renderer.
 */
export function PromoComposition(props) {
  return (
    <PromoAudioMotion audioSrc={props.audioUrl || ""} offsetSec={props.audioStartTimeOffset || 0}>
      {(motion) => <PromoCompositionBody {...props} motion={motion} />}
    </PromoAudioMotion>
  );
}

function PromoCompositionBody({
  artworkUrl = "",
  audioUrl = "",
  title = "",
  artistName = "",
  text = "",
  visualStyle: styleProp = "pop",
  lyricCues = [],
  particleEffect: particleProp = "none",
  look: lookProp,
  audioStartTimeOffset = 0,
  suspendEffects = false,
  videoType = "",
  outroCta = "",
  aiClipUrl = "",
  compositingMode: compositingProp = "artwork",
  aiClipOpacity: aiOpacityProp = 1,
  artworkMotion: artworkMotionProp = "standard",
  motion,
}) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const visualStyle = normalizeVisualStyle(styleProp);
  const particleEffect = normalizeParticleEffect(particleProp);
  const look = normalizeEditorLook(lookProp);
  const compositingMode = normalizeCompositingMode(compositingProp);
  const aiClipOpacity = normalizeAiClipOpacity(aiOpacityProp);
  const useAiClip = Boolean(aiClipUrl) && compositingMode !== "artwork";
  const showArtwork = !useAiClip || compositingMode === "ai_blend";
  const lyricFont = fontForChoice(look.fontId);
  const { bassScale, transientScale, bass, mid, high, energy, transient } = motion;
  const artworkMotion = normalizeArtworkMotion(artworkMotionProp);
  const polish = isAiStudioMotion(artworkMotion);
  const motionT = frame / Math.max(1, durationInFrames - 1);
  const bassPulse = 1 + (bassScale - 1) * (polish ? 1.45 : 1);
  const hitPulse = 1 + (transientScale - 1) * (polish ? 1.35 : 1);
  let bgMotionTransform = `scale(${bassPulse * 1.12})`;
  let coverMotionTransform = `scale(${hitPulse})`;
  if (artworkMotion === "ai-feel") {
    const slowScale = interpolate(motionT, [0, 1], [1.04, 1.18]);
    const panX = interpolate(motionT, [0, 1], [0, -44]) + Math.sin(motionT * Math.PI * 3) * 10;
    const panY = interpolate(motionT, [0, 1], [0, -30]) + Math.cos(motionT * Math.PI * 2.5) * 6;
    coverMotionTransform = `translate(${panX}px, ${panY}px) scale(${slowScale * hitPulse})`;
    bgMotionTransform = `translate(${panX * 0.5}px, ${panY * 0.45}px) scale(${bassPulse * 1.08 * slowScale}) rotate(${motionT * 1.2}deg)`;
  } else if (artworkMotion === "cinematic") {
    const slowScale = interpolate(motionT, [0, 1], [1.02, 1.14]);
    const panX = interpolate(motionT, [0, 1], [0, -38]);
    const panY = interpolate(motionT, [0, 1], [0, -26]);
    coverMotionTransform = `translate(${panX}px, ${panY}px) scale(${slowScale * transientScale})`;
    bgMotionTransform = `translate(${panX * 0.45}px, ${panY * 0.45}px) scale(${bassScale * 1.06 * slowScale})`;
  } else if (artworkMotion === "hype") {
    const punch = interpolate(motionT, [0, 1], [1, 1.16]);
    const drift = Math.sin(motionT * Math.PI * 5) * 14;
    coverMotionTransform = `translate(${drift}px, ${-drift * 0.35}px) scale(${punch * transientScale})`;
    bgMotionTransform = `translate(${drift * 0.6}px, 0) scale(${bassScale * 1.14 * punch})`;
  }
  const timeSec = frame / fps;
  const audioOffset = Math.max(0, Number(audioStartTimeOffset) || 0);
  const videoDuration = durationInFrames / Math.max(1, fps);
  const targetSyncTime = timeSec + audioOffset;
  const cues = cuesInAudioWindow(Array.isArray(lyricCues) ? lyricCues : [], audioOffset, videoDuration);
  const cueIndex = activeLyricCueIndex(cues, targetSyncTime);
  const activeCue = cueIndex >= 0 ? cues[cueIndex] : null;
  const firstLyricStart = cues.reduce((min, cue) => {
    const start = Number(cue?.timeSeconds ?? cue?.start);
    return Number.isFinite(start) ? Math.min(min, start - audioOffset) : min;
  }, Infinity);
  const appearFrame =
    activeCue != null
      ? Math.max(0, Math.round((Number(activeCue.timeSeconds ?? activeCue.start) - audioOffset) * fps))
      : 0;

  const titleIn = spring({
    frame,
    fps,
    config: { damping: 18, stiffness: 90 },
  });
  const titleY = interpolate(titleIn, [0, 1], [40, 0]);
  const titleOpacity = interpolate(titleIn, [0, 1], [0, 1]);
  const artistIn = spring({
    frame: Math.max(0, frame - 8),
    fps,
    config: { damping: 18, stiffness: 90 },
  });
  const artistY = interpolate(artistIn, [0, 1], [28, 0]);
  const artistOpacity = interpolate(artistIn, [0, 1], [0, 1]);

  const fadeOut = interpolate(
    frame,
    [durationInFrames - Math.round(fps * 0.6), durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const hook = String(text || "").trim();
  const promo = videoType === "promo";
  const showIntro = promo && timeSec < 3;
  const showOutro = promo && timeSec >= Math.max(3, videoDuration - 3);
  const fontFamily = fontForStyle(visualStyle);
  const kick = particleEffect === "shake" && !suspendEffects
    ? Math.min(1, bass * 0.35 + transient * 1.6)
    : 0;
  const drift = Math.sin(frame * 0.37);
  const shakeTransform = kick
    ? `translate3d(${drift * kick * 22}px, ${Math.cos(frame * 1.15) * kick * 12}px, 0) rotate(${drift * kick * 0.7}deg)`
    : undefined;

  return (
    <AbsoluteFill style={{ backgroundColor: "#050508", opacity: fadeOut }}>
      {audioUrl ? <Audio src={audioUrl} trimBefore={Math.round(audioOffset * fps)} /> : null}
      <AbsoluteFill style={shakeTransform ? { transform: shakeTransform } : undefined}>

      {useAiClip ? (
        <AbsoluteFill style={{ opacity: aiClipOpacity }}>
          <Video
            src={aiClipUrl}
            muted
            loop
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </AbsoluteFill>
      ) : null}

      {/* Blurred reactive background */}
      {showArtwork ? (
        <AbsoluteFill
          style={{
            justifyContent: "center",
            alignItems: "center",
            transform: bgMotionTransform,
            opacity: useAiClip ? 0.35 : 1,
          }}
        >
          {artworkUrl ? (
            <img
              src={artworkUrl}
              alt=""
              crossOrigin="anonymous"
              style={{
                width: "140%",
                height: "140%",
                objectFit: "cover",
                filter: polish
                  ? "blur(42px) brightness(0.42) saturate(1.35) contrast(1.08)"
                  : "blur(36px) brightness(0.45) saturate(1.15)",
              }}
            />
          ) : (
            <div style={{ width: "100%", height: "100%", background: "#1a1028" }} />
          )}
        </AbsoluteFill>
      ) : (
        <AbsoluteFill style={{ background: "#0a0810" }} />
      )}

      {/* Soft vignette via stacked gradients (no backdrop-filter) */}
      <AbsoluteFill
        style={{
          backgroundImage:
            "linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.05) 35%, rgba(0,0,0,0.75) 100%)",
        }}
      />

      {/* Centered cover — transient peaks */}
      {showArtwork ? (
        <AbsoluteFill
          style={{
            justifyContent: "center",
            alignItems: "center",
            paddingBottom: 280,
          }}
        >
          {artworkUrl ? (
            <ArtworkStack
              artworkUrl={artworkUrl}
              coverTransform={coverMotionTransform}
              polish={polish}
              bass={bass}
              transient={transient}
            />
          ) : null}
        </AbsoluteFill>
      ) : null}

      <ParticleOverlay
        effect={particleEffect}
        bass={bass}
        mid={mid}
        high={high}
        energy={energy}
        transient={transient}
        sourceX={look.particleX}
        sourceY={look.particleY}
        lyricX={look.lyricX}
        lyricY={look.lyricY}
        wind={look.wind}
        speed={look.particleSpeed}
        suspend={suspendEffects}
      />

      <PromoPolishOverlay
        enabled={polish}
        bass={bass}
        mid={mid}
        transient={transient}
        suspend={suspendEffects}
      />

      {/* Title / artist */}
      <AbsoluteFill
        style={{
          justifyContent: "flex-end",
          alignItems: "center",
          paddingBottom: activeCue || hook ? 360 : 220,
        }}
      >
        <div
          style={{
            fontFamily,
            fontSize: visualStyle === "hiphop" || visualStyle === "electronic" ? 70 : visualStyle === "cinematic" ? 52 : 58,
            fontWeight: visualStyle === "pop" || visualStyle === "electronic" ? 800 : 400,
            color: visualStyle === "rnb" ? "#f5e6ff" : "#fff",
            textAlign: "center",
            opacity: titleOpacity,
            transform: `translateY(${titleY}px)`,
            textTransform: visualStyle === "hiphop" || visualStyle === "electronic" ? "uppercase" : "none",
            letterSpacing: visualStyle === "cinematic" ? "0.14em" : visualStyle === "hiphop" ? "0.06em" : "0",
            textShadow: "0 8px 28px rgba(0,0,0,0.65)",
            padding: "0 48px",
            maxWidth: 980,
          }}
        >
          {title || "Untitled"}
        </div>
        <div
          style={{
            marginTop: 12,
            fontFamily,
            fontSize: 32,
            color: "rgba(255,255,255,0.78)",
            textAlign: "center",
            opacity: artistOpacity,
            transform: `translateY(${artistY}px)`,
            padding: "0 48px",
          }}
        >
          {artistName || ""}
        </div>
      </AbsoluteFill>

      {/* Lyrics / hook */}
      <AbsoluteFill style={{ pointerEvents: "none" }}>
        <div
          style={{
            position: "absolute",
            left: `${look.lyricX}%`,
            top: `${look.lyricY}%`,
            width: "92%",
            transform: "translate(-50%, -50%)",
          }}
        >
        {showOutro ? (
          <div
            style={{
              width: "fit-content",
              margin: "0 auto",
              padding: "18px 42px",
              borderRadius: 999,
              background: "#f4f0ff",
              color: "#1a1028",
              fontFamily: lyricFont,
              fontSize: Math.max(28, Math.round(look.fontSize * 0.5)),
              fontWeight: 700,
              letterSpacing: look.letterSpacing,
              textAlign: "center",
            }}
          >
            {outroCta || "Listen now"}
          </div>
        ) : showIntro ? (
          <div
            style={{
              fontFamily: lyricFont,
              fontSize: Math.max(28, Math.round(look.fontSize * 0.56)),
              color: look.textColor,
              letterSpacing: look.letterSpacing,
              textAlign: "center",
              padding: "0 48px",
              textShadow: polish
                ? "0 0 28px rgba(167,139,250,0.5), 0 4px 16px rgba(0,0,0,0.5)"
                : "0 4px 16px rgba(0,0,0,0.5)",
              filter: polish
                ? `blur(${interpolate(frame, [0, 20], [10, 0], { extrapolateRight: "clamp" })}px)`
                : undefined,
              transform: polish
                ? `scale(${interpolate(frame, [0, 20], [1.08, 1], { extrapolateRight: "clamp" })})`
                : undefined,
            }}
          >
            {hook || title}
          </div>
        ) : activeCue && !showIntro && !showOutro ? (
          <LyricLine
            key={`${cueIndex}-${activeCue.text}`}
            text={activeCue.text}
            visualStyle={visualStyle}
            appearFrame={appearFrame}
            fps={fps}
            fontFamily={lyricFont}
            fontSize={look.fontSize}
            color={look.textColor}
            letterSpacing={look.letterSpacing}
            animationMs={look.animationMs}
            polish={polish}
          />
        ) : !promo && videoType !== "lyrics" && hook && timeSec + 0.0005 < firstLyricStart ? (
          <div
            style={{
              fontFamily: lyricFont,
              fontSize: Math.max(28, Math.round(look.fontSize * 0.56)),
              color: look.textColor,
              letterSpacing: look.letterSpacing,
              textAlign: "center",
              padding: "0 48px",
              textShadow: "0 4px 16px rgba(0,0,0,0.5)",
            }}
          >
            {hook}
          </div>
        ) : null}
        </div>
      </AbsoluteFill>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

export default PromoComposition;
