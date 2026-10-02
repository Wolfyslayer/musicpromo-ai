import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { ResizeMode, Video } from 'expo-av';
import * as DocumentPicker from 'expo-document-picker';
import { ArrowLeft } from 'lucide-react-native';
import LyricsTimelineEditor from '@/components/LyricsTimelineEditor';
import { RemotionExportWebView } from '@/components/RemotionExportWebView';
import ArtworkUpload from '@/components/ArtworkUpload';
import AudioUpload from '@/components/AudioUpload';
import { ArtworkImage } from '@/components/ArtworkImage';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { Tabs } from '@/components/ui/Tabs';
import { Textarea } from '@/components/ui/Textarea';
import { useAuth } from '@/lib/AuthContext';
import {
  buildLyricCues,
  normalizeEditorLook,
  normalizeParticleEffect,
  normalizeVideoType,
  normalizeVisualStyle,
  PARTICLE_EFFECTS,
  resolveStudioDuration,
  VISUAL_STYLES,
} from '@/lib/promoStyles';
import { useToast } from '@/lib/toast';
import { loadCampaign } from '@/services/data';
import {
  saveVideoProject,
  selectCampaignDay,
  selectVideoProject,
} from '@/services/studioRecords';
import { loadAssetSession } from '@/services/assetAnalysis';
import { videoService, resolvePlayableAudioUrl } from '@/services/videoService';

const EDITOR_TABS = [
  { id: 'look', label: 'Look' },
  { id: 'media', label: 'Media' },
  { id: 'lyrics', label: 'Lyrics' },
  { id: 'effects', label: 'Effects' },
];

type ProjectState = Record<string, unknown>;

function packVideoProject(project: ProjectState, audioSeconds: number) {
  const videoType = normalizeVideoType(
    (project?.video_type as string) || (project?.animation_settings as { videoType?: string })?.videoType,
  );
  const duration = resolveStudioDuration(videoType, project?.duration as number, audioSeconds);
  return {
    ...project,
    duration,
    lyric_cues: buildLyricCues(
      project?.lyrics as string,
      duration,
      project?.lyric_cues as unknown[],
    ),
    animation_settings: {
      ...((project?.animation_settings as object) || {}),
      videoType,
    },
  };
}

export default function VideoGeneratorScreen() {
  const params = useLocalSearchParams<{
    id?: string;
    project?: string;
    day?: string;
    videoType?: string;
    seconds?: string;
    text?: string;
    remake?: string;
  }>();
  const id = params.id ? String(params.id) : '';
  const projectId = params.project ? String(params.project) : '';
  const dayId = params.day ? String(params.day) : '';
  const requestedType = normalizeVideoType(params.videoType || '');
  const requestedSeconds = Number(params.seconds) === 30 ? 30 : 15;
  const requestedText = params.text || '';
  const wantRemake = params.remake === '1';

  const router = useRouter();
  const { toast } = useToast();
  const { user, requireAuth } = useAuth();

  const [loading, setLoading] = useState(Boolean(id));
  const [project, setProject] = useState<ProjectState | null>(null);
  const [previewAudioUrl, setPreviewAudioUrl] = useState('');
  const [editorTab, setEditorTab] = useState('look');
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [renderProgress, setRenderProgress] = useState<{ progress: number; message: string } | null>(
    null,
  );
  const [webExportOpen, setWebExportOpen] = useState(false);
  const [chooseType, setChooseType] = useState(false);
  const [videoTypeChoice, setVideoTypeChoice] = useState<'promo' | 'lyrics'>('promo');
  const [promoSeconds, setPromoSeconds] = useState(15);

  const webBase = String(process.env.EXPO_PUBLIC_WEB_APP_URL || '').replace(/\/$/, '');
  const webStudioUrl = useMemo(() => {
    if (!webBase || !id) return null;
    const q = new URLSearchParams();
    if (projectId) q.set('project', projectId);
    if (dayId) q.set('day', dayId);
    if (project?.video_type) q.set('videoType', String(project.video_type));
    const qs = q.toString();
    return `${webBase}/studio/${id}${qs ? `?${qs}` : ''}`;
  }, [webBase, id, projectId, dayId, project?.video_type]);

  const load = useCallback(async () => {
    if (!id) {
      setProject({
        template: 'LYRICS',
        title: 'Demo',
        artist_name: 'Artist',
        duration: 15,
        video_type: 'promo',
        is_demo_preview: true,
      });
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await loadCampaign(id);
      const profile =
        (data.song as { analysis?: { assetProfile?: unknown } })?.analysis?.assetProfile ||
        loadAssetSession();
      let savedProject: ProjectState | null = null;
      let day: Record<string, unknown> | null = null;
      if (projectId) {
        savedProject = await selectVideoProject(projectId);
      } else if (dayId) {
        day = await selectCampaignDay(dayId);
      }
      const savedType = normalizeVideoType(
        (savedProject?.animation_settings as { videoType?: string })?.videoType,
      );
      const videoType = savedType || requestedType || (projectId ? 'promo' : '');
      if (!videoType) {
        setChooseType(true);
        setProject(null);
        setLoading(false);
        return;
      }
      setChooseType(false);
      const audioSeconds = Number((data.song as { audio_duration?: number })?.audio_duration) || 0;
      const duration = resolveStudioDuration(
        videoType,
        videoType === 'promo'
          ? (savedProject?.duration as number) || requestedSeconds
          : (savedProject?.duration as number) || audioSeconds,
        audioSeconds,
      );
      let base: ProjectState = {
        template: (profile as { template?: string })?.template || 'LYRICS',
        title: (data.song as { title?: string })?.title || '',
        artist_name: (data.artist as { name?: string })?.name || '',
        text:
          videoType === 'promo'
            ? String(day?.hook || requestedText || (profile as { hooks?: string[] })?.hooks?.[0] || '')
            : '',
        outro_cta: videoType === 'promo' ? String(day?.cta || 'Listen now') : '',
        artwork_url: (data.song as { artwork_url?: string })?.artwork_url || '',
        audio_url: (data.song as { audio_url?: string })?.audio_url || '',
        audio_duration: audioSeconds,
        lyrics: (data.song as { lyrics?: string })?.lyrics || '',
        visual_style: normalizeVisualStyle((profile as { visualStyle?: string })?.visualStyle || 'pop'),
        particle_effect: normalizeParticleEffect(
          (profile as { particleEffect?: string })?.particleEffect || 'none',
        ),
        editor_look: normalizeEditorLook(null),
        lyric_cues: buildLyricCues((data.song as { lyrics?: string })?.lyrics || '', duration, []),
        duration,
        video_type: videoType,
        song_id: (data.song as { id?: string })?.id,
        campaign_id: id,
        animation_settings: { videoType },
      };
      if (savedProject) {
        base = {
          ...base,
          ...savedProject,
          video_type: videoType,
          duration: resolveStudioDuration(
            videoType,
            (savedProject.duration as number) || duration,
            audioSeconds,
          ),
        };
      }
      setProject(base);
    } catch (e) {
      console.error(e);
      toast({ title: 'Could not load studio', description: e instanceof Error ? e.message : undefined });
    } finally {
      setLoading(false);
    }
  }, [id, projectId, dayId, requestedType, requestedSeconds, requestedText, toast]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!project?.audio_url) {
        setPreviewAudioUrl('');
        return;
      }
      const url = await resolvePlayableAudioUrl(String(project.audio_url));
      if (!cancelled) setPreviewAudioUrl(url);
    })();
    return () => {
      cancelled = true;
    };
  }, [project?.audio_url]);

  const set = (k: string, v: unknown) => setProject((p) => (p ? { ...p, [k]: v } : p));

  const hasLiveMp4 =
    project?.render_output_url && /^https:\/\//i.test(String(project.render_output_url));
  const showLivePreview = Boolean(hasLiveMp4 && !wantRemake);

  const confirmVideoType = () => {
    setChooseType(false);
    router.setParams({
      videoType: videoTypeChoice,
      seconds: videoTypeChoice === 'promo' ? String(promoSeconds) : undefined,
    });
    load();
  };

  const save = async () => {
    if (!project) return;
    setSaving(true);
    try {
      const audioSeconds = Number(project.audio_duration) || 0;
      const packed = packVideoProject(project, audioSeconds);
      const payload = {
        ...packed,
        visual_style: normalizeVisualStyle(project.visual_style as string),
        particle_effect: normalizeParticleEffect(project.particle_effect as string),
        editor_look: normalizeEditorLook(project.editor_look),
        user_id: (project.user_id as string) || user?.id || '',
        is_demo: false,
      };
      if (project.id || projectId) {
        const pid = String(project.id || projectId);
        await saveVideoProject({ ...payload, id: pid });
        setProject((p) => (p ? { ...p, ...payload, id: pid } : p));
      } else {
        const created = await saveVideoProject(payload);
        setProject((p) => (p ? { ...p, ...payload, id: created.id } : p));
        router.setParams({ project: created.id });
      }
      toast({ title: 'Video project saved' });
    } catch (e) {
      toast({
        title: 'Save failed',
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  const exportVideo = async () => {
    if (!project?.artwork_url) {
      toast({ title: 'Artwork required', description: 'Add artwork before rendering.' });
      return;
    }
    if (!project?.audio_url) {
      toast({ title: 'Audio required', description: 'Add audio before rendering.' });
      return;
    }
    setExporting(true);
    setRenderProgress({ progress: 0, message: 'Starting export…' });
    try {
      let working: ProjectState = {
        ...packVideoProject(project, Number(project.audio_duration) || 0),
        user_id: (project.user_id as string) || user?.id || '',
      };
      if (!working.id && !projectId) {
        const created = await saveVideoProject({
          ...working,
          rendering_status: 'rendering',
          is_demo: false,
        });
        working = { ...working, id: created.id };
        setProject(working);
        router.setParams({ project: created.id });
      }

      const res = await videoService.exportVideo(working as Record<string, unknown>, {
        audioUrl: previewAudioUrl || undefined,
        onProgress: (info: { progress?: number; message?: string }) => {
          setRenderProgress({
            progress: info.progress ?? 0,
            message: info.message || 'Rendering…',
          });
        },
      });

      if (res?.status === 'needs_web_render') {
        const pid = String(working.id || projectId || '');
        if (pid && process.env.EXPO_PUBLIC_WEB_APP_URL) {
          setWebExportOpen(true);
        } else {
          toast({
            title: 'Web render required',
            description: res.message || 'Set EXPO_PUBLIC_WEB_APP_URL or upload an MP4.',
          });
        }
      } else if (res?.status === 'ready' && res.downloadUrl) {
        setProject((p) =>
          p
            ? {
                ...p,
                ...(res.project || {}),
                render_output_url: res.downloadUrl,
                rendering_status: 'complete',
              }
            : p,
        );
        toast({ title: 'Video exported', description: 'Preview updated with rendered MP4.' });
      } else {
        toast({
          title: 'Export failed',
          description: res?.message || 'Could not render on this device.',
        });
      }
    } catch (e) {
      toast({
        title: 'Export failed',
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setExporting(false);
      setRenderProgress(null);
    }
  };

  const uploadMp4 = async () => {
    const pick = await DocumentPicker.getDocumentAsync({ type: 'video/mp4', copyToCacheDirectory: true });
    if (pick.canceled || !pick.assets[0] || !project) return;
    const resp = await fetch(pick.assets[0].uri);
    const blob = await resp.blob();
    setExporting(true);
    try {
      const res = await videoService.exportVideo(project, {
        videoFile: blob,
        onProgress: (info: { message?: string }) => {
          setRenderProgress({ progress: 90, message: info.message || 'Uploading…' });
        },
      });
      if (res?.status === 'ready' && res.downloadUrl) {
        setProject((p) =>
          p ? { ...p, render_output_url: res.downloadUrl, rendering_status: 'complete' } : p,
        );
        toast({ title: 'MP4 uploaded' });
      } else {
        toast({ title: 'Upload failed', description: res?.message });
      }
    } finally {
      setExporting(false);
      setRenderProgress(null);
    }
  };

  if (loading) return <ActivityIndicator className="flex-1 py-24" />;

  if (chooseType) {
    return (
      <ScrollView className="flex-1 bg-background p-4" contentContainerClassName="gap-4">
        <Text className="text-xl font-bold text-foreground">Choose video type</Text>
        <Tabs
          value={videoTypeChoice}
          onChange={(v) => setVideoTypeChoice(v as 'promo' | 'lyrics')}
          tabs={[
            { id: 'promo', label: 'Promo (15–30s)' },
            { id: 'lyrics', label: 'Full lyrics' },
          ]}
        />
        {videoTypeChoice === 'promo' ? (
          <View className="flex-row gap-2">
            {[15, 30].map((s) => (
              <Pressable
                key={s}
                onPress={() => setPromoSeconds(s)}
                className={`rounded-full border px-4 py-2 ${
                  promoSeconds === s ? 'border-primary bg-primary/15' : 'border-border'
                }`}
              >
                <Text className={promoSeconds === s ? 'text-primary' : 'text-foreground'}>{s}s</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        <Button label="Continue" onPress={confirmVideoType} />
      </ScrollView>
    );
  }

  if (!project) {
    return (
      <View className="flex-1 items-center justify-center p-4">
        <Text className="text-muted-foreground">No project loaded.</Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="gap-4 p-4 pb-12">
      <Pressable
        onPress={() => router.push(id ? `/campaigns/${id}` : '/')}
        className="flex-row items-center gap-1.5"
      >
        <ArrowLeft color="#64748b" size={16} />
        <Text className="text-sm text-muted-foreground">{id ? 'Campaign' : 'Home'}</Text>
      </Pressable>

      <View className="aspect-[9/16] w-full max-w-sm self-center overflow-hidden rounded-2xl border border-border bg-black">
        {showLivePreview ? (
          <Video
            source={{ uri: String(project.render_output_url) }}
            style={{ flex: 1 }}
            useNativeControls
            resizeMode={ResizeMode.COVER}
            isLooping
            shouldPlay
          />
        ) : (
          <View className="flex-1 items-center justify-center">
            <ArtworkImage src={String(project.artwork_url || '')} className="h-full w-full" />
            <View className="absolute bottom-3 rounded-full bg-black/60 px-3 py-1">
              <Text className="text-xs text-white">Preview · edit & export to render MP4</Text>
            </View>
          </View>
        )}
      </View>

      <View className="flex-row flex-wrap gap-2">
        <Button
          variant="outline"
          label={saving ? 'Saving…' : 'Save'}
          onPress={() => {
            if (!requireAuth(save)) router.push('/login');
          }}
          disabled={saving}
        />
        <Button
          label={exporting ? 'Exporting…' : 'Export MP4'}
          onPress={() => {
            if (!requireAuth(exportVideo)) router.push('/login');
          }}
          disabled={exporting}
        />
        <Button
          variant="outline"
          label="Upload MP4"
          onPress={() => {
            if (!requireAuth(uploadMp4)) router.push('/login');
          }}
        />
      </View>

      {renderProgress ? (
        <View>
          <Text className="text-sm text-muted-foreground">{renderProgress.message}</Text>
          <View className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
            <View className="h-full bg-primary" style={{ width: `${renderProgress.progress}%` }} />
          </View>
        </View>
      ) : null}

      <Tabs value={editorTab} onChange={setEditorTab} tabs={EDITOR_TABS} />

      {editorTab === 'look' && (
        <View className="gap-4">
          <View className="gap-1.5">
            <Label>Visual style</Label>
            <Select
              value={String(project.visual_style || 'pop')}
              onValueChange={(v) => set('visual_style', v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VISUAL_STYLES.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </View>
          <Input label="On-screen hook" value={String(project.text || '')} onChangeText={(v) => set('text', v)} />
          <Input
            label="Outro CTA"
            value={String(project.outro_cta || '')}
            onChangeText={(v) => set('outro_cta', v)}
          />
          <View className="flex-row gap-2">
            {[15, 30].map((s) => (
              <Pressable
                key={s}
                onPress={() => set('duration', s)}
                className={`rounded-full border px-4 py-2 ${
                  project.duration === s ? 'border-primary bg-primary/15' : 'border-border'
                }`}
              >
                <Text>{s}s</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {editorTab === 'media' && (
        <View className="gap-4">
          <ArtworkUpload
            guard={requireAuth}
            value={String(project.artwork_url || '')}
            onChange={(payload) => {
              const url = typeof payload === 'string' ? payload : payload?.url || '';
              set('artwork_url', url);
            }}
          />
          <AudioUpload
            guard={requireAuth}
            value={String(project.audio_url || '')}
            signedUrl={previewAudioUrl}
            onChange={({ file_uri, signed_url }) => {
              set('audio_url', file_uri);
              if (signed_url) setPreviewAudioUrl(signed_url);
            }}
          />
        </View>
      )}

      {editorTab === 'lyrics' && (
        <LyricsTimelineEditor
          lyrics={String(project.lyrics || '')}
          cues={(project.lyric_cues as never[]) || []}
          duration={Number(project.duration) || 15}
          audioUrl={previewAudioUrl}
          onRequireAuth={() => requireAuth()}
          onChange={({ lyric_cues, lyrics }) => {
            setProject((p) => (p ? { ...p, lyric_cues, lyrics } : p));
          }}
        />
      )}

      {editorTab === 'effects' && (
        <View className="gap-2">
          {PARTICLE_EFFECTS.map((fx) => (
            <Pressable
              key={fx.id}
              onPress={() => set('particle_effect', fx.id)}
              className={`rounded-xl border p-3 ${
                project.particle_effect === fx.id ? 'border-primary bg-primary/10' : 'border-border'
              }`}
            >
              <Text className="font-semibold text-foreground">{fx.label}</Text>
              <Text className="text-xs text-muted-foreground">{fx.description}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <RemotionExportWebView
        visible={webExportOpen}
        projectId={String(project.id || projectId || '')}
        onClose={() => setWebExportOpen(false)}
        onProgress={(info) =>
          setRenderProgress({
            progress: info.progress ?? 0,
            message: info.message || 'Rendering…',
          })
        }
        onComplete={(res) => {
          if (res.status === 'ready' && res.downloadUrl) {
            setProject((p) =>
              p
                ? {
                    ...p,
                    ...(res.project || {}),
                    render_output_url: res.downloadUrl,
                    rendering_status: 'complete',
                  }
                : p,
            );
            toast({ title: 'Video exported', description: 'Remotion render complete.' });
          } else {
            toast({ title: 'Export failed', description: res.message });
          }
          setRenderProgress(null);
        }}
      />
    </ScrollView>
  );
}
