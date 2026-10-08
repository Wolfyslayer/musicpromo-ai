import { useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { Text } from "@/components/ui/Text";
import { Button } from "@/components/ui/Button";
import { useAppTheme } from "@/theme/ThemeProvider";
import { radius, spacing, touchTarget } from "@/theme";
import { uploadPromoAsset, UploadProgress } from "@/services/supabaseStore";
import { fmtDuration } from "@/services/format";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import { logError, userFacingError } from "@/lib/errors";

type Value = {
  file_uri: string;
  signed_url: string;
  duration: number | null;
  name: string;
};

type Props = {
  value?: Partial<Value> | null;
  onChange: (next: Value) => void;
};

export function AudioUploader({ value, onChange }: Props) {
  const { colors } = useAppTheme();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const playUrl = value?.signed_url || value?.file_uri || "";
  const player = useAudioPlayer(playUrl || null);

  const cancel = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setBusy(false);
    setProgress(0);
  };

  const pickAndUpload = async () => {
    setError(null);
    const result = await DocumentPicker.getDocumentAsync({
      type: ["audio/*", "audio/mpeg", "audio/wav", "audio/x-wav", "audio/mp4"],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    const name = asset.name || `audio-${Date.now()}.mp3`;
    const ok = /\.(mp3|wav|m4a)$/i.test(name) || /^audio\//i.test(asset.mimeType || "");
    if (!ok) {
      setError("Use MP3, WAV or M4A.");
      return;
    }

    setBusy(true);
    setProgress(0);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const uploaded = await uploadPromoAsset(
        { uri: asset.uri, name, type: asset.mimeType || "audio/mpeg" },
        "audio",
        {
          signal: controller.signal,
          onProgress: (p: UploadProgress) => setProgress(p.progress),
        }
      );
      onChange({
        file_uri: uploaded.file_uri,
        signed_url: uploaded.signed_url,
        duration: null,
        name,
      });
    } catch (e) {
      if ((e as Error)?.message === "Upload cancelled.") {
        setError("Upload cancelled.");
      } else {
        logError("audio.upload", e);
        setError(userFacingError(e, "Audio upload failed."));
      }
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  };

  const clear = async () => {
    await player.unload();
    onChange({ file_uri: "", signed_url: "", duration: null, name: "" });
  };

  return (
    <View style={styles.wrap}>
      {value?.file_uri ? (
        <View style={[styles.card, { backgroundColor: colors.muted, borderColor: colors.border }]}>
          <Text variant="bodyStrong" numberOfLines={1}>
            {value.name || "Audio file"}
          </Text>
          <Text muted variant="caption">
            {player.durationMs
              ? `${fmtDuration(player.durationMs / 1000)} · `
              : value.duration
                ? `${fmtDuration(value.duration)} · `
                : ""}
            MP3/WAV/M4A
          </Text>
          <View style={styles.row}>
            <Button
              title={player.isPlaying ? "Pause" : "Play"}
              variant="secondary"
              onPress={player.toggle}
              disabled={player.loading || !playUrl}
              accessibilityHint="Toggle audio preview"
            />
            <Button title="Replace" variant="outline" onPress={pickAndUpload} disabled={busy} />
            <Button title="Remove" variant="ghost" onPress={clear} />
          </View>
          {player.error ? (
            <Text color={colors.destructive} variant="caption">
              {player.error}
            </Text>
          ) : null}
          {busy ? (
            <View style={styles.row}>
              <ActivityIndicator color={colors.primary} />
              <Text muted>Uploading… {Math.round(progress * 100)}%</Text>
              <Button title="Cancel" variant="ghost" onPress={cancel} />
            </View>
          ) : null}
        </View>
      ) : (
        <Pressable
          onPress={pickAndUpload}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Upload song"
          style={[
            styles.dashed,
            { borderColor: colors.border, backgroundColor: colors.muted },
          ]}
        >
          {busy ? (
            <>
              <ActivityIndicator color={colors.primary} />
              <Text muted>Uploading… {Math.round(progress * 100)}%</Text>
              <Button title="Cancel" variant="ghost" onPress={cancel} />
            </>
          ) : (
            <>
              <Text variant="bodyStrong">Upload song</Text>
              <Text muted variant="caption">
                MP3 · WAV · M4A
              </Text>
            </>
          )}
        </Pressable>
      )}
      {error ? (
        <View style={styles.err}>
          <Text color={colors.destructive} variant="caption">
            {error}
          </Text>
          <Button title="Retry" variant="outline" onPress={pickAndUpload} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  card: {
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  row: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, alignItems: "center" },
  dashed: {
    borderRadius: radius.xl,
    borderWidth: 2,
    borderStyle: "dashed",
    minHeight: touchTarget * 3,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    padding: spacing.xl,
  },
  err: { gap: spacing.sm },
});
