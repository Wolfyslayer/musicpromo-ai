import { useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { ImagePlus, RefreshCw, X } from "lucide-react-native";
import ArtworkImage from "./ArtworkImage";
import { Text } from "@/components/ui/text";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { uploadPromoAsset } from "@/services/supabaseStore";

/**
 * Artwork picker + uploader to the public music-promo-assets bucket.
 * onChange({ url, file }) where `file` is the picked image asset.
 */
export default function ArtworkUpload({ value, onChange, guard }) {
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  const emit = (url, file) => onChange?.({ url: url || "", file: file || null });

  const pick = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9,
    });
    const asset = result.canceled ? null : result.assets?.[0];
    if (!asset) return;
    if (asset.mimeType && !/^image\/(jpeg|png|webp|heic|heif)$/i.test(asset.mimeType)) {
      toast({ variant: "destructive", title: "Unsupported file", description: "Use JPG, PNG or WEBP." });
      return;
    }
    setBusy(true);
    try {
      const uploaded = await uploadPromoAsset(
        { uri: asset.uri, name: asset.fileName || `artwork-${Date.now()}.jpg`, mimeType: asset.mimeType || "image/jpeg" },
        "artwork"
      );
      emit(uploaded.publicUrl, asset);
    } catch (e) {
      toast({ variant: "destructive", title: "Upload failed", description: e.message });
    } finally {
      setBusy(false);
    }
  };

  const openPicker = () => (typeof guard === "function" ? guard(pick) : pick());

  if (value) {
    return (
      <View className="aspect-square w-full max-w-xs self-center overflow-hidden rounded-3xl border border-border/70">
        <ArtworkImage src={value} className="h-full w-full" rounded="rounded-3xl" />
        <View className="absolute inset-x-0 bottom-0 flex-row items-center justify-between gap-2 bg-black/50 p-3">
          <Pressable onPress={openPicker} disabled={busy} className="min-h-11 flex-row items-center gap-1.5 rounded-full bg-white/20 px-4">
            <Icon as={RefreshCw} size={14} className="text-white" />
            <Text className="text-xs font-500 text-white">Replace</Text>
          </Pressable>
          <Pressable onPress={() => emit("", null)} className="min-h-11 flex-row items-center gap-1.5 rounded-full bg-white/20 px-4">
            <Icon as={X} size={14} className="text-white" />
            <Text className="text-xs font-500 text-white">Remove</Text>
          </Pressable>
        </View>
        {busy ? (
          <View className="absolute inset-0 items-center justify-center bg-black/50">
            <ActivityIndicator color="#fff" size="large" />
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <Pressable
      onPress={openPicker}
      disabled={busy}
      className="aspect-square w-full max-w-xs items-center justify-center gap-3 self-center rounded-3xl border-2 border-dashed border-border/70 bg-muted/30 active:border-primary/50"
    >
      {busy ? <ActivityIndicator size="large" /> : <Icon as={ImagePlus} size={32} className="text-muted-foreground" />}
      <Text className="text-sm font-500 text-muted-foreground">Upload artwork</Text>
      <Text className="text-xs text-muted-foreground/70">JPG · PNG · WEBP</Text>
    </Pressable>
  );
}
