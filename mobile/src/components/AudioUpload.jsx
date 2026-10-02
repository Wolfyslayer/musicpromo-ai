import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { Music, Pause, Play, RefreshCw, Upload, X } from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { Icon } from "@/components/ui/icon";
import { ProgressBar } from "@/components/ui/controls";
import { useToast } from "@/components/ui/toast";
import { fmtDuration } from "@/services/format";
import { uploadPromoAsset } from "@/services/supabaseStore";

const AUDIO_TYPES = ["audio/mpeg", "audio/wav", "audio/x-wav", "audio/mp4", "audio/x-m4a", "audio/aac"];

/**
 * Song picker + uploader. onChange({ file_uri, signed_url, duration, name, file }).
 * Duration is reported a second time once the player has loaded the track's metadata.
 */
export default function AudioUpload({ value, signedUrl, onChange, guard }) {
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [playUrl, setPlayUrl] = useState(signedUrl || value || "");
  const pending = useRef(null);
  const player = useAudioPlayer(playUrl ? { uri: playUrl } : null);
  const status = useAudioPlayerStatus(player);
  const { toast } = useToast();

  useEffect(() => {
    if (!pending.current || !status.isLoaded || !(status.duration > 0)) return;
    onChange?.({ ...pending.current, duration: status.duration });
    pending.current = null;
  }, [status.isLoaded, status.duration, onChange]);

  const pick = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: ["audio/*"], copyToCacheDirectory: true });
    const asset = result.canceled ? null : result.assets?.[0];
    if (!asset) return;
    const ok = /\.(mp3|wav|m4a|aac)$/i.test(asset.name || "") || AUDIO_TYPES.includes(String(asset.mimeType).toLowerCase());
    if (!ok) {
      toast({ variant: "destructive", title: "Unsupported file", description: "Use MP3, WAV or M4A." });
      return;
    }
    setBusy(true);
    try {
      const uploaded = await uploadPromoAsset({ uri: asset.uri, name: asset.name, mimeType: asset.mimeType || "audio/mpeg" }, "audio");
      const payload = { file_uri: uploaded.publicUrl, signed_url: uploaded.publicUrl, duration: null, name: asset.name, file: asset };
      setName(asset.name);
      setPlayUrl(uploaded.publicUrl);
      pending.current = payload;
      onChange?.(payload);
    } catch (e) {
      toast({ variant: "destructive", title: "Upload failed", description: e.message });
    } finally {
      setBusy(false);
    }
  };

  const openPicker = () => (typeof guard === "function" ? guard(pick) : pick());

  const clear = () => {
    player.pause();
    setPlayUrl("");
    setName("");
    onChange?.({ file_uri: "", signed_url: "", duration: null, name: "", file: null });
  };

  if (value) {
    const progress = status.duration > 0 ? (status.currentTime / status.duration) * 100 : 0;
    return (
      <View className="gap-3 rounded-2xl border border-border/70 bg-muted/30 p-4">
        <View className="flex-row items-center gap-3">
          <View className="h-12 w-12 items-center justify-center rounded-xl bg-primary/15">
            <Icon as={Music} size={24} className="text-primary" />
          </View>
          <View className="min-w-0 flex-1">
            <Text className="text-sm font-600" numberOfLines={1}>
              {name || "Audio file"}
            </Text>
            <Text className="text-xs text-muted-foreground">
              {status.duration > 0 ? `${fmtDuration(status.duration)} · ` : ""}MP3/WAV/M4A · ready for the studio
            </Text>
          </View>
          <Pressable onPress={openPicker} disabled={busy} className="h-11 w-11 items-center justify-center rounded-lg bg-muted" accessibilityLabel="Replace audio">
            {busy ? <ActivityIndicator size="small" /> : <Icon as={RefreshCw} size={16} className="text-muted-foreground" />}
          </Pressable>
          <Pressable onPress={clear} className="h-11 w-11 items-center justify-center rounded-lg bg-muted" accessibilityLabel="Remove audio">
            <Icon as={X} size={16} className="text-muted-foreground" />
          </Pressable>
        </View>
        {playUrl ? (
          <View className="flex-row items-center gap-3">
            <Pressable
              onPress={() => (status.playing ? player.pause() : player.play())}
              className="h-10 w-10 items-center justify-center rounded-full bg-primary"
              accessibilityLabel={status.playing ? "Pause" : "Play"}
            >
              <Icon as={status.playing ? Pause : Play} size={16} className="text-primary-foreground" />
            </Pressable>
            <View className="flex-1">
              <ProgressBar value={progress} />
            </View>
            <Text className="text-xs text-muted-foreground">{fmtDuration(status.currentTime) === "—" ? "0:00" : fmtDuration(status.currentTime)}</Text>
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <Pressable
      onPress={openPicker}
      disabled={busy}
      className="w-full items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border/70 bg-muted/30 px-6 py-10 active:border-primary/50"
    >
      {busy ? <ActivityIndicator size="large" /> : <Icon as={Upload} size={32} className="text-muted-foreground" />}
      <Text className="text-sm font-500 text-muted-foreground">{busy ? "Uploading…" : "Upload song"}</Text>
      <Text className="text-xs text-muted-foreground/70">MP3 · WAV · M4A</Text>
    </Pressable>
  );
}
