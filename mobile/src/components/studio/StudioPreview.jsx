import { useState } from "react";
import { Platform, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Pause, Play } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/controls";
import { Text } from "@/components/ui/text";
import {
  activeLyricAtTime,
  cuesInAudioWindow,
  formatClock,
  normalizeEditorLook,
  normalizeVisualStyle,
} from "@/services/promoStyles";

const FRAME_WIDTH = 1080;
const MONO = Platform.select({ ios: "Courier", default: "monospace" });

/** Native stand-ins for the Remotion fonts: Space Grotesk for display, monospace for the rugged rock look. */
function titleFontStyle(visualStyle) {
  if (visualStyle === "rock") return { fontFamily: MONO, fontWeight: "700" };
  return { fontFamily: "SpaceGrotesk_700Bold" };
}

function lyricFontStyle(fontId) {
  if (fontId === "display") return { fontFamily: "SpaceGrotesk_700Bold" };
  if (fontId === "grunge") return { fontFamily: MONO, fontWeight: "700" };
  return { fontWeight: "600" };
}

const SHADOW = { textShadowColor: "rgba(0,0,0,0.6)", textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 8 };

export default function StudioPreview({ project, duration, cues, offset, status, onTogglePlay, canPlay }) {
  const [width, setWidth] = useState(280);
  const scale = width / FRAME_WIDTH;
  const height = (width * 16) / 9;
  const visualStyle = normalizeVisualStyle(project.visual_style);
  const look = normalizeEditorLook(project.editor_look);

  const absolute = Number(status.currentTime) || 0;
  const started = absolute >= offset && absolute <= offset + duration;
  const timeSec = started ? absolute - offset : 0;
  const windowCues = cuesInAudioWindow(cues, offset, duration);
  const activeCue = started && (status.playing || timeSec > 0) ? activeLyricAtTime(windowCues, absolute) : null;
  const firstLyricStart = windowCues.reduce((min, cue) => Math.min(min, Number(cue.timeSeconds ?? cue.start) - offset), Infinity);

  const hook = String(project.text || "").trim();
  const promo = project.video_type === "promo";
  const showIntro = promo && timeSec < 3;
  const showOutro = promo && timeSec >= Math.max(3, duration - 3);
  const showLooseHook = !promo && project.video_type !== "lyrics" && hook && timeSec + 0.0005 < firstLyricStart;

  const lyricStyle = {
    ...lyricFontStyle(look.fontId),
    color: look.textColor,
    letterSpacing: look.letterSpacing * scale,
    textAlign: "center",
    ...SHADOW,
  };
  const lyricBoxHeight = height * 0.3;

  let overlay = null;
  if (showOutro) {
    overlay = (
      <View className="self-center rounded-full bg-[#f4f0ff]" style={{ paddingHorizontal: 42 * scale, paddingVertical: 18 * scale }}>
        <Text style={{ ...lyricFontStyle(look.fontId), color: "#1a1028", fontSize: Math.max(28, look.fontSize * 0.5) * scale, fontWeight: "700" }}>
          {project.outro_cta || "Listen now"}
        </Text>
      </View>
    );
  } else if (showIntro) {
    overlay = <Text style={{ ...lyricStyle, fontSize: Math.max(28, look.fontSize * 0.56) * scale }}>{hook || project.title}</Text>;
  } else if (activeCue) {
    overlay = (
      <Text
        style={{
          ...lyricStyle,
          fontSize: look.fontSize * scale,
          textTransform: visualStyle === "hiphop" ? "uppercase" : "none",
        }}
      >
        {activeCue.text}
      </Text>
    );
  } else if (showLooseHook) {
    overlay = <Text style={{ ...lyricStyle, fontSize: Math.max(28, look.fontSize * 0.56) * scale }}>{hook}</Text>;
  }

  return (
    <View className="gap-3">
      <View
        className="aspect-[9/16] w-full max-w-[280px] self-center overflow-hidden rounded-3xl bg-[#050508]"
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      >
        {project.artwork_url ? (
          <>
            <Image
              source={{ uri: project.artwork_url }}
              contentFit="cover"
              blurRadius={24}
              style={{ position: "absolute", width: "100%", height: "100%", opacity: 0.55 }}
            />
            <LinearGradient
              colors={["rgba(0,0,0,0.35)", "rgba(0,0,0,0.05)", "rgba(0,0,0,0.75)"]}
              locations={[0, 0.35, 1]}
              style={{ position: "absolute", width: "100%", height: "100%" }}
            />
            <View className="absolute inset-0 items-center justify-center" style={{ paddingBottom: 280 * scale }}>
              <Image
                source={{ uri: project.artwork_url }}
                contentFit="cover"
                style={{ width: 720 * scale, height: 720 * scale, borderRadius: 28 * scale }}
              />
            </View>
          </>
        ) : (
          <View className="absolute inset-0 bg-[#1a1028]" />
        )}

        <View
          className="absolute inset-x-0 bottom-0 items-center"
          style={{ paddingBottom: (activeCue || hook ? 360 : 220) * scale, paddingHorizontal: 48 * scale }}
        >
          <Text
            numberOfLines={2}
            style={{
              ...titleFontStyle(visualStyle),
              ...SHADOW,
              color: "#fff",
              textAlign: "center",
              fontSize: (visualStyle === "hiphop" ? 70 : 58) * scale,
              textTransform: visualStyle === "hiphop" ? "uppercase" : "none",
              letterSpacing: visualStyle === "hiphop" ? 4 * scale : 0,
            }}
          >
            {project.title || "Untitled"}
          </Text>
          {project.artist_name ? (
            <Text
              numberOfLines={1}
              style={{ ...titleFontStyle(visualStyle), marginTop: 12 * scale, fontSize: 32 * scale, color: "rgba(255,255,255,0.78)" }}
            >
              {project.artist_name}
            </Text>
          ) : null}
        </View>

        {overlay ? (
          <View
            pointerEvents="none"
            className="absolute justify-center"
            style={{
              width: width * 0.92,
              height: lyricBoxHeight,
              left: (look.lyricX / 100) * width - width * 0.46,
              top: (look.lyricY / 100) * height - lyricBoxHeight / 2,
            }}
          >
            {overlay}
          </View>
        ) : null}

        <View className="absolute left-2 top-2 rounded-full bg-black/55 px-2 py-0.5">
          <Text className="text-[10px] font-600 uppercase tracking-wide text-white/90">Preview</Text>
        </View>
      </View>

      <View className="w-full max-w-[280px] flex-row items-center gap-3 self-center">
        <Button
          variant="outline"
          size="sm"
          icon={status.playing ? Pause : Play}
          onPress={onTogglePlay}
          disabled={!canPlay}
          className="rounded-full"
        >
          {status.playing ? "Pause" : "Play"}
        </Button>
        <View className="flex-1">
          <ProgressBar value={duration ? (timeSec / duration) * 100 : 0} />
        </View>
        <Text className="text-xs text-muted-foreground">
          {formatClock(timeSec)} / {formatClock(duration)}
        </Text>
      </View>
      <Text className="text-center text-xs text-muted-foreground">
        {canPlay
          ? `${duration}s · 9:16 · simplified preview (particles and animations appear in the export)`
          : "Add song audio to play the preview."}
      </Text>
    </View>
  );
}
