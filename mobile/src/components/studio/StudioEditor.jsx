import { useEffect, useState } from "react";
import { View } from "react-native";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { Save } from "lucide-react-native";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { Text } from "@/components/ui/text";
import { saveVideoProject } from "@/services/studioRecords";
import { clampAudioOffset, normalizeEditorLook, resolveStudioDuration } from "@/services/promoStyles";
import AssetsSection from "./AssetsSection";
import AudioOffsetSection from "./AudioOffsetSection";
import LyricsSection from "./LyricsSection";
import RenderCard from "./RenderCard";
import RenderedVideo from "./RenderedVideo";
import StudioPreview from "./StudioPreview";
import StyleSection from "./StyleSection";
import TextSection from "./TextSection";
import {
  applyPreset,
  buildSavePayload,
  editableCues,
  isHttpsUrl,
  studioCues,
  studioDuration,
  styleFingerprint,
} from "./studioProject";

export default function StudioEditor({ initialProject, initialAudioUrl, projectId, wantRemake, onCreated }) {
  const { user, requireAuth } = useAuth();
  const { toast } = useToast();
  const [project, setProject] = useState(initialProject);
  const [exportedFp] = useState(() => styleFingerprint(initialProject));
  const [previewUrl, setPreviewUrl] = useState(initialAudioUrl || "");
  const [saving, setSaving] = useState(false);

  const player = useAudioPlayer(previewUrl ? { uri: previewUrl } : null, { updateInterval: 200 });
  const status = useAudioPlayerStatus(player);

  const audioSeconds = Number(project.audio_duration) || (status.duration > 0 ? status.duration : 0);
  const duration = studioDuration(project, audioSeconds);
  const lyricsVideo = project.video_type === "lyrics";
  const offset = lyricsVideo ? 0 : clampAudioOffset(project.audioStartTimeOffset, audioSeconds, duration);
  const windowEnd = offset + duration;

  useEffect(() => {
    if (status.playing && status.currentTime >= windowEnd) player.seekTo(offset);
  }, [status.playing, status.currentTime, windowEnd, offset, player]);

  const togglePlay = async () => {
    if (status.playing) {
      player.pause();
      return;
    }
    const t = Number(status.currentTime) || 0;
    if (t < offset || t >= windowEnd - 0.1) await player.seekTo(offset);
    player.play();
  };

  const patch = (next) => setProject((current) => ({ ...current, ...next }));
  const setField = (key, value) => patch({ [key]: value });
  const setLook = (look) =>
    setProject((current) => ({
      ...current,
      editor_look: normalizeEditorLook({ ...normalizeEditorLook(current.editor_look), ...look }),
    }));

  const setVideoType = (videoType) =>
    setProject((current) => ({
      ...current,
      video_type: videoType,
      duration: resolveStudioDuration(videoType, current.duration, audioSeconds),
      ...(videoType === "lyrics" ? { audioStartTimeOffset: 0 } : null),
    }));

  const setAudio = ({ file_uri, signed_url, duration: seconds }) => {
    setProject((current) => ({
      ...current,
      audio_url: file_uri || "",
      audio_duration: Number(seconds) || (file_uri && file_uri === current.audio_url ? current.audio_duration : 0),
    }));
    if (signed_url || !file_uri) setPreviewUrl(signed_url || "");
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = buildSavePayload(project, audioSeconds, user?.id);
      const pid = project.id || projectId;
      if (pid) {
        await saveVideoProject({ ...payload, id: pid });
        setProject((current) => ({ ...current, ...payload, video_type: project.video_type, id: pid }));
      } else {
        const created = await saveVideoProject(payload);
        setProject((current) => ({ ...current, ...payload, video_type: project.video_type, id: created.id }));
        onCreated?.(created.id);
      }
      toast({ title: "Video project saved" });
    } catch (e) {
      toast({ variant: "destructive", title: "Save failed", description: e.message });
    } finally {
      setSaving(false);
    }
  };

  const hasLiveMp4 = isHttpsUrl(project.render_output_url);
  const styleDirty = wantRemake || styleFingerprint(project) !== exportedFp;
  const saveButton = (
    <Button icon={Save} loading={saving} onPress={() => requireAuth(save)} className="rounded-full">
      {saving ? "Saving…" : "Save project"}
    </Button>
  );

  return (
    <View className="gap-5">
      {hasLiveMp4 ? (
        <RenderedVideo url={project.render_output_url} title={project.title} styleDirty={styleDirty} />
      ) : project.rendering_status === "rendering" ? (
        <Text className="rounded-xl border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground">
          A render was started for this project. Pull the finished MP4 in by reopening the project once it completes.
        </Text>
      ) : null}

      <StudioPreview
        project={project}
        duration={duration}
        cues={studioCues(project, audioSeconds)}
        offset={offset}
        status={status}
        canPlay={Boolean(previewUrl)}
        onTogglePlay={togglePlay}
      />

      {saveButton}

      <AssetsSection
        project={project}
        previewAudioUrl={previewUrl}
        onArtwork={(url) => setField("artwork_url", url)}
        onAudio={setAudio}
      />
      <TextSection project={project} onField={setField} />
      <StyleSection
        project={project}
        duration={duration}
        onVideoType={setVideoType}
        onField={setField}
        onLook={setLook}
        onDuration={(seconds) => setField("duration", resolveStudioDuration(project.video_type, seconds, audioSeconds))}
        onPreset={(preset) => setProject((current) => applyPreset(current, preset, audioSeconds))}
      />
      {lyricsVideo ? null : (
        <AudioOffsetSection
          offset={offset}
          duration={duration}
          audioSeconds={audioSeconds}
          onOffset={(seconds) => setField("audioStartTimeOffset", clampAudioOffset(seconds, audioSeconds, duration))}
        />
      )}
      <LyricsSection
        lyrics={project.lyrics}
        cues={editableCues(project, audioSeconds)}
        duration={duration}
        syncFocus={lyricsVideo}
        currentTime={status.currentTime}
        canTap={Boolean(previewUrl)}
        onChange={patch}
      />

      {saveButton}
      <RenderCard project={project} projectId={project.id || projectId} duration={duration} />
    </View>
  );
}
