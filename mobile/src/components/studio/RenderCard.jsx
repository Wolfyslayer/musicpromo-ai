import * as WebBrowser from "expo-web-browser";
import { ExternalLink, MonitorPlay } from "lucide-react-native";
import { View } from "react-native";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/controls";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { webStudioUrl } from "./studioProject";

export default function RenderCard({ project, projectId, duration }) {
  const campaignId = project.campaign_id || "";
  const url = webStudioUrl({ campaignId, projectId, videoType: project.video_type, duration });
  const missing = [!project.artwork_url && "Missing song artwork.", !project.audio_url && "Missing song audio."].filter(Boolean);

  let hint = "";
  if (!url) hint = "Set EXPO_PUBLIC_WEB_APP_URL to open the web studio from the app.";
  else if (!campaignId) hint = "Standalone projects open the web studio demo. Start from a campaign to export this project.";
  else if (!projectId) hint = "Save the project first so the web studio opens these exact settings.";

  return (
    <Card>
      <View className="flex-row items-center gap-2">
        <Icon as={MonitorPlay} size={18} className="text-primary" />
        <Text className="font-heading text-base">MP4 export runs in the web studio for now</Text>
      </View>
      <Text className="text-sm text-muted-foreground">
        Rendering encodes the video with your browser&apos;s WebCodecs, which phones can&apos;t run in the app yet. Save here, then open
        the web studio on a desktop browser to render. The finished MP4 plays here automatically once it&apos;s saved to the project.
      </Text>
      {missing.length ? (
        <Text className="text-xs text-amber-600">{missing.join(" ")} Add them on the campaign song to enable export.</Text>
      ) : null}
      <Button
        variant="outline"
        icon={ExternalLink}
        className="rounded-full"
        disabled={!url}
        onPress={() => WebBrowser.openBrowserAsync(url)}
      >
        Open web studio
      </Button>
      {hint ? <Text className="text-xs text-muted-foreground">{hint}</Text> : null}
    </Card>
  );
}
