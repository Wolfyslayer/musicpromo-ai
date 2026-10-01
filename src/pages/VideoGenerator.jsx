import { db } from "@/api/base44Client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Save, Download, Play, Pause, CheckCircle2, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

import { loadCampaign } from "@/services/data";
import { videoService, resolvePlayableAudioUrl } from "@/services/videoService";
import { getSettings } from "@/services/settings";
import { DEMO_AUDIO_URL, createDemoProject } from "@/services/demoMedia";
import { useAuth } from "@/lib/AuthContext";
import RemotionPlayerPreview from "@/remotion/PlayerPreview";
import VideoRenderProgress from "@/components/VideoRenderProgress";
import LyricsTimelineEditor from "@/components/LyricsTimelineEditor";
import EditorSidebar from "@/components/video/EditorSidebar";
import PreviewDragLayer from "@/components/video/PreviewDragLayer";
import MultiTrackTimeline from "@/components/video/MultiTrackTimeline";
import CampaignPresets from "@/components/video/CampaignPresets";
import ArtworkUpload from "@/components/ArtworkUpload";
import AudioUpload from "@/components/AudioUpload";
import { useWorkspaceRefresh } from "@/lib/AuthContext";
import { useIsolatedPreviewAudio } from "@/hooks/useIsolatedPreviewAudio";
import {
  VISUAL_STYLES,
  PROMO_FPS,
  buildLyricCues,
  cuesInAudioWindow,
  normalizeEditorLook,
  clampAudioOffset,
  normalizeExportDuration,
  normalizeParticleEffect,
  normalizeVisualStyle,
  scaleLyricCues,
} from "@/remotion/styles";

const EDITOR_TABS = [
  { id: "look", label: "Look" },
  { id: "media", label: "Media" },
  { id: "lyrics", label: "Lyrics" },
  { id: "effects", label: "Effects" },
];

function styleFingerprint(p) {
  if (!p) return "";
  return [
    p.visual_style,
    p.particle_effect,
    p.duration,
    JSON.stringify(normalizeEditorLook(p.editor_look)),
    p.audioStartTimeOffset || 0,
    p.title,
    p.artist_name,
    p.text,
    JSON.stringify(p.lyric_cues || []).slice(0, 400),
    (p.lyrics || "").slice(0, 200),
  ].join("|");
}

export default function VideoGenerator() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const projectId = params.get("project");
  const dayId = params.get("day");
  const wantRemake = params.get("remake") === "1";
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, requireAuth } = useAuth();
  const [refreshTick, setRefreshTick] = useState(0);
  useWorkspaceRefresh(() => setRefreshTick((n) => n + 1));

  const [song, setSong] = useState(null);
  const [project, setProject] = useState(null);
  const [previewAudioUrl, setPreviewAudioUrl] = useState("");
  const [exportedFp, setExportedFp] = useState("");
  const [playing, setPlaying] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportResult, setExportResult] = useState(null);
  const [renderProgress, setRenderProgress] = useState(null);
  const [previewLive, setPreviewLive] = useState(true);
  const [forceLastMp4, setForceLastMp4] = useState(false);
  const [controlsOpen, setControlsOpen] = useState(true);
  const [editorTab, setEditorTab] = useState("look");

  useEffect(() => {
    let cancelled = false;
    const applyDemo = () => {
      const demo = createDemoProject(getSettings().defaultVideoDuration);
      setSong({ artwork_url: demo.artwork_url, audio_url: demo.audio_url, title: demo.title });
      setProject(demo);
      setPreviewAudioUrl(DEMO_AUDIO_URL);
      setExportedFp("");
      setPreviewLive(false);
    };
    if (!id) {
      applyDemo();
      return undefined;
    }
    (async () => {
      const s = getSettings();
      try {
      const data = await loadCampaign(id);
      setSong(data.song);
      let base = {
        template: "LYRICS",
        title: data.song?.title || "",
        artist_name: data.artist?.name || "",
        text: "",
        artwork_url: data.song?.artwork_url || "",
        audio_url: data.song?.audio_url || "",
        lyrics: data.song?.lyrics || "",
        visual_style: "pop",
        particle_effect: "none",
        editor_look: normalizeEditorLook(null),
        lyric_cues: buildLyricCues(data.song?.lyrics || "", s.defaultVideoDuration, []),
        duration: normalizeExportDuration(s.defaultVideoDuration),
        song_id: data.song?.id,
        campaign_id: id,
      };
      if (projectId) {
        const p = await db.entities.VideoProject.get(projectId);
        base = {
          ...base,
          ...p,
          visual_style: normalizeVisualStyle(p.visual_style || base.visual_style),
          particle_effect: normalizeParticleEffect(p.particle_effect || base.particle_effect),
          editor_look: normalizeEditorLook(p.editor_look || base.editor_look),
          duration: normalizeExportDuration(p.duration || base.duration),
          lyric_cues: buildLyricCues(p.lyrics || base.lyrics, normalizeExportDuration(p.duration || base.duration), p.lyric_cues),
        };
      } else if (dayId) {
        const day = await db.entities.CampaignDay.get(dayId);
        base = {
          ...base,
          text: day?.caption || day?.cta || "",
          title: data.song?.title || "",
        };
      }
      if (cancelled) return;
      setProject(base);
      const fp = styleFingerprint(base);
      if (base.render_output_url && /^https:\/\//i.test(base.render_output_url)) {
        setExportedFp(fp);
        setPreviewLive(!wantRemake);
      } else {
        setExportedFp("");
        setPreviewLive(false);
      }
      } catch (err) {
        console.error(err);
        if (cancelled) return;
        applyDemo();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, projectId, dayId, wantRemake, refreshTick]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!project?.audio_url) {
        setPreviewAudioUrl("");
        return;
      }
      const url = await resolvePlayableAudioUrl(project.audio_url);
      if (!cancelled) setPreviewAudioUrl(url);
    })();
    return () => {
      cancelled = true;
    };
  }, [project?.audio_url]);

  const set = (k, v) => setProject((p) => ({ ...p, [k]: v }));

  const touchStyle = () => {
    setPreviewLive(false);
    setForceLastMp4(false);
  };

  const setLook = (patch) => {
    setProject((p) => ({
      ...p,
      editor_look: normalizeEditorLook({ ...normalizeEditorLook(p?.editor_look), ...patch }),
    }));
    touchStyle();
  };

  const playerRef = useRef(null);
  const videoRef = useRef(null);
  const playheadRef = useRef(null);
  const scrubbingRef = useRef(false);
  const durationRef = useRef(15);
  const timelineRef = useRef(0);
  const noteTimelineRef = useRef(() => {});
  const seekAudioRef = useRef(() => {});
  const dragDepth = useRef(0);
  const setHoldRef = useRef(() => {});
  const audioDurationRef = useRef(0);
  const [isDragging, setIsDragging] = useState(false);
  const [audioDuration, setAudioDuration] = useState(0);
  durationRef.current = normalizeExportDuration(project?.duration);

  const setDragActive = (active) => {
    dragDepth.current = Math.max(0, dragDepth.current + (active ? 1 : -1));
    const next = dragDepth.current > 0;
    setHoldRef.current(next);
    setIsDragging(next);
  };

  const onFrame = useCallback((frame) => {
    const time = frame / Math.max(1, PROMO_FPS);
    const previous = timelineRef.current;
    timelineRef.current = time;
    noteTimelineRef.current(time);
    if (previous - time > 0.4) seekAudioRef.current(0);
    if (!playheadRef.current || scrubbingRef.current) return;
    const frames = Math.max(1, durationRef.current * PROMO_FPS);
    playheadRef.current.style.left = `${Math.min(100, (frame / frames) * 100)}%`;
  }, []);

  const seekToTime = (time) => {
    const seconds = Math.max(0, Math.min(durationRef.current, Number(time) || 0));
    timelineRef.current = seconds;
    playerRef.current?.seekTo?.(Math.round(seconds * PROMO_FPS));
    seekAudioRef.current(seconds);
    if (videoRef.current && Number.isFinite(videoRef.current.duration)) {
      videoRef.current.currentTime = Math.min(videoRef.current.duration, seconds);
    }
  };

  const setAudioOffset = (seconds) => {
    setProject((current) => ({
      ...current,
      audioStartTimeOffset: clampAudioOffset(
        seconds,
        audioDurationRef.current,
        normalizeExportDuration(current?.duration)
      ),
    }));
    touchStyle();
  };

  const moveLyricCue = (index, start) => {
    setProject((current) => {
      const duration = normalizeExportDuration(current.duration);
      const cues = buildLyricCues(current.lyrics, duration, current.lyric_cues);
      const cue = cues[index];
      if (!cue) return current;
      const cueStart = Number(cue.timeSeconds ?? cue.start) || 0;
      const length = Math.max(0.2, (Number(cue.end) || cueStart) - cueStart);
      const offset = Math.max(0, Number(current.audioStartTimeOffset) || 0);
      const windowEnd = offset + duration;
      const nextStart = Math.round(Math.max(offset, Math.min(windowEnd - length, start)) * 1000) / 1000;
      const nextEnd = Math.round(Math.min(windowEnd, nextStart + length) * 1000) / 1000;
      return {
        ...current,
        lyric_cues: cues.map((item, itemIndex) =>
          itemIndex === index ? { ...item, start: nextStart, end: nextEnd, timeSeconds: nextStart } : item
        ),
      };
    });
    touchStyle();
  };

  const applyPreset = (preset) => {
    setProject((current) => {
      const from = normalizeExportDuration(current.duration);
      const cues = buildLyricCues(current.lyrics, from, current.lyric_cues);
      return {
        ...current,
        duration: preset.seconds,
        editor_look: normalizeEditorLook({ ...normalizeEditorLook(current.editor_look), ...preset.look }),
        lyric_cues: scaleLyricCues(cues, from, preset.seconds),
      };
    });
    touchStyle();
  };

  const hasLiveMp4 =
    project?.render_output_url && /^https:\/\//i.test(project.render_output_url);
  const currentFp = useMemo(() => styleFingerprint(project), [project]);
  const styleDirty = Boolean(hasLiveMp4 && exportedFp && currentFp !== exportedFp);
  const showLivePreview =
    hasLiveMp4 && (forceLastMp4 || (previewLive && !styleDirty && !wantRemake));

  const studioAudioUrl = previewAudioUrl || (project?.is_demo_preview ? DEMO_AUDIO_URL : "");
  const audioClock = useIsolatedPreviewAudio({
    url: showLivePreview ? "" : studioAudioUrl,
    offsetSec: project?.audioStartTimeOffset || 0,
    windowSec: normalizeExportDuration(project?.duration),
    playing: Boolean(playing && project && !showLivePreview),
  });
  noteTimelineRef.current = audioClock.noteTimeline;
  seekAudioRef.current = audioClock.seek;
  setHoldRef.current = audioClock.setHold;

  useEffect(() => {
    if (!project) return;
    const next = clampAudioOffset(project.audioStartTimeOffset, audioDuration, normalizeExportDuration(project.duration));
    if (next === (Number(project.audioStartTimeOffset) || 0)) return;
    setProject((current) => (current ? { ...current, audioStartTimeOffset: next } : current));
  }, [audioDuration, project?.duration, project?.audioStartTimeOffset, project]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !showLivePreview) return undefined;
    const tick = () => {
      if (!playheadRef.current || scrubbingRef.current) return;
      const dur = video.duration || durationRef.current;
      if (!dur) return;
      playheadRef.current.style.left = `${Math.min(100, (video.currentTime / dur) * 100)}%`;
    };
    video.addEventListener("timeupdate", tick);
    return () => video.removeEventListener("timeupdate", tick);
  }, [showLivePreview, project?.render_output_url]);

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        ...project,
        visual_style: normalizeVisualStyle(project.visual_style),
        particle_effect: normalizeParticleEffect(project.particle_effect),
        editor_look: normalizeEditorLook(project.editor_look),
        duration: normalizeExportDuration(project.duration),
        lyric_cues: buildLyricCues(project.lyrics, normalizeExportDuration(project.duration), project.lyric_cues),
        audioStartTimeOffset: clampAudioOffset(project.audioStartTimeOffset, audioDurationRef.current, normalizeExportDuration(project.duration)),
        user_id: project.user_id || user?.id || "",
        is_demo: false,
      };
      if (project.id || projectId) {
        const pid = project.id || projectId;
        await db.entities.VideoProject.update(pid, payload);
        setProject((p) => ({ ...p, ...payload, id: pid }));
      } else {
        const created = await db.entities.VideoProject.create(payload);
        setProject((p) => ({ ...p, ...payload, id: created.id }));
        navigate(`/campaigns/${id}/video?project=${created.id}`, { replace: true });
      }
      toast({ title: "Video project saved" });
    } catch (e) {
      toast({ variant: "destructive", title: "Save failed", description: e.message });
    } finally {
      setSaving(false);
    }
  };

  const exportVideo = async () => {
    if (!project?.artwork_url) {
      toast({
        variant: "destructive",
        title: "Artwork required",
        description: "This campaign song needs artwork before a video can be rendered.",
      });
      return;
    }
    if (!project?.audio_url) {
      toast({
        variant: "destructive",
        title: "Audio required",
        description: "This campaign song needs an audio file before a video can be rendered.",
      });
      return;
    }

    setExporting(true);
    setExportResult(null);
    setRenderProgress({ progress: 0, message: "Starting Remotion render…" });
    setPlaying(false);

    try {
      let working = {
        ...project,
        visual_style: normalizeVisualStyle(project.visual_style),
        particle_effect: normalizeParticleEffect(project.particle_effect),
        editor_look: normalizeEditorLook(project.editor_look),
        duration: normalizeExportDuration(project.duration),
        lyric_cues: buildLyricCues(project.lyrics, normalizeExportDuration(project.duration), project.lyric_cues),
        user_id: project.user_id || user?.id || "",
      };
      if (!working.id && !projectId) {
        const created = await db.entities.VideoProject.create({
          ...working,
          rendering_status: "rendering",
          is_demo: false,
        });
        working = { ...working, id: created.id };
        setProject(working);
        navigate(`/campaigns/${id}/video?project=${created.id}`, { replace: true });
      } else if (working.id || projectId) {
        working = { ...working, id: working.id || projectId };
        await db.entities.VideoProject.update(working.id, {
          ...working,
          rendering_status: "rendering",
        }).catch(() => {});
      }

      const res = await videoService.exportVideo(working, {
        audioUrl: previewAudioUrl || undefined,
        onProgress: (info) => {
          setRenderProgress({
            progress: info.progress,
            message: info.message,
          });
        },
      });

      setExportResult(res);
      if (res?.status === "ready" && res?.downloadUrl) {
        const next = {
          ...working,
          ...(res.project || {}),
          render_output_url: res.downloadUrl,
          rendering_status: "complete",
        };
        setProject(next);
        setExportedFp(styleFingerprint(next));
        setPreviewLive(true);
        setForceLastMp4(false);
        setPlaying(true);
        if (wantRemake) {
          navigate(`/campaigns/${id}/video?project=${next.id}`, { replace: true });
        }
        toast({
          title: "Video exported",
          description: "Playing the rendered MP4 in the preview.",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Export failed",
          description: res?.message || "Could not render the video on this device.",
        });
      }
    } catch (e) {
      toast({ variant: "destructive", title: "Export failed", description: e.message });
    } finally {
      setExporting(false);
      setRenderProgress(null);
    }
  };

  const globalLyricCues = useMemo(
    () => buildLyricCues(project?.lyrics, normalizeExportDuration(project?.duration), project?.lyric_cues),
    [project?.lyrics, project?.duration, project?.lyric_cues]
  );
  const visibleLyricCues = useMemo(
    () => cuesInAudioWindow(
      globalLyricCues,
      project?.audioStartTimeOffset || 0,
      normalizeExportDuration(project?.duration)
    ),
    [globalLyricCues, project?.audioStartTimeOffset, project?.duration]
  );

  if (!project) return <div className="h-full animate-shimmer" />;

  const tabClass = (id) => (editorTab === id ? "space-y-5" : "hidden space-y-5 md:block md:border-t md:border-border/50 md:pt-6");

  return (
    <div
      className={cn(
        "grid h-full min-h-0 grid-cols-1 bg-background",
        controlsOpen ? "grid-rows-[minmax(0,1fr)_9.5rem_minmax(8rem,40%)]" : "grid-rows-[minmax(0,1fr)_9.5rem_3rem]",
        "transition-[grid-template-rows] duration-300 ease-out md:grid-cols-[clamp(220px,32vw,420px)_minmax(0,1fr)] md:grid-rows-[minmax(0,1fr)_9.5rem]"
      )}
    >
      <section className="relative flex min-h-0 items-center justify-center bg-muted/40 md:col-start-1 md:row-start-1">
        <div
          className="flex h-full w-full items-center justify-center px-3 pb-16 pt-12 md:px-8 md:pb-20 md:pt-16"
          style={{ containerType: "size" }}
        >
          {showLivePreview ? (
            <div
              className="relative overflow-hidden rounded-[1.6rem] border border-white/10 bg-black shadow-2xl shadow-black/40"
              style={{ width: "min(100cqw, calc(100cqh * 9 / 16))", height: "min(100cqh, calc(100cqw * 16 / 9))" }}
            >
              <video
                ref={videoRef}
                src={project.render_output_url}
                className="h-full w-full object-cover"
                playsInline
                loop
                autoPlay={playing}
                muted={false}
                controls={false}
              />
              <div className="pointer-events-none absolute left-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-600 uppercase tracking-wide text-white/90">
                MP4
              </div>
              <PreviewDragLayer look={project.editor_look} onLook={setLook} onDragging={setDragActive} />
            </div>
          ) : (
            <div
              className="relative overflow-hidden rounded-[1.6rem]"
              style={{ width: "min(100cqw, calc(100cqh * 9 / 16))", height: "min(100cqh, calc(100cqw * 16 / 9))" }}
            >
              <RemotionPlayerPreview
                project={{
                  ...project,
                  preview_audio_url: previewAudioUrl,
                  suspendEffects: isDragging,
                  windowLyricCues: visibleLyricCues,
                }}
                playing={playing}
                playerRef={playerRef}
                onFrame={onFrame}
                className="aspect-auto h-full w-full max-w-none rounded-[1.6rem]"
              />
              <PreviewDragLayer look={project.editor_look} onLook={setLook} onDragging={setDragActive} />
            </div>
          )}
        </div>
        <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-2 p-3">
          <button
            onClick={() => navigate(id ? `/campaigns/${id}` : "/")}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-background/80 px-3 text-sm text-foreground backdrop-blur"
          >
            <ArrowLeft className="h-4 w-4" /> {id ? "Campaign" : "Home"}
          </button>
          {project.is_demo_preview ? (
            <span className="rounded-full bg-background/80 px-3 py-1 text-[11px] font-600 uppercase tracking-wide text-foreground backdrop-blur">
              Demo
            </span>
          ) : null}
        </div>
        <div className="absolute inset-x-0 bottom-3 flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPlaying((value) => !value)}
            className="min-h-11 rounded-full bg-background/85 backdrop-blur"
          >
            {playing ? <Pause className="mr-1.5 h-4 w-4" /> : <Play className="mr-1.5 h-4 w-4" />}
            {playing ? "Pause" : "Play"}
          </Button>
          <span className="rounded-full bg-background/80 px-3 py-2 text-xs text-muted-foreground backdrop-blur">
            {project.duration}s · 9:16
          </span>
        </div>
      </section>

      <MultiTrackTimeline
        duration={normalizeExportDuration(project.duration)}
        audioUrl={studioAudioUrl}
        cues={globalLyricCues}
        effect={project.particle_effect}
        playheadRef={playheadRef}
        onSeek={seekToTime}
        onCueMove={moveLyricCue}
        audioOffset={project.audioStartTimeOffset || 0}
        onAudioOffset={setAudioOffset}
        onDragging={setDragActive}
        onAudioDuration={(seconds) => {
          audioDurationRef.current = seconds || 0;
          setAudioDuration(seconds || 0);
        }}
        onScrubbing={(active) => {
          scrubbingRef.current = active;
        }}
      />

      <section
        className={cn(
          "flex min-h-0 flex-col overflow-hidden border-t border-border/60 bg-card transition-[height] duration-300 ease-out md:col-start-2 md:row-start-1 md:border-l md:border-t-0"
        )}
      >
        <div className="flex h-12 shrink-0 items-center gap-1 border-b border-border/50 px-1 md:hidden">
          <button
            type="button"
            onClick={() => setControlsOpen((open) => !open)}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-foreground"
            aria-expanded={controlsOpen}
            aria-label={controlsOpen ? "Hide editor" : "Show editor"}
          >
            {controlsOpen ? <ChevronDown className="h-5 w-5" /> : <ChevronUp className="h-5 w-5" />}
          </button>
          {controlsOpen
            ? EDITOR_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setEditorTab(tab.id)}
                  className={cn(
                    "min-h-11 flex-1 rounded-xl px-1 text-xs font-600",
                    editorTab === tab.id ? "bg-primary/15 text-primary" : "text-muted-foreground"
                  )}
                >
                  {tab.label}
                </button>
              ))
            : (
              <span className="text-xs font-600 text-muted-foreground">Editor hidden</span>
            )}
        </div>

        <div className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 md:px-6", !controlsOpen && "hidden md:block")}>
        <div className="hidden pb-2 md:block">
          <h1 className="font-heading text-xl font-700 tracking-tight">Video Studio</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Drag lyrics and the particle source on the frame. Presets, effects, and playback stay available before sign-in.
          </p>
        </div>
        <CampaignPresets activeDuration={normalizeExportDuration(project.duration)} onApply={applyPreset} />

          {exporting && renderProgress ? (
            <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
              <VideoRenderProgress
                progress={renderProgress.progress}
                message={renderProgress.message}
                title="Rendering with Remotion"
                hint="WebCodecs encode in your browser — no server render cost."
              />
            </div>
          ) : styleDirty || wantRemake ? (
            <div className="space-y-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-muted-foreground">
              <p>
                {styleDirty
                  ? "Style or lyrics changed — live Remotion preview is active. Remake to bake a new MP4."
                  : "Remake mode — tweak style or lyric timing, then remake."}
              </p>
              <Button
                size="sm"
                className="w-full rounded-full"
                disabled={exporting}
                onClick={() => requireAuth(exportVideo)}
              >
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                Remake with current style
              </Button>
              {hasLiveMp4 && styleDirty ? (
                <button
                  type="button"
                  className="w-full text-center text-[11px] underline underline-offset-2 hover:text-foreground"
                  onClick={() => setForceLastMp4(true)}
                >
                  Keep watching last export
                </button>
              ) : null}
            </div>
          ) : hasLiveMp4 ? (
            <div className="flex items-start gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3 text-xs text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
              <span>
                Real MP4 ready. Change style or lyric timing to remake.{" "}
                <a
                  href={project.render_output_url}
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-2 hover:text-foreground"
                >
                  Open / download
                </a>
              </span>
            </div>
          ) : (
            <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground">
              Live Remotion preview. Click{" "}
              <span className="font-600 text-foreground">Export Video</span> to encode an MP4 on
              this device.
            </div>
          )}
        <div className={tabClass("look")}>
          <div>
            <Label className="text-xs text-muted-foreground">Visual style</Label>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {VISUAL_STYLES.map((style) => (
                <button
                  key={style.id}
                  type="button"
                  onClick={() => {
                    set("visual_style", style.id);
                    touchStyle();
                  }}
                  className={`rounded-xl border p-3 text-left transition ${
                    normalizeVisualStyle(project.visual_style) === style.id
                      ? "border-primary/50 bg-primary/10"
                      : "border-border hover:border-primary/30"
                  }`}
                >
                  <p className="text-sm font-600">{style.label}</p>
                  <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">
                    {style.description}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Title">
              <Input
                value={project.title}
                onChange={(e) => {
                  set("title", e.target.value);
                  touchStyle();
                }}
                className="rounded-xl"
              />
            </Field>
            <Field label="Artist Name">
              <Input
                value={project.artist_name}
                onChange={(e) => {
                  set("artist_name", e.target.value);
                  touchStyle();
                }}
                className="rounded-xl"
              />
            </Field>
          </div>

        </div>

        <div className={tabClass("media")}>
          <p className="text-sm text-muted-foreground">
            {project.is_demo_preview
              ? "This demo track and cover are ready to preview. Sign in when you want to upload your own files."
              : "Replace the artwork or audio used in this preview."}
          </p>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Artwork</Label>
              <ArtworkUpload
                value={project.artwork_url}
                guard={requireAuth}
                onChange={(payload) => {
                  const url = typeof payload === "string" ? payload : payload?.url || "";
                  setProject((current) => ({ ...current, artwork_url: url, is_demo_preview: false }));
                  setSong((songState) => ({ ...(songState || {}), artwork_url: url }));
                  touchStyle();
                }}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Audio</Label>
              <AudioUpload
                value={project.audio_url}
                signedUrl={previewAudioUrl}
                guard={requireAuth}
                onChange={({ file_uri, signed_url }) => {
                  setProject((current) => ({ ...current, audio_url: file_uri || "", is_demo_preview: false }));
                  setSong((songState) => ({ ...(songState || {}), audio_url: file_uri || "" }));
                  if (signed_url) setPreviewAudioUrl(signed_url);
                  touchStyle();
                }}
              />
            </div>
          </div>

        </div>

        <div className={tabClass("lyrics")}>
          <Field label="Hook / supporting line">
            <Textarea
              value={project.text}
              onChange={(e) => {
                set("text", e.target.value);
                touchStyle();
              }}
              rows={2}
              className="rounded-xl"
            />
          </Field>

          <LyricsTimelineEditor
            lyrics={project.lyrics}
            cues={project.lyric_cues}
            duration={project.duration}
            audioUrl={previewAudioUrl}
            onChange={({ lyric_cues, lyrics }) => {
              setProject((p) => ({ ...p, lyric_cues, lyrics }));
              touchStyle();
            }}
          />
        </div>

        <div className={tabClass("effects")}>
          <EditorSidebar
            look={normalizeEditorLook(project.editor_look)}
            duration={normalizeExportDuration(project.duration)}
            particleEffect={project.particle_effect}
            onLook={setLook}
            onDuration={(seconds) => {
              set("duration", normalizeExportDuration(seconds));
              touchStyle();
            }}
            onEffect={(effectId) => {
              set("particle_effect", effectId);
              touchStyle();
            }}
            className="border-0 bg-transparent p-0 shadow-none"
          />
        </div>

          <div className="mt-6 flex flex-wrap gap-2 border-t border-border/50 pt-4">
            <Button onClick={() => requireAuth(save)} disabled={saving || exporting} className="rounded-full">
              <Save className="mr-1.5 h-4 w-4" />
              {saving ? "Saving…" : "Save Project"}
            </Button>
            <Button
              onClick={() => requireAuth(exportVideo)}
              disabled={exporting}
              variant="outline"
              className="rounded-full"
            >
              {styleDirty || wantRemake || hasLiveMp4 ? (
                <RefreshCw className="mr-1.5 h-4 w-4" />
              ) : (
                <Download className="mr-1.5 h-4 w-4" />
              )}
              {exporting
                ? "Exporting…"
                : styleDirty || wantRemake
                  ? "Remake Video"
                  : hasLiveMp4
                    ? "Re-export Video"
                    : "Export Video"}
            </Button>
          </div>

          {exportResult && !exporting && (
            <div className="rounded-xl border border-border/60 bg-muted/30 p-3 text-sm text-muted-foreground">
              <p className="font-600 text-foreground">
                {exportResult.status === "ready" ? "Export complete" : "Export failed"}
              </p>
              <p className="mt-1">{exportResult.message}</p>
              {exportResult.downloadUrl && (
                <a
                  href={exportResult.downloadUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-block text-xs underline underline-offset-2 hover:text-foreground"
                >
                  Download MP4
                </a>
              )}
            </div>
          )}

          {(!song?.artwork_url || !song?.audio_url) && (
            <p className="text-xs text-amber-600">
              {!song?.artwork_url ? "Missing song artwork. " : null}
              {!song?.audio_url ? "Missing song audio. " : null}
              Add them on the campaign song to enable export.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-500 text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
