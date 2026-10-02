import { useState } from "react";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { loadCampaign } from "@/services/data";
import { selectCampaignDay, selectVideoProject } from "@/services/studioRecords";
import { resolveAssetUrl } from "@/services/supabaseStore";
import { normalizeVideoType } from "@/services/promoStyles";
import { useAuth } from "@/lib/AuthContext";
import { ErrorState, LoadingState, PageHeader, Screen } from "@/components/Screen";
import CampaignPicker from "@/components/studio/CampaignPicker";
import StudioEditor from "@/components/studio/StudioEditor";
import VideoTypePicker from "@/components/studio/VideoTypePicker";
import { buildInitialProject, savedVideoType } from "@/components/studio/studioProject";

async function loadStudio({ campaignId, projectId, dayId, requestedType, requestedSeconds, requestedText }) {
  const [data, savedProject, day] = await Promise.all([
    campaignId ? loadCampaign(campaignId) : null,
    projectId ? selectVideoProject(projectId) : null,
    !projectId && dayId ? selectCampaignDay(dayId) : null,
  ]);
  const videoType = savedVideoType(savedProject) || requestedType || (projectId ? "promo" : "");
  if (!videoType) return { projectId, project: null, audioUrl: "" };
  const project = buildInitialProject({ data, savedProject, day, campaignId, videoType, requestedSeconds, requestedText });
  const audioUrl = project.audio_url ? await resolveAssetUrl(project.audio_url).catch(() => "") : "";
  return { projectId, project, audioUrl };
}

export default function VideoGenerator() {
  const params = useLocalSearchParams();
  const campaignId = typeof params.id === "string" ? params.id : "";
  const projectId = typeof params.project === "string" ? params.project : "";
  const dayId = typeof params.day === "string" ? params.day : "";
  const requestedType = normalizeVideoType(params.videoType);
  const requestedSeconds = Number(params.seconds) === 30 ? 30 : 15;
  const requestedText = typeof params.text === "string" ? params.text : "";
  const wantRemake = params.remake === "1";
  const { user } = useAuth();
  const [createdId, setCreatedId] = useState("");

  const query = useQuery({
    queryKey: ["video-studio", campaignId, projectId, dayId, requestedType, requestedSeconds, requestedText, user?.id],
    queryFn: () => loadStudio({ campaignId, projectId, dayId, requestedType, requestedSeconds, requestedText }),
    placeholderData: keepPreviousData,
  });

  const chooseType = ({ videoType, seconds }) =>
    router.setParams({ videoType, seconds: videoType === "promo" ? String(seconds || 15) : undefined });

  const pickCampaign = (id) => {
    const typeQuery = requestedType ? `?videoType=${requestedType}${requestedType === "promo" ? `&seconds=${requestedSeconds}` : ""}` : "";
    router.push(`/campaigns/${id}/video${typeQuery}`);
  };

  const onCreated = (id) => {
    setCreatedId(id);
    router.setParams({ project: id });
  };

  const data = query.data;
  // A project this editor just created keeps the same editor instance when its id lands in the URL.
  const loadedProject = data?.projectId && data.projectId !== createdId ? data.projectId : "new";
  const editorKey = data?.project ? `${campaignId || "studio"}:${data.project.video_type}:${loadedProject}` : "";

  let body;
  if (query.isLoading) {
    body = <LoadingState label="Loading studio…" />;
  } else if (query.isError) {
    body = (
      <ErrorState title="Could not open the studio" message={query.error?.message} onRetry={() => query.refetch()} />
    );
  } else if (!data?.project) {
    body = <VideoTypePicker onConfirm={chooseType} />;
  } else {
    body = (
      <StudioEditor
        key={editorKey}
        initialProject={data.project}
        initialAudioUrl={data.audioUrl}
        projectId={projectId}
        wantRemake={wantRemake}
        onCreated={onCreated}
      />
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: "Video Studio" }} />
      <PageHeader
        title="Video Studio"
        subtitle="Edit the look, lyrics, and timing of your 9:16 video. Presets, effects, and playback stay available before sign-in."
      />
      {campaignId ? null : <CampaignPicker onPick={pickCampaign} />}
      {body}
    </Screen>
  );
}
