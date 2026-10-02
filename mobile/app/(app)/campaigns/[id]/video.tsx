import { useLocalSearchParams } from "expo-router";
import { StudioScreen } from "@/components/StudioScreen";

export default function CampaignVideo() {
  const params = useLocalSearchParams<{ id: string; day?: string; project?: string; text?: string }>();
  return <StudioScreen campaignId={String(params.id || "")} dayId={params.day ? String(params.day) : ""} projectId={params.project ? String(params.project) : ""} initialText={params.text ? String(params.text) : ""} />;
}