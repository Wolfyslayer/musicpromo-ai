import { useEffect } from "react";
import { Platform, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useVideoPlayer, VideoView } from "expo-video";
import { cn } from "@/lib/utils";
import { Text } from "@/components/ui/text";
import { getTemplate } from "@/services/videoTemplates";

const FRAME = "aspect-[9/16] w-full max-w-[260px] self-center overflow-hidden rounded-3xl border border-border/70 bg-black";

const TEXT_FONTS = {
  elegant: { fontFamily: Platform.select({ ios: "Georgia", default: "serif" }), fontStyle: "italic" },
  mono: { fontFamily: Platform.select({ ios: "Menlo", default: "monospace" }) },
};

const NEON = { textShadowColor: "#A164F7", textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 12 };

/**
 * Preview for a 9:16 promo project.
 * Shows the real exported MP4 when available; otherwise a static artwork + overlay text composition.
 */
export default function VideoPreview({ project, playing = false }) {
  const liveUrl =
    project?.render_output_url && /^https:\/\//i.test(project.render_output_url) ? project.render_output_url : null;

  if (liveUrl) return <LiveVideo url={liveUrl} playing={playing} />;
  return <CompositionPreview project={project} />;
}

function LiveVideo({ url, playing }) {
  const player = useVideoPlayer(url, (p) => {
    p.loop = true;
  });

  useEffect(() => {
    if (playing) player.play();
    else player.pause();
  }, [player, playing]);

  return (
    <View className={FRAME}>
      <VideoView player={player} style={{ width: "100%", height: "100%" }} nativeControls contentFit="cover" />
      <View pointerEvents="none" className="absolute left-2 top-2 rounded-full bg-black/55 px-2 py-0.5">
        <Text className="text-[10px] font-600 uppercase tracking-wide text-white/90">MP4</Text>
      </View>
    </View>
  );
}

function CompositionPreview({ project }) {
  const tpl = getTemplate(project.template);
  const showWave = tpl.supportsWaveform && project.waveform;

  const overlay = {
    title: project.title || "",
    artist: project.artist_name || "",
    hook: project.text || "",
    lyrics: project.lyrics || "",
    subtitle: project.text || "",
    releaseDate: project.text || "",
    cta: project.text || "",
  };

  const fontStyle = TEXT_FONTS[project.text_style];
  const textStyle = [fontStyle, project.text_style === "neon" ? NEON : null];
  const textClass = cn("text-white", fontStyle ? "font-400" : "font-heading tracking-tight");

  return (
    <View className={FRAME}>
      {project.artwork_url ? (
        <Image
          source={{ uri: project.artwork_url }}
          contentFit="cover"
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        />
      ) : (
        <View className="absolute inset-0 items-center justify-center bg-muted/30">
          <Text className="text-xs text-muted-foreground">No artwork</Text>
        </View>
      )}

      <LinearGradient
        pointerEvents="none"
        colors={["rgba(0,0,0,0.3)", "transparent", "rgba(0,0,0,0.8)"]}
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
      />

      {showWave ? (
        <View className="absolute inset-x-0 bottom-24 h-16 flex-row items-end justify-center gap-0.5 px-4">
          {Array.from({ length: 40 }).map((_, i) => (
            <View
              key={i}
              className="w-1 rounded-full bg-primary/70"
              style={{ height: `${20 + Math.abs(Math.sin(i * 0.7)) * 80}%` }}
            />
          ))}
        </View>
      ) : null}

      <View className="absolute inset-0 justify-end p-5">
        {tpl.id === "LYRICS" ? (
          <Text className={cn("text-lg leading-snug", textClass)} style={textStyle}>
            {overlay.lyrics || overlay.title || "Your lyrics here"}
          </Text>
        ) : null}
        {tpl.id === "HOOK" ? (
          <>
            <Text className={cn("text-2xl leading-tight", textClass)} style={textStyle}>
              {overlay.title}
            </Text>
            {overlay.hook ? <Text className="mt-1 text-base text-white/80">{overlay.hook}</Text> : null}
          </>
        ) : null}
        {tpl.id === "CINEMATIC" ? (
          <>
            <Text className={cn("text-xl", textClass)} style={textStyle}>
              {overlay.title}
            </Text>
            {overlay.subtitle ? <Text className="mt-1 text-sm text-white/70">{overlay.subtitle}</Text> : null}
          </>
        ) : null}
        {tpl.id === "WAVEFORM" ? (
          <>
            <Text className={cn("text-xl", textClass)} style={textStyle}>
              {overlay.title}
            </Text>
            <Text className="text-sm text-white/80">{overlay.artist}</Text>
          </>
        ) : null}
        {tpl.id === "RELEASE" ? (
          <>
            <Text className={cn("text-2xl", textClass)} style={textStyle}>
              {overlay.title}
            </Text>
            <Text className="mt-1 text-sm text-white/80">{overlay.releaseDate}</Text>
            {overlay.cta ? (
              <View className="mt-2 self-start rounded-full bg-white/15 px-3 py-1">
                <Text className="text-xs text-white">{overlay.cta}</Text>
              </View>
            ) : null}
          </>
        ) : null}
        {tpl.id === "MINIMAL" ? (
          <>
            <Text className={cn("text-xl", textClass)} style={textStyle}>
              {overlay.title}
            </Text>
            <Text className="text-sm text-white/70">{overlay.artist}</Text>
          </>
        ) : null}
      </View>
    </View>
  );
}
