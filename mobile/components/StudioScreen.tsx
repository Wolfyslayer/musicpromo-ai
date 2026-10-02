import { useEffect, useMemo, useState } from "react";
import { Linking, View } from "react-native";
import { useAuth } from "@/components/AuthProvider";
import { useEngine } from "@/components/DeviceEngine";
import { EnginePreview } from "@/components/EnginePreview";
import { useToast } from "@/components/Toast";
import { Button, Card, Chip, Empty, Field, H1, Muted, P, Progress, Screen } from "@/components/ui";
import { db } from "@/lib/db";
import { errorMessage } from "@/lib/format";
import type { LyricCue } from "@/lib/lyrics";
import { selectCampaignVideos } from "@/lib/social";
import { clampAudioOffset, FONT_CHOICES, normalizeEditorLook, PARTICLE_EFFECTS, resolveStudioDuration, type EditorLook } from "@/lib/studioLook";
import type { Row } from "@/lib/types";
import { saveRenderedPromo } from "@/lib/videoSave";

const STYLES = [
  { label: "Pop", value: "pop" },
  { label: "Hip-hop", value: "hiphop" },
  { label: "Rock", value: "rock" },
];

export function StudioScreen({
  campaignId,
  dayId = "",
  projectId = "",
  initialText = "",
}: {
  campaignId?: string;
  dayId?: string;
  projectId?: string;
  initialText?: string;
}) {
  const engine = useEngine();
  const { toast } = useToast();
  const { user, requireAuth } = useAuth();
  const [songId, setSongId] = useState("");
  const [savedProjectId, setSavedProjectId] = useState(projectId);
  const [title, setTitle] = useState("");
  const [artistName, setArtistName] = useState("");
  const [text, setText] = useState(initialText);
  const [lyrics, setLyrics] = useState("");
  const [artworkUrl, setArtworkUrl] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [visualStyle, setVisualStyle] = useState("pop");
  const [particleEffect, setParticleEffect] = useState("none");
  const [videoType, setVideoType] = useState("");
  const [duration, setDuration] = useState(15);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioOffset, setAudioOffset] = useState("0");
  const [outroCta, setOutroCta] = useState("Listen now");
  const [look, setLook] = useState<EditorLook>(normalizeEditorLook(null));
  const [cues, setCues] = useState<LyricCue[]>([]);
  const [videos, setVideos] = useState<Row[]>([]);
  const [outputUrl, setOutputUrl] = useState("");
  const [profileLabel, setProfileLabel] = useState("");
  const [playing, setPlaying] = useState(true);
  const [busy, setBusy] = useState("");
  const [panel, setPanel] = useState("look");

  useEffect(() => {
    if (!campaignId && !projectId) return;
    let active = true;
    (async () => {
      try {
        const project = projectId ? await db.entities.VideoProject.get(projectId).catch(() => null) : null;
        const campaign = campaignId ? await db.entities.Campaign.get(campaignId).catch(() => null) : null;
        const song = campaign?.song_id ? await db.entities.Song.get(String(campaign.song_id)).catch(() => null) : null;
        const artist = campaign?.artist_id ? await db.entities.Artist.get(String(campaign.artist_id)).catch(() => null) : null;
        const day = dayId ? await db.entities.CampaignDay.get(dayId).catch(() => null) : null;
        const existing = campaignId ? await selectCampaignVideos(campaignId).catch(() => []) : [];
        if (!active) return;
        setSongId(String(song?.id || project?.song_id || ""));
        setTitle(String(project?.title || song?.title || campaign?.name || ""));
        setArtistName(String(project?.artist_name || artist?.name || ""));
        setText(String(project?.text || day?.hook || initialText || song?.description || ""));
        setLyrics(String(project?.lyrics || song?.lyrics || ""));
        setArtworkUrl(String(project?.artwork_url || song?.artwork_url || ""));
        setAudioUrl(String(project?.audio_url || song?.audio_url || ""));
        setVisualStyle(String(project?.visual_style || "pop"));
        setParticleEffect(String(project?.particle_effect || "none"));
        setOutroCta(String(project?.outro_cta || day?.cta || "Listen now"));
        setLook(normalizeEditorLook(project?.editor_look));
        setCues(Array.isArray(project?.lyric_cues) ? project.lyric_cues : []);
        setAudioOffset(String(project?.audioStartTimeOffset || 0));
        if (project?.video_type === "lyrics" || project?.video_type === "promo") setVideoType(project.video_type);
        if (project?.duration) setDuration(Number(project.duration) || 15);
        if (project?.render_output_url) setOutputUrl(String(project.render_output_url));
        setVideos(existing);
      } catch (err) {
        if (active) toast({ title: "Could not load studio", description: errorMessage(err), variant: "destructive" });
      }
    })();
    return () => {
      active = false;
    };
  }, [campaignId, dayId, initialText, projectId, toast]);

  const resolvedDuration = resolveStudioDuration(videoType || "promo", duration, audioDuration);
  const offset = clampAudioOffset(Number(audioOffset) || 0, audioDuration, resolvedDuration);
  const preview = useMemo(
    () => ({
      artworkUrl,
      audioUrl,
      title,
      artistName,
      text: videoType === "lyrics" ? "" : text,
      lyrics,
      lyricCues: cues,
      visualStyle,
      particleEffect,
      look,
      duration: resolvedDuration,
      audioDuration,
      audioStartTimeOffset: offset,
      videoType: videoType || "promo",
      outroCta: videoType === "promo" ? outroCta : "",
    }),
    [artworkUrl, audioDuration, audioUrl, artistName, cues, look, offset, outroCta, particleEffect, resolvedDuration, text, title, videoType, visualStyle, lyrics]
  );

  const patchLook = (patch: Partial<EditorLook>) => setLook((current) => normalizeEditorLook({ ...current, ...patch }));

  const analyze = async () => {
    if (!requireAuth()) return;
    if (!artworkUrl && !audioUrl) {
      toast({ title: "Add artwork or audio first", variant: "destructive" });
      return;
    }
    setBusy("analyze");
    try {
      const profile = await engine.analyze({ artworkUrl, audioUrl, title });
      setVisualStyle(profile.visualStyle);
      setParticleEffect(profile.particleEffect);
      setProfileLabel(`${profile.label} · ${profile.energy} · ${profile.palette}`);
      if (!text && profile.hooks[0]) setText(profile.hooks[0]);
      if (profile.duration) setAudioDuration(Number(profile.duration) || 0);
      toast({ title: "Song analyzed" });
    } catch (err) {
      toast({ title: "Analysis failed", description: errorMessage(err), variant: "destructive" });
    } finally {
      setBusy("");
    }
  };

  const sync = async () => {
    if (!requireAuth()) return;
    if (!audioUrl) {
      toast({ title: "Add an audio URL first", variant: "destructive" });
      return;
    }
    setBusy("sync");
    try {
      const next = await engine.syncLyrics({ audioUrl, duration: resolvedDuration });
      setCues(next);
      if (!lyrics.trim() && next.length) setLyrics(next.map((cue) => cue.text).join("\n"));
      toast({ title: next.length ? "Lyrics synced" : "No lyrics detected" });
    } catch (err) {
      toast({ title: "Lyrics sync failed", description: errorMessage(err), variant: "destructive" });
    } finally {
      setBusy("");
    }
  };

  const projectFields = {
    campaign_id: campaignId || null,
    song_id: songId || null,
    template: videoType === "lyrics" ? "LYRICS" : "HOOK",
    title: title || "Promo",
    artist_name: artistName,
    text,
    artwork_url: artworkUrl,
    audio_url: audioUrl,
    lyrics: String(lyrics || "").slice(0, 2000),
    visual_style: visualStyle,
    particle_effect: particleEffect,
    editor_look: look,
    video_type: videoType || "promo",
    outro_cta: outroCta,
    audioStartTimeOffset: offset,
    lyric_cues: cues,
    duration: resolvedDuration,
    aspect_ratio: "9:16",
    is_demo: false,
    user_id: user?.id || "",
  };

  const saveDraft = async () => {
    if (!requireAuth()) return;
    setBusy("save");
    try {
      const saved = savedProjectId
        ? await db.entities.VideoProject.update(savedProjectId, projectFields)
        : await db.entities.VideoProject.create({ ...projectFields, rendering_status: "draft", status: "draft" });
      setSavedProjectId(String(saved.id || savedProjectId));
      toast({ title: "Project saved" });
    } catch (err) {
      toast({ title: "Could not save", description: errorMessage(err), variant: "destructive" });
    } finally {
      setBusy("");
    }
  };

  const render = async () => {
    if (!requireAuth()) return;
    if (!artworkUrl || !audioUrl) {
      toast({ title: "Artwork and audio are required", variant: "destructive" });
      return;
    }
    setBusy("render");
    try {
      const rendered = await engine.renderPromo({
        ...preview,
        lyrics,
      });
      const saved = await saveRenderedPromo({
        base64: rendered.base64,
        campaignId,
        songId,
        title: title || "Promo",
        artistName,
        text,
        artworkUrl,
        audioUrl,
        lyrics,
        visualStyle: rendered.visualStyle || visualStyle,
        particleEffect: rendered.particleEffect || particleEffect,
        lyricCues: rendered.lyricCues || cues,
        look,
        videoType: videoType || "promo",
        outroCta,
        audioStartTimeOffset: offset,
        duration: rendered.duration,
        width: rendered.width,
        height: rendered.height,
        userId: user?.id,
      });
      setOutputUrl(saved.videoUrl);
      setSavedProjectId(String(saved.project.id));
      setVideos((current) => [{ id: saved.project.id, title, render_output_url: saved.videoUrl, duration: rendered.duration, rendering_status: "complete" }, ...current]);
      toast({ title: "Promo rendered on this device" });
    } catch (err) {
      toast({ title: "Render failed", description: errorMessage(err), variant: "destructive" });
    } finally {
      setBusy("");
    }
  };

  if (!videoType) {
    return (
      <Screen>
        <View className="gap-4">
          <H1>Choose a video type</H1>
          <Muted>This sets the timeline length, the lyric sync workspace, and whether the promo hook plays.</Muted>
          <Card className="gap-2">
            <P className="font-semibold">Full lyrics video</P>
            <Muted>Uses the whole track and leaves the marketing intro off.</Muted>
            <Button label="Start lyrics video" onPress={() => setVideoType("lyrics")} />
          </Card>
          <Card className="gap-2">
            <P className="font-semibold">Short promo / teaser</P>
            <Muted>A 15s or 30s cut with an intro hook and an outro button.</Muted>
            <View className="flex-row gap-2">
              {[15, 30].map((seconds) => (
                <Chip key={seconds} label={`${seconds}s`} selected={duration === seconds} onPress={() => setDuration(seconds)} />
              ))}
            </View>
            <Button label={`Start ${duration}s teaser`} onPress={() => setVideoType("promo")} />
          </Card>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View className="gap-4">
        <H1>{campaignId ? "Campaign video" : "Studio"}</H1>
        <Muted>Live preview, lyrics sync, and export use the same free on-device Remotion renderer as the website.</Muted>
        {engine.error ? <Muted>{engine.error}</Muted> : <Muted>{engine.ready ? "Renderer ready." : "Loading the on-device renderer…"}</Muted>}
        <EnginePreview input={preview} playing={playing} />
        <Button label={playing ? "Pause preview" : "Play preview"} variant="outline" onPress={() => setPlaying((value) => !value)} />
        <View className="flex-row flex-wrap gap-2">
          {["look", "media", "lyrics", "effects"].map((item) => (
            <Chip key={item} label={item} selected={panel === item} onPress={() => setPanel(item)} />
          ))}
        </View>
        {panel === "media" ? (
          <View className="gap-3">
            <Field label="Title" value={title} onChangeText={setTitle} autoCapitalize="words" />
            <Field label="Artist" value={artistName} onChangeText={setArtistName} autoCapitalize="words" />
            <Field label="Hook text" value={text} onChangeText={setText} autoCapitalize="sentences" />
            <Field label="Outro button" value={outroCta} onChangeText={setOutroCta} />
            <Field label="Artwork URL" value={artworkUrl} onChangeText={setArtworkUrl} placeholder="https://" />
            <Field label="Audio URL" value={audioUrl} onChangeText={setAudioUrl} placeholder="https://" />
            <Field label="Audio start (seconds)" value={audioOffset} onChangeText={setAudioOffset} keyboardType="decimal-pad" />
            <Muted>Window starts at {offset}s and runs {resolvedDuration}s.</Muted>
          </View>
        ) : null}
        {panel === "lyrics" ? (
          <View className="gap-3">
            <Field label="Lyrics" value={lyrics} onChangeText={setLyrics} multiline autoCapitalize="sentences" />
            <Button label="Sync lyrics" variant="outline" loading={busy === "sync"} onPress={sync} />
            {cues.map((cue, index) => (
              <Card key={`${cue.start}-${index}`} className="gap-2">
                <Field label={`Cue ${index + 1}`} value={cue.text} onChangeText={(value) => setCues((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, text: value } : item))} />
                <Field label="Start" value={String(cue.start)} keyboardType="decimal-pad" onChangeText={(value) => setCues((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, start: Number(value) || 0, timeSeconds: Number(value) || 0 } : item))} />
                <Field label="End" value={String(cue.end)} keyboardType="decimal-pad" onChangeText={(value) => setCues((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, end: Number(value) || 0 } : item))} />
              </Card>
            ))}
          </View>
        ) : null}
        {panel === "look" ? (
          <View className="gap-3">
            <P className="font-semibold">Visual style</P>
            <View className="flex-row flex-wrap gap-2">
              {STYLES.map((item) => (
                <Chip key={item.value} label={item.label} selected={visualStyle === item.value} onPress={() => setVisualStyle(item.value)} />
              ))}
            </View>
            <P className="font-semibold">Font</P>
            <View className="flex-row flex-wrap gap-2">
              {FONT_CHOICES.map((font) => (
                <Chip key={font.id} label={font.label} selected={look.fontId === font.id} onPress={() => patchLook({ fontId: font.id })} />
              ))}
            </View>
            <Field label="Text color" value={look.textColor} onChangeText={(value) => patchLook({ textColor: value })} autoCapitalize="none" />
            <Field label="Font size" value={String(look.fontSize)} keyboardType="numeric" onChangeText={(value) => patchLook({ fontSize: Number(value) })} />
            <Field label="Letter spacing" value={String(look.letterSpacing)} keyboardType="decimal-pad" onChangeText={(value) => patchLook({ letterSpacing: Number(value) })} />
            <Field label="Animation speed (ms)" value={String(look.animationMs)} keyboardType="numeric" onChangeText={(value) => patchLook({ animationMs: Number(value) })} />
            <Field label="Lyrics X" value={String(look.lyricX)} keyboardType="decimal-pad" onChangeText={(value) => patchLook({ lyricX: Number(value) })} />
            <Field label="Lyrics Y" value={String(look.lyricY)} keyboardType="decimal-pad" onChangeText={(value) => patchLook({ lyricY: Number(value) })} />
            {videoType === "promo" ? (
              <View className="flex-row gap-2">
                {[15, 30].map((seconds) => (
                  <Chip key={seconds} label={`${seconds}s`} selected={duration === seconds} onPress={() => setDuration(seconds)} />
                ))}
              </View>
            ) : (
              <Muted>Full track · {resolvedDuration}s</Muted>
            )}
          </View>
        ) : null}
        {panel === "effects" ? (
          <View className="gap-3">
            <View className="flex-row flex-wrap gap-2">
              {PARTICLE_EFFECTS.map((item) => (
                <Chip key={item.id} label={item.label} selected={particleEffect === item.id} onPress={() => setParticleEffect(item.id)} />
              ))}
            </View>
            <Field label="Particle X" value={String(look.particleX)} keyboardType="decimal-pad" onChangeText={(value) => patchLook({ particleX: Number(value) })} />
            <Field label="Particle Y" value={String(look.particleY)} keyboardType="decimal-pad" onChangeText={(value) => patchLook({ particleY: Number(value) })} />
            <Field label="Wind" value={String(look.wind)} keyboardType="decimal-pad" onChangeText={(value) => patchLook({ wind: Number(value) })} />
            <Field label="Particle speed" value={String(look.particleSpeed)} keyboardType="decimal-pad" onChangeText={(value) => patchLook({ particleSpeed: Number(value) })} />
          </View>
        ) : null}
        {profileLabel ? <Muted>{profileLabel}</Muted> : null}
        {engine.progress && busy ? (
          <View className="gap-2">
            <Progress value={engine.progress.progress} />
            <Muted>{engine.progress.message || "Working…"}</Muted>
          </View>
        ) : null}
        <Button label="Analyze artwork and audio" variant="outline" loading={busy === "analyze"} onPress={analyze} />
        <Button label="Save project" variant="outline" loading={busy === "save"} onPress={saveDraft} />
        <Button label="Render on this device" loading={busy === "render"} onPress={render} />
        {outputUrl ? <Button label="Open rendered MP4" variant="outline" onPress={() => Linking.openURL(outputUrl)} /> : null}
        {videos.length ? (
          videos.map((video) => (
            <Card key={String(video.id)} className="gap-1">
              <P className="font-semibold">{video.title || title || "Promo video"}</P>
              <Muted>
                {video.rendering_status || "saved"} · {video.duration || duration}s
              </Muted>
            </Card>
          ))
        ) : campaignId ? (
          <Empty title="No videos yet" description="Render a promo on this device to attach it to the campaign." />
        ) : null}
      </View>
    </Screen>
  );
}
