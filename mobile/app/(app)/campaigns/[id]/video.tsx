import { useLocalSearchParams } from "expo-router";
import { StudioScreen } from "@/components/StudioScreen";

export default function CampaignVideo() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <StudioScreen campaignId={String(id || "")} />;
}
