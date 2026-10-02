import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CheckCircle2, ExternalLink, Link2, Pause, Play, RefreshCw, Save, Share2, Video } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Share, View } from 'react-native';

import ArtworkUpload from '@/components/ArtworkUpload';
import AudioUpload from '@/components/AudioUpload';
import LyricsTimelineEditor from '@/components/LyricsTimelineEditor';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input, Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs } from '@/components/ui/tabs';
import { Text } from '@/components/ui/text';
import { toast } from '@/components/ui/use-toast';
import CampaignPresets, { type VideoPreset } from '@/components/video/CampaignPresets';
import EditorSidebar from '@/components/video/EditorSidebar';
import MultiTrackTimeline from '@/components/video/MultiTrackTimeline';
import VideoPreview, { RenderedVideoPlayer } from '@/components/video/VideoPreview';
import VideoTypeModal from '@/components/video/VideoTypeModal';
import VideoRenderProgress from '@/components/VideoRenderProgress';
import { useAuth, useWorkspaceRefresh } from '@/lib/AuthContext';
import { cn } from '@/lib/utils';
import {
  EXPORT_DURATIONS,
  VISUAL_STYLES,
  buildLyricCues,
  clampAudioOffset,
  formatClock,
  normalizeEditorLook,
  normalizeParticleEffect,
  normalizeVideoType,
  normalizeVisualStyle,
  resolveStudioDuration,
  scaleLyricCues,
} from '@/remotion/styles';
import { loadCampaign } from '@/services/data';
import { triggerCampaignAutoVideo } from '@/services/socialService';
import { saveCampaignLyrics, saveVideoProject, selectCampaignDay, selectVideoProject } from '@/services/studioRecords';
import { VIDEO_TEMPLATES } from '@/services/videoTemplates';
import { pollRenderStatus, resolvePlayableAudioUrl, videoService } from '@/services/videoService';

const EDITOR_TABS = [
  { value: 'look', label: 'Look' },
  { value: 'media', label: 'Media' },
  { value: 'lyrics', label: 'Lyrics' },
  { value: 'effects', label: 'FX' },
];

const ACTIVE_RENDER_STATES = new Set(['queued', 'rendering']);
const RESUME_WINDOW_MS = 15 * 60 * 1000;

type Project = Record<string, any>;

function param(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] || '' : value || '';
}

function isHttps(value?: string | null) {
  return /^https:\/\//i.test(String(value || ''));
}

function packVideoProject(project: Project, audioSeconds: number): Project {
  const videoType = normalizeVideoType(project?.video_type || project?.animation_settings?.videoType);
  const duration = resolveStudioDuration(videoType, project?.duration, audioSeconds);
  const { video_type: _videoType, outro_cta: outroCta, asset_keywords: keywords, asset_hooks: hooks, asset_label: label, ...rest } = project || {};
  return {
    ...rest,
    duration,
    lyric_cues: buildLyricCues(project?.lyrics, duration, project?.lyric_cues),
    animation_settings: {
      ...(project?.animation_settings || {}),
      videoType,
      outroCta: outroCta || project?.animation_settings?.outroCta || '',
      keywords: keywords || project?.animation_settings?.keywords || [],
      hooks: hooks || project?.animation_settings?.hooks || [],
      label: label || project?.animation_settings?.label || '',
    },
  };
}

function styleFingerprint(p?: Project | null) {
  if (!p) return '';
  return [
    p.visual_style,
    p.particle_effect,
    p.duration,
    JSON.stringify(normalizeEditorLook(p.editor_look)),
    p.audioStartTimeOffset || 0,
    p.title,
    p.artist_name,
    p.text,
    p.outro_cta,
    JSON.stringify(p.lyric_cues || []).slice(0, 400),
    (p.lyrics || '').slice(0, 200),
  ].join('|');
}

function blankProject(): Project {
  return {
    template: 'LYRICS',
    title: '',
    artist_name: '',
    text: '',
    outro_cta: 'Listen now',
    artwork_url: '',
    audio_url: '',
    audio_duration: 0,
    lyrics: '',
    visual_style: 'pop',
    particle_effect: 'none',
    editor_look: normalizeEditorLook(null),
    lyric_cues: [],
    audioStartTimeOffset: 0,
    duration: 15,
    video_type: 'promo',
  };
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="gap-1.5">
      <Label className="mb-0 text-xs text-muted-foreground">{label}</Label>
      {children}
    </View>
  );
}

export default function VideoGenerator() {
  const router = useRouter();
  const search = useLocalSearchParams<{ id?: string; project?: string; day?: string; videoType?: string; seconds?: string; text?: string; remake?: string }>();
  const id = param(search.id);
  const projectId = param(search.project);
  const dayId = param(search.day);
  const requestedType = normalizeVideoType(param(search.videoType));
  const requestedSeconds = Number(param(search.seconds)) === 30 ? 30 : 15;
  const requestedText = param(search.text);
  const wantRemake = param(search.remake) === '1';
  const { user, requireAuth } = useAuth();

  const [refreshTick, setRefreshTick] = useState(0);
  const refreshWorkspace = useCallback(() => setRefreshTick((n) => n + 1), []);
  useWorkspaceRefresh(refreshWorkspace);

  const [project, setProject] = useState<Project | null>(null);
  const [previewAudioUrl, setPreviewAudioUrl] = useState('');
  const [audioDuration, setAudioDuration] = useState(0);
  const [exportedFp, setExportedFp] = useState('');
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportResult, setExportResult] = useState<{ status: string; message?: string; downloadUrl?: string | null } | null>(null);
  const [renderProgress, setRenderProgress] = useState<{ progress: number; message: string } | null>(null);
  const [forceLastMp4, setForceLastMp4] = useState(false);
  const [editorTab, setEditorTab] = useState('look');
  const [chooseType, setChooseType] = useState(false);
  const [typeSheetOpen, setTypeSheetOpen] = useState(false);
  const [linking, setLinking] = useState(false);

  const skipLoadFor = useRef<string | null>(null);
  const pollAbort = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const lyricsTabSynced = useRef(false);

  useEffect(() => {
    mounted.current = true;
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
    return () => {
      mounted.current = false;
      pollAbort.current?.abort();
    };
  }, []);

  const player = useAudioPlayer(previewAudioUrl || null, { updateInterval: 250 });
  const status = useAudioPlayerStatus(player);

  useEffect(() => {
    if (status.isLoaded && status.duration > 0) setAudioDuration(status.duration);
  }, [status.isLoaded, status.duration]);

  const videoType = normalizeVideoType(project?.video_type);
  const studioDuration = resolveStudioDuration(videoType, project?.duration, audioDuration || project?.audio_duration);
  const offset = Math.max(0, Number(project?.audioStartTimeOffset) || 0);

  const touchStyle = useCallback(() => setForceLastMp4(false), []);

  const startPolling = useCallback(
    async (pid: string, base: Project) => {
      pollAbort.current?.abort();
      const controller = new AbortController();
      pollAbort.current = controller;
      setExporting(true);
      setRenderProgress({ progress: 15, message: 'Waiting for a render slot…' });
      const result = await pollRenderStatus(pid, {
        signal: controller.signal,
        onProgress: (info: { progress: number; message: string }) => {
          if (mounted.current && !controller.signal.aborted) setRenderProgress({ progress: info.progress, message: info.message });
        },
      });
      if (!mounted.current || controller.signal.aborted) return;
      setExporting(false);
      setRenderProgress(null);
      if (result.status === 'ready' && result.downloadUrl) {
        const next = { ...base, ...(result.project || {}), render_output_url: result.downloadUrl, rendering_status: 'complete', id: pid };
        setProject(next);
        setExportedFp(styleFingerprint(next));
        setForceLastMp4(false);
        setExportResult({ status: 'ready', message: 'Your promo video is ready.', downloadUrl: result.downloadUrl });
        toast({ title: 'Video ready', description: 'Playing the rendered MP4.' });
      } else {
        if (result.project) setProject((current) => ({ ...(current || {}), ...result.project, id: pid }));
        setExportResult({ status: 'failed', message: result.message });
        toast({ variant: 'destructive', title: result.status === 'timeout' ? 'Still rendering' : 'Render failed', description: result.message });
      }
    },
    []
  );

  useEffect(() => {
    if (projectId && skipLoadFor.current === projectId) {
      skipLoadFor.current = null;
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        if (!id) {
          let saved: Project | null = null;
          if (projectId) saved = await selectVideoProject(projectId);
          if (cancelled) return;
          const type = normalizeVideoType(saved?.animation_settings?.videoType || saved?.video_type) || 'promo';
          const base = blankProject();
          const next = saved
            ? {
                ...base,
                ...saved,
                video_type: type,
                outro_cta: saved.animation_settings?.outroCta || base.outro_cta,
                visual_style: normalizeVisualStyle(saved.visual_style),
                particle_effect: normalizeParticleEffect(saved.particle_effect),
                editor_look: normalizeEditorLook(saved.editor_look),
                duration: resolveStudioDuration(type, saved.duration, saved.audio_duration),
                lyric_cues: buildLyricCues(saved.lyrics, resolveStudioDuration(type, saved.duration, saved.audio_duration), saved.lyric_cues),
              }
            : { ...base, video_type: requestedType || 'promo', duration: requestedType === 'promo' || !requestedType ? requestedSeconds : base.duration, text: requestedText };
          setChooseType(false);
          setProject(next);
          applyLiveState(next);
          return;
        }

        const data = await loadCampaign(id);
        const profile = data.song?.analysis?.assetProfile || null;
        let savedType = '';
        let savedProject: Project | null = null;
        let day: Project | null = null;
        if (projectId) {
          savedProject = await selectVideoProject(projectId);
          savedType = normalizeVideoType(savedProject?.animation_settings?.videoType);
        } else if (dayId) {
          day = await selectCampaignDay(dayId);
        }
        const type = savedType || requestedType || (projectId ? 'promo' : '');
        if (!type) {
          if (!cancelled) {
            setProject(null);
            setChooseType(true);
          }
          return;
        }
        if (!cancelled) setChooseType(false);
        const audioSeconds = Number(data.song?.audio_duration) || 0;
        const duration = resolveStudioDuration(
          type,
          type === 'promo' ? savedProject?.duration || requestedSeconds : savedProject?.duration || audioSeconds,
          audioSeconds
        );
        let base: Project = {
          template: profile?.template || 'LYRICS',
          title: data.song?.title || '',
          artist_name: data.artist?.name || '',
          text: type === 'promo' ? day?.hook || requestedText || profile?.hooks?.[0] || '' : '',
          outro_cta: type === 'promo' ? day?.cta || 'Listen now' : '',
          artwork_url: data.song?.artwork_url || '',
          audio_url: data.song?.audio_url || '',
          audio_duration: audioSeconds,
          lyrics: data.song?.lyrics || '',
          visual_style: normalizeVisualStyle(profile?.visualStyle || 'pop'),
          particle_effect: normalizeParticleEffect(profile?.particleEffect || 'none'),
          editor_look: normalizeEditorLook(null),
          lyric_cues: buildLyricCues(data.song?.lyrics || '', duration, []),
          audioStartTimeOffset: 0,
          duration,
          video_type: type,
          asset_label: profile?.label || '',
          asset_keywords: profile?.keywords || [],
          asset_hooks: profile?.hooks || [],
          song_id: data.song?.id,
          campaign_id: id,
          animation_settings: {
            videoType: type,
            outroCta: type === 'promo' ? day?.cta || 'Listen now' : '',
            keywords: profile?.keywords || [],
            hooks: profile?.hooks || [],
            label: profile?.label || '',
          },
        };
        if (savedProject) {
          const savedDuration = resolveStudioDuration(type, savedProject.duration || duration, audioSeconds);
          base = {
            ...base,
            ...savedProject,
            video_type: type,
            outro_cta: savedProject.animation_settings?.outroCta || base.outro_cta,
            visual_style: normalizeVisualStyle(savedProject.visual_style || base.visual_style),
            particle_effect: normalizeParticleEffect(savedProject.particle_effect || base.particle_effect),
            editor_look: normalizeEditorLook(savedProject.editor_look || base.editor_look),
            duration: savedDuration,
            lyric_cues: buildLyricCues(savedProject.lyrics || base.lyrics, savedDuration, savedProject.lyric_cues),
          };
        } else if (day) {
          base = {
            ...base,
            text: type === 'promo' ? day.hook || day.caption || base.text : '',
            outro_cta: type === 'promo' ? day.cta || base.outro_cta : '',
          };
        }
        if (cancelled) return;
        setProject(base);
        applyLiveState(base);
      } catch (err: any) {
        if (cancelled) return;
        toast({ variant: 'destructive', title: 'Could not open the studio', description: err?.message || 'Try again in a moment.' });
        setProject((current) => current || blankProject());
      }
    })();

    function applyLiveState(base: Project) {
      if (cancelled) return;
      const live = isHttps(base.render_output_url) && base.rendering_status === 'complete';
      setExportedFp(live ? styleFingerprint(base) : '');
      const updated = Date.parse(base.updated_date || '') || 0;
      if (base.id && ACTIVE_RENDER_STATES.has(base.rendering_status) && Date.now() - updated < RESUME_WINDOW_MS) {
        startPolling(String(base.id), base);
      }
    }

    return () => {
      cancelled = true;
    };
  }, [id, projectId, dayId, refreshTick, requestedType, requestedSeconds, requestedText, startPolling]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!project?.audio_url) {
        setPreviewAudioUrl('');
        return;
      }
      const url = await resolvePlayableAudioUrl(project.audio_url);
      if (!cancelled) setPreviewAudioUrl(url);
    })();
    return () => {
      cancelled = true;
    };
  }, [project?.audio_url]);

  useEffect(() => {
    if (lyricsTabSynced.current || requestedType !== 'lyrics') return;
    lyricsTabSynced.current = true;
    setEditorTab('lyrics');
  }, [requestedType]);

  useEffect(() => {
    if (!project || project.video_type !== 'lyrics' || !audioDuration) return;
    const next = resolveStudioDuration('lyrics', audioDuration, audioDuration);
    if (next === project.duration && !(Number(project.audioStartTimeOffset) > 0)) return;
    setProject((current) => (current ? { ...current, duration: next, audioStartTimeOffset: 0, audio_duration: audioDuration } : current));
  }, [audioDuration, project?.video_type, project?.duration, project?.audioStartTimeOffset, project]);

  useEffect(() => {
    if (!project) return;
    const next = clampAudioOffset(project.audioStartTimeOffset, audioDuration, resolveStudioDuration(project.video_type, project.duration, audioDuration));
    if (next === (Number(project.audioStartTimeOffset) || 0)) return;
    setProject((current) => (current ? { ...current, audioStartTimeOffset: next } : current));
  }, [audioDuration, project?.duration, project?.audioStartTimeOffset, project]);

  useEffect(() => {
    if (!status.playing) return;
    if (status.currentTime >= offset + studioDuration - 0.05 || status.currentTime < offset - 0.5) {
      player.pause();
      player.seekTo(offset).catch(() => {});
    }
  }, [status.playing, status.currentTime, offset, studioDuration, player]);

  const togglePlay = () => {
    if (!previewAudioUrl) {
      toast({ title: 'Add audio first', description: 'Upload a song on the Media tab to preview it.' });
      return;
    }
    if (status.playing) {
      player.pause();
      return;
    }
    if (status.currentTime < offset || status.currentTime >= offset + studioDuration - 0.1) {
      player.seekTo(offset).catch(() => {});
    }
    player.play();
  };

  const seekLocal = (local: number) => {
    const target = offset + Math.max(0, Math.min(studioDuration, local));
    player.seekTo(target).catch(() => {});
  };

  const set = (key: string, value: unknown) => {
    setProject((p) => ({ ...(p || {}), [key]: value }));
    touchStyle();
  };

  const setLook = (patch: Record<string, unknown>) => {
    setProject((p) => ({ ...(p || {}), editor_look: normalizeEditorLook({ ...normalizeEditorLook(p?.editor_look), ...patch }) }));
    touchStyle();
  };

  const setAudioOffset = (seconds: number) => {
    const next = clampAudioOffset(seconds, audioDuration, studioDuration);
    setProject((current) => ({ ...(current || {}), audioStartTimeOffset: next }));
    if (!status.playing) player.seekTo(next).catch(() => {});
    touchStyle();
  };

  const applyPreset = (preset: VideoPreset) => {
    setProject((current) => {
      if (!current || current.video_type === 'lyrics') return current;
      const from = resolveStudioDuration(current.video_type, current.duration, audioDuration);
      const nextDuration = resolveStudioDuration(current.video_type, preset.seconds, audioDuration);
      const cues = buildLyricCues(current.lyrics, from, current.lyric_cues);
      return {
        ...current,
        duration: nextDuration,
        editor_look: normalizeEditorLook({ ...normalizeEditorLook(current.editor_look), ...preset.look }),
        lyric_cues: scaleLyricCues(cues, from, nextDuration),
      };
    });
    touchStyle();
  };

  const changeVideoType = (choice: { videoType: 'lyrics' | 'promo'; seconds: number }) => {
    setProject((current) => {
      if (!current) return current;
      const seconds = choice.videoType === 'promo' ? choice.seconds || 15 : audioDuration || current.audio_duration;
      const nextDuration = resolveStudioDuration(choice.videoType, seconds, audioDuration || current.audio_duration);
      const from = resolveStudioDuration(current.video_type, current.duration, audioDuration);
      return {
        ...current,
        video_type: choice.videoType,
        duration: nextDuration,
        audioStartTimeOffset: choice.videoType === 'lyrics' ? 0 : current.audioStartTimeOffset,
        outro_cta: choice.videoType === 'promo' ? current.outro_cta || 'Listen now' : '',
        lyric_cues: scaleLyricCues(buildLyricCues(current.lyrics, from, current.lyric_cues), from, nextDuration),
      };
    });
    touchStyle();
  };

  const hasLiveMp4 = Boolean(project && isHttps(project.render_output_url) && project.rendering_status === 'complete');
  const currentFp = useMemo(() => styleFingerprint(project), [project]);
  const styleDirty = Boolean(hasLiveMp4 && exportedFp && currentFp !== exportedFp);
  const showRendered = hasLiveMp4 && !exporting && (forceLastMp4 || (!styleDirty && !wantRemake));

  const buildWorking = (): Project => ({
    ...packVideoProject(project || {}, audioDuration),
    video_type: project?.video_type,
    outro_cta: project?.outro_cta,
    visual_style: normalizeVisualStyle(project?.visual_style),
    particle_effect: normalizeParticleEffect(project?.particle_effect),
    editor_look: normalizeEditorLook(project?.editor_look),
    audio_duration: audioDuration || project?.audio_duration || 0,
    audioStartTimeOffset: clampAudioOffset(project?.audioStartTimeOffset, audioDuration, studioDuration),
    user_id: project?.user_id || user?.id || '',
    campaign_id: project?.campaign_id || id || null,
    is_demo: false,
  });

  const adoptSaved = (created: Project, working: Project) => {
    const pid = String(created.id);
    setProject((p) => ({ ...(p || {}), ...working, video_type: working.video_type, outro_cta: working.outro_cta, id: pid }));
    if (!projectId || projectId !== pid) {
      skipLoadFor.current = pid;
      router.setParams({ project: pid });
    }
    return pid;
  };

  const save = async () => {
    if (!project) return;
    setSaving(true);
    try {
      const working = buildWorking();
      const created = await saveVideoProject(project.id || projectId ? { ...working, id: project.id || projectId } : working);
      adoptSaved(created, working);
      toast({ title: 'Video project saved' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Save failed', description: e.message });
    } finally {
      setSaving(false);
    }
  };

  const renderVideo = async () => {
    if (!project) return;
    if (!project.artwork_url) {
      toast({ variant: 'destructive', title: 'Artwork required', description: 'Add artwork on the Media tab before rendering.' });
      return;
    }
    if (!project.audio_url) {
      toast({ variant: 'destructive', title: 'Audio required', description: 'Add a song on the Media tab before rendering.' });
      return;
    }

    setExporting(true);
    setExportResult(null);
    setRenderProgress({ progress: 0, message: 'Preparing your video…' });
    player.pause();

    try {
      const working = buildWorking();
      if (project.id || projectId) working.id = project.id || projectId;
      const res = await videoService.exportVideo(working, {
        audioUrl: isHttps(previewAudioUrl) ? previewAudioUrl : undefined,
        onProgress: (info: { progress: number; message: string }) => setRenderProgress({ progress: info.progress, message: info.message }),
      });

      if (res.status !== 'queued' || !res.project?.id) {
        setExporting(false);
        setRenderProgress(null);
        setExportResult({ status: 'failed', message: res.message });
        toast({ variant: 'destructive', title: 'Render failed', description: res.message || 'Could not start the render.' });
        return;
      }

      const pid = adoptSaved(res.project, working);
      setProject((p) => ({ ...(p || {}), ...res.project, render_output_url: p?.render_output_url, rendering_status: 'queued', id: pid }));
      await startPolling(pid, { ...working, ...res.project });
    } catch (e: any) {
      setExporting(false);
      setRenderProgress(null);
      toast({ variant: 'destructive', title: 'Render failed', description: e.message });
    }
  };

  const shareVideo = async () => {
    const url = project?.render_output_url;
    if (!url) return;
    try {
      await Share.share({ message: `${project?.title ? `${project.title} — ` : ''}${url}`, url });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Could not share', description: e.message });
    }
  };

  const openVideo = () => {
    if (project?.render_output_url) Linking.openURL(project.render_output_url).catch(() => {});
  };

  const linkToCampaign = async () => {
    const campaignId = project?.campaign_id || id;
    if (!campaignId || !project?.render_output_url) return;
    setLinking(true);
    try {
      const res: any = await triggerCampaignAutoVideo({ campaignId, videoUrl: project.render_output_url });
      const ok = res?.ok ?? res?.data?.ok;
      toast(
        ok
          ? { title: 'Linked to campaign', description: 'The video is attached to your campaign days.' }
          : { variant: 'destructive', title: 'Could not link video', description: res?.error || res?.data?.error || 'Try again in a moment.' }
      );
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Could not link video', description: e.message });
    } finally {
      setLinking(false);
    }
  };

  const globalLyricCues = useMemo(
    () => buildLyricCues(project?.lyrics, studioDuration, project?.lyric_cues),
    [project?.lyrics, project?.lyric_cues, studioDuration]
  );

  if (!project) {
    return (
      <Screen>
        {chooseType ? null : (
          <View className="items-center gap-4">
            <Skeleton className="aspect-[9/16] w-3/4" />
            <ActivityIndicator />
          </View>
        )}
        <VideoTypeModal
          open={chooseType}
          onOpenChange={() => {}}
          onConfirm={(choice) => {
            setChooseType(false);
            router.setParams({ videoType: choice.videoType, seconds: choice.videoType === 'promo' ? String(choice.seconds || 15) : '' });
          }}
        />
      </Screen>
    );
  }

  const look = normalizeEditorLook(project.editor_look);
  const durationChoices = project.video_type === 'promo' ? [15, 30] : EXPORT_DURATIONS;
  const canRender = Boolean(project.artwork_url && project.audio_url);
  const renderLabel = exporting ? 'Rendering…' : styleDirty || wantRemake ? 'Re-render video' : hasLiveMp4 ? 'Re-render video' : 'Render video';
  const clock = Math.max(0, Math.min(studioDuration, status.currentTime - offset));
  const templateOptions = VIDEO_TEMPLATES.map((t: { id: string; name: string }) => ({ value: t.id, label: t.name }));

  return (
    <Screen contentClassName="gap-4">
      <View className="items-center">
        <View style={{ width: '72%', maxWidth: 300 }}>
          {showRendered ? (
            <RenderedVideoPlayer url={project.render_output_url} />
          ) : (
            <VideoPreview project={{ ...project, duration: studioDuration }} playing={status.playing} currentTime={status.currentTime} />
          )}
        </View>
        {!showRendered ? (
          <View className="mt-3 w-full flex-row items-center justify-center gap-3">
            <Button variant="outline" size="sm" className="rounded-full" onPress={togglePlay}>
              <Icon as={status.playing ? Pause : Play} size={14} />
              <Text className="text-xs font-medium">{status.playing ? 'Pause' : 'Play audio'}</Text>
            </Button>
            <Text className="text-xs text-muted-foreground">
              {formatClock(clock)} / {formatClock(studioDuration)} · 9:16
            </Text>
          </View>
        ) : null}
        {project.is_demo_preview ? <Text className="mt-2 text-xs uppercase text-muted-foreground">Demo</Text> : null}
      </View>

      {exporting && renderProgress ? (
        <View className="items-center rounded-xl border border-border/60 bg-muted/20 p-4">
          <VideoRenderProgress
            progress={renderProgress.progress}
            message={renderProgress.message}
            title="Rendering your video"
            hint="Rendering runs on our servers, so you can leave this screen and come back."
          />
        </View>
      ) : styleDirty || wantRemake ? (
        <View className="gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
          <Text className="text-xs text-muted-foreground">
            {styleDirty
              ? 'Style or lyrics changed. The poster shows your draft look; render again to create a new MP4.'
              : 'Remake mode: tweak the style or lyric timing, then render again.'}
          </Text>
          <Button size="sm" className="rounded-full" disabled={exporting || !canRender} onPress={() => requireAuth(renderVideo)}>
            <Icon as={RefreshCw} size={14} className="text-primary-foreground" />
            <Text className="text-xs font-medium text-primary-foreground">Render with current style</Text>
          </Button>
          {hasLiveMp4 && styleDirty ? (
            <Button size="sm" variant="ghost" onPress={() => setForceLastMp4(true)}>
              Watch last export
            </Button>
          ) : null}
        </View>
      ) : hasLiveMp4 ? (
        <View className="gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3">
          <View className="flex-row items-start gap-2">
            <Icon as={CheckCircle2} size={16} className="text-emerald-500" />
            <Text className="flex-1 text-xs text-muted-foreground">Real MP4 ready. Change the style or lyric timing to render a new one.</Text>
          </View>
          <View className="flex-row flex-wrap gap-2">
            <Button size="sm" className="rounded-full" onPress={shareVideo}>
              <Icon as={Share2} size={14} className="text-primary-foreground" />
              <Text className="text-xs font-medium text-primary-foreground">Share</Text>
            </Button>
            <Button size="sm" variant="outline" className="rounded-full" onPress={openVideo}>
              <Icon as={ExternalLink} size={14} />
              <Text className="text-xs font-medium">Open / download</Text>
            </Button>
            {project.campaign_id || id ? (
              <Button size="sm" variant="outline" className="rounded-full" loading={linking} onPress={() => requireAuth(linkToCampaign)}>
                <Icon as={Link2} size={14} />
                <Text className="text-xs font-medium">Link to campaign</Text>
              </Button>
            ) : null}
          </View>
        </View>
      ) : (
        <View className="rounded-xl border border-border/60 bg-muted/20 p-3">
          <Text className="text-xs text-muted-foreground">
            The poster previews your look. Tap <Text className="text-xs font-semibold">Render video</Text> to create the MP4 on our servers.
          </Text>
        </View>
      )}

      <MultiTrackTimeline
        duration={studioDuration}
        audioDuration={audioDuration}
        cues={globalLyricCues}
        effect={project.particle_effect}
        currentTime={status.currentTime}
        onSeek={seekLocal}
        audioOffset={offset}
        onAudioOffset={setAudioOffset}
        allowTrim={project.video_type !== 'lyrics'}
      />

      <Tabs value={editorTab} onValueChange={setEditorTab} items={EDITOR_TABS} />

      {editorTab === 'look' ? (
        <View className="gap-4">
          <View className="flex-row items-center justify-between gap-3 rounded-xl border border-border/60 bg-card p-3">
            <View className="flex-1">
              <Text className="text-xs text-muted-foreground">Video type</Text>
              <Text className="text-sm font-semibold">{project.video_type === 'lyrics' ? 'Full lyrics video' : `Promo teaser · ${studioDuration}s`}</Text>
            </View>
            <Button size="sm" variant="outline" className="rounded-full" onPress={() => setTypeSheetOpen(true)}>
              Change
            </Button>
          </View>
          {project.video_type === 'lyrics' ? null : (
            <CampaignPresets
              activeDuration={studioDuration}
              allowedSeconds={project.video_type === 'promo' ? [15, 30] : undefined}
              onApply={applyPreset}
            />
          )}
          {project.asset_label ? (
            <Text className="text-xs text-muted-foreground">
              Artwork read as {project.asset_label}. Keywords: {(project.asset_keywords || []).join(' · ')}
            </Text>
          ) : null}
          <Field label="Template">
            <Select value={project.template || 'LYRICS'} onValueChange={(value) => set('template', value)} options={templateOptions} title="Template" />
          </Field>
          <View className="gap-2">
            <Label className="mb-0 text-xs text-muted-foreground">Visual style</Label>
            {VISUAL_STYLES.map((style) => {
              const active = normalizeVisualStyle(project.visual_style) === style.id;
              return (
                <Button
                  key={style.id}
                  variant="outline"
                  onPress={() => set('visual_style', style.id)}
                  className={cn('h-auto items-start justify-start rounded-xl px-3 py-3', active ? 'border-primary/50 bg-primary/10' : 'border-border')}>
                  <View className="flex-1">
                    <Text className="text-sm font-semibold">{style.label}</Text>
                    <Text className="mt-0.5 text-[11px] text-muted-foreground">{style.description}</Text>
                  </View>
                </Button>
              );
            })}
          </View>
          <Field label="Title">
            <Input value={project.title || ''} onChangeText={(v) => set('title', v)} />
          </Field>
          <Field label="Artist name">
            <Input value={project.artist_name || ''} onChangeText={(v) => set('artist_name', v)} />
          </Field>
          {project.video_type === 'promo' ? (
            <Field label="Outro call to action">
              <Input value={project.outro_cta || ''} onChangeText={(v) => set('outro_cta', v)} placeholder="Listen now" maxLength={40} />
            </Field>
          ) : null}
        </View>
      ) : null}

      {editorTab === 'media' ? (
        <View className="gap-4">
          <Text className="text-sm text-muted-foreground">Replace the artwork or audio used in this video.</Text>
          <Field label="Artwork">
            <ArtworkUpload
              value={project.artwork_url}
              guard={requireAuth}
              onChange={(payload: any) => {
                const url = typeof payload === 'string' ? payload : payload?.url || '';
                setProject((current) => ({ ...(current || {}), artwork_url: url, is_demo_preview: false }));
                touchStyle();
              }}
            />
          </Field>
          <Field label="Audio">
            <AudioUpload
              value={project.audio_url}
              signedUrl={previewAudioUrl}
              guard={requireAuth}
              onChange={({ file, file_uri, signed_url, duration }: any) => {
                const url = file_uri || file?.uri || '';
                setProject((current) => ({
                  ...(current || {}),
                  audio_url: url,
                  audio_duration: Number(duration) || (url ? current?.audio_duration || 0 : 0),
                  audioStartTimeOffset: 0,
                  is_demo_preview: false,
                }));
                if (signed_url) setPreviewAudioUrl(signed_url);
                if (!url) setAudioDuration(0);
                touchStyle();
              }}
            />
          </Field>
          {project.video_type !== 'lyrics' && audioDuration > studioDuration ? (
            <Text className="text-xs text-muted-foreground">
              Choose which part of the song plays with the Audio start buttons under the preview. Selected: {formatClock(offset)} to {formatClock(offset + studioDuration)}.
            </Text>
          ) : null}
        </View>
      ) : null}

      {editorTab === 'lyrics' ? (
        <View className="gap-4">
          {project.video_type === 'promo' ? (
            <Field label="Hook / supporting line">
              <Textarea value={project.text || ''} onChangeText={(v) => set('text', v)} className="min-h-16" />
            </Field>
          ) : null}
          <LyricsTimelineEditor
            lyrics={project.lyrics}
            cues={project.lyric_cues}
            duration={studioDuration}
            audioUrl={previewAudioUrl}
            syncFocus={project.video_type === 'lyrics'}
            onRequireAuth={requireAuth}
            onChange={({ lyric_cues, lyrics }) => {
              setProject((p) => ({ ...(p || {}), lyric_cues, lyrics }));
              touchStyle();
            }}
            onSynced={async ({ lyricCues, lyrics }) => {
              if (!id && !dayId) return;
              await saveCampaignLyrics({ campaignId: id, dayId, lyricCues, lyrics });
              toast({ title: 'Lyrics saved' });
            }}
          />
        </View>
      ) : null}

      {editorTab === 'effects' ? (
        <EditorSidebar
          look={look}
          duration={studioDuration}
          durationLocked={project.video_type === 'lyrics'}
          durationChoices={durationChoices}
          particleEffect={project.particle_effect}
          onLook={setLook}
          onDuration={(seconds) => set('duration', resolveStudioDuration(project.video_type, seconds, audioDuration))}
          onEffect={(effectId) => set('particle_effect', effectId)}
        />
      ) : null}

      <View className="gap-3 border-t border-border/50 pt-4">
        <View className="flex-row flex-wrap gap-2">
          <Button className="flex-1 rounded-full" disabled={saving || exporting} loading={saving} onPress={() => requireAuth(save)}>
            <Icon as={Save} size={16} className="text-primary-foreground" />
            <Text className="text-sm font-medium text-primary-foreground">{saving ? 'Saving…' : 'Save project'}</Text>
          </Button>
          <Button variant="outline" className="flex-1 rounded-full" disabled={exporting || !canRender} onPress={() => requireAuth(renderVideo)}>
            <Icon as={hasLiveMp4 ? RefreshCw : Video} size={16} />
            <Text className="text-sm font-medium">{renderLabel}</Text>
          </Button>
        </View>

        {exportResult && !exporting ? (
          <View className="rounded-xl border border-border/60 bg-muted/30 p-3">
            <Text className="text-sm font-semibold">{exportResult.status === 'ready' ? 'Render complete' : 'Render failed'}</Text>
            {exportResult.message ? <Text className="mt-1 text-sm text-muted-foreground">{exportResult.message}</Text> : null}
          </View>
        ) : null}

        {!canRender ? (
          <Text className="text-xs text-amber-600">
            {!project.artwork_url ? 'Missing artwork. ' : ''}
            {!project.audio_url ? 'Missing audio. ' : ''}
            Add them on the Media tab to enable rendering.
          </Text>
        ) : null}
      </View>

      <VideoTypeModal open={typeSheetOpen} onOpenChange={setTypeSheetOpen} onConfirm={changeVideoType} />
    </Screen>
  );
}
