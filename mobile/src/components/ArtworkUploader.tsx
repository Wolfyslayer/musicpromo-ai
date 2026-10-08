import { useRef, useState } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Text } from "@/components/ui/Text";
import { Button } from "@/components/ui/Button";
import { useAppTheme } from "@/theme/ThemeProvider";
import { radius, spacing, touchTarget } from "@/theme";
import { uploadPromoAsset, UploadProgress } from "@/services/supabaseStore";
import { logError, userFacingError } from "@/lib/errors";

type Props = {
  value?: string;
  onChange: (next: { url: string; localUri?: string }) => void;
};

export function ArtworkUploader({ value, onChange }: Props) {
  const { colors } = useAppTheme();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const cancel = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setBusy(false);
    setProgress(0);
  };

  const pickAndUpload = async () => {
    setError(null);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError("Photo library permission is required for artwork.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.9,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    const name = asset.fileName || `artwork-${Date.now()}.jpg`;
    const type = asset.mimeType || "image/jpeg";

    setBusy(true);
    setProgress(0);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const uploaded = await uploadPromoAsset(
        { uri: asset.uri, name, type },
        "artwork",
        {
          signal: controller.signal,
          onProgress: (p: UploadProgress) => setProgress(p.progress),
        }
      );
      onChange({ url: uploaded.publicUrl, localUri: asset.uri });
    } catch (e) {
      if ((e as Error)?.message === "Upload cancelled.") {
        setError("Upload cancelled.");
      } else {
        logError("artwork.upload", e);
        setError(userFacingError(e, "Artwork upload failed."));
      }
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  };

  return (
    <View style={styles.wrap}>
      {value ? (
        <View style={[styles.preview, { borderColor: colors.border }]}>
          <Image
            source={{ uri: value }}
            style={styles.image}
            accessibilityLabel="Album artwork preview"
          />
          {busy ? (
            <View style={[StyleSheet.absoluteFill, styles.overlay]}>
              <ActivityIndicator color="#fff" />
              <Text color="#fff" variant="caption">
                {Math.round(progress * 100)}%
              </Text>
              <Button title="Cancel" variant="ghost" onPress={cancel} />
            </View>
          ) : (
            <View style={styles.actions}>
              <Button title="Replace" variant="secondary" onPress={pickAndUpload} />
              <Button
                title="Remove"
                variant="outline"
                onPress={() => onChange({ url: "" })}
              />
            </View>
          )}
        </View>
      ) : (
        <Pressable
          onPress={pickAndUpload}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Upload artwork"
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
              <Text variant="bodyStrong">Upload artwork</Text>
              <Text muted variant="caption">
                JPG · PNG · WEBP
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
  preview: {
    aspectRatio: 1,
    maxWidth: 280,
    width: "100%",
    alignSelf: "center",
    borderRadius: radius["2xl"],
    borderWidth: 1,
    overflow: "hidden",
  },
  image: { width: "100%", height: "100%" },
  overlay: {
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  actions: {
    position: "absolute",
    left: spacing.sm,
    right: spacing.sm,
    bottom: spacing.sm,
    flexDirection: "row",
    gap: spacing.sm,
  },
  dashed: {
    aspectRatio: 1,
    maxWidth: 280,
    width: "100%",
    alignSelf: "center",
    borderRadius: radius["2xl"],
    borderWidth: 2,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    minHeight: touchTarget * 3,
  },
  err: { gap: spacing.sm },
});
