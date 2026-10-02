import { Share, View } from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import * as WebBrowser from "expo-web-browser";
import { CheckCircle2, Download, Share2 } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { useToast } from "@/components/ui/toast";

export default function RenderedVideo({ url, title, styleDirty }) {
  const { toast } = useToast();
  const player = useVideoPlayer(url, (p) => {
    p.loop = true;
  });

  const share = async () => {
    try {
      await Share.share({ url, message: title ? `${title} — ${url}` : url });
    } catch (e) {
      toast({ variant: "destructive", title: "Share failed", description: e.message });
    }
  };

  return (
    <View className="gap-3">
      <View className="aspect-[9/16] w-full max-w-[280px] self-center overflow-hidden rounded-3xl bg-black">
        <VideoView player={player} style={{ width: "100%", height: "100%" }} nativeControls contentFit="contain" />
        <View pointerEvents="none" className="absolute left-2 top-2 rounded-full bg-black/55 px-2 py-0.5">
          <Text className="text-[10px] font-600 uppercase tracking-wide text-white/90">MP4</Text>
        </View>
      </View>
      {styleDirty ? (
        <View className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
          <Text className="text-xs text-muted-foreground">
            Style or lyrics changed — the MP4 above is the last export. Save, then remake it in the web studio to bake the new look.
          </Text>
        </View>
      ) : (
        <View className="flex-row items-start gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3">
          <Icon as={CheckCircle2} size={16} className="text-emerald-500" />
          <Text className="flex-1 text-xs text-muted-foreground">Real MP4 ready. Change style or lyric timing to remake.</Text>
        </View>
      )}
      <View className="flex-row gap-2">
        <Button icon={Share2} variant="outline" className="flex-1 rounded-full" onPress={share}>
          Share
        </Button>
        <Button icon={Download} variant="outline" className="flex-1 rounded-full" onPress={() => WebBrowser.openBrowserAsync(url)}>
          Open / download
        </Button>
      </View>
    </View>
  );
}
