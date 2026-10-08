import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import { Text } from "@/components/ui/Text";
import { Button } from "@/components/ui/Button";
import { useAppTheme } from "@/theme/ThemeProvider";
import { radius, spacing } from "@/theme";
import { logError } from "@/lib/errors";

/**
 * Native preview for *existing* exported MP4 URLs only.
 * Does not generate/render video — Remotion WebCodecs stays on web.
 */
export function VideoPreviewPlayer({
  url,
  statusLabel,
}: {
  url?: string | null;
  statusLabel?: string;
}) {
  const { colors } = useAppTheme();
  const player = useVideoPlayer(url || null, (p) => {
    p.loop = false;
  });

  useEffect(() => {
    return () => {
      try {
        player.pause();
      } catch (e) {
        logError("video.unload", e);
      }
    };
  }, [player, url]);

  if (!url) {
    return (
      <View style={[styles.box, { backgroundColor: colors.muted, borderColor: colors.border }]}>
        <Text muted>
          {statusLabel ||
            "No exported MP4 yet. Native devices preview finished renders; encoding still runs in the web Remotion studio or a future backend encoder."}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <VideoView
        style={styles.video}
        player={player}
        nativeControls
        contentFit="contain"
        accessibilityLabel="Promo video preview"
      />
      <View style={styles.row}>
        <Button
          title="Play"
          variant="secondary"
          onPress={() => {
            try {
              player.play();
            } catch (e) {
              logError("video.play", e);
            }
          }}
        />
        <Button
          title="Pause"
          variant="outline"
          onPress={() => {
            try {
              player.pause();
            } catch (e) {
              logError("video.pause", e);
            }
          }}
        />
        {statusLabel ? (
          <Text muted variant="caption">
            {statusLabel}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  video: {
    width: "100%",
    aspectRatio: 9 / 16,
    maxHeight: 420,
    borderRadius: radius.lg,
    backgroundColor: "#000",
    alignSelf: "center",
  },
  box: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, flexWrap: "wrap" },
});
