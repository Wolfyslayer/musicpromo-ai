import { useEffect, useState } from "react";
import { Linking, View } from "react-native";
import { useAuth } from "@/components/AuthProvider";
import { useEngine } from "@/components/DeviceEngine";
import { useToast } from "@/components/Toast";
import { Button, Card, Chip, Empty, Field, H1, Muted, P, Progress, Screen } from "@/components/ui";
import { db } from "@/lib/db";
import { errorMessage } from "@/lib/format";
import type { LyricCue } from "@/lib/lyrics";
import { selectCampaignVideos } from "@/lib/social";
import type { Row } from "@/lib/types";
import { saveRenderedPromo } from "@/lib/videoSave";

const STYLES = [
  { label: "Pop", value: "pop" },
  { label: "Hip-hop", value: "hiphop" },
  { label: "Rock", value: "rock" },
];

const PARTICLES = [
  { label: "None", value: "none" },
  { label: "Sparks", value: "sparks" },
  { label: "Smoke", value: "smoke" },
  { label: "Stardust", value: "stardust" },
];

export function StudioScreen({ campaignId }: { campaignId?: string }) {
  const engine = useEngine();
  const { toast } = useToast();
  const { user, requireAuth } = useAuth();
  const [songId, setSongId] = useState("");
  const [title, setTitle] = useState("");
  const [artistName, setArtistName] = useState("");
  const [text, setText] = useState("");
  const [lyrics, setLyrics] = useState("");
  const [artworkUrl, setArtworkUrl] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [visualStyle, setVisualStyle] = useState("pop");
  const [particleEffect, setParticleEffect] = useState("none");
  const [duration, setDuration] = useState(15);
  const [cues, setCues] = useState<LyricCue[]>([]);
  const [videos, setVideos] = useState<Row[]>([]);
  const [outputUrl, setOutputUrl] = useState("");
  const [profileLabel, setProfileLabel] = useState("");
  const [busy, setBusy] = useState("");

  useEffect(() => {
    if (!campaignId) return;
    let active = true;
    (async () => {
      try {
        const campaign = await db.entities.Campaign.get(campaignId);
        const song = campaign.song_id ? await db.entities.Song.get(String(campaign.song_id)).catch(() => null) : null;
        const artist = campaign.artist_id ? await db.entities.Artist.get(String(campaign.artist_id)).catch(() => null) : null;
        const existing = await selectCampaignVideos(campaignId).catch(() => []);
        if (!active) return;
        setSongId(String(song?.id || campaign.song_id || ""));
        setTitle(String(song?.title || campaign.name || ""));
        setArtistName(String(artist?.name || ""));
        setText(String(song?.description || ""));
        setLyrics(String(song?.lyrics || ""));
        setArtworkUrl(String(song?.artwork_url || ""));
        setAudioUrl(String(song?.audio_url || ""));
        setVideos(existing);
        const latest = existing.find((video) => video.render_output_url);
        if (latest?.render_output_url) setOutputUrl(String(latest.render_output_url));
      } catch (err) {
        if (active) toast({ title: "Could not load studio", description: errorMessage(err), variant: "destructive" });
      }
    })();
    return () => {
      active = false;
    };
  }, [campaignId, toast]);

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
      if (profile.duration) setDuration(Math.min(30, Math.max(8, Math.round(profile.duration))));
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
      const next = await engine.syncLyrics({ audioUrl, duration });
      setCues(next);
      if (!lyrics.trim() && next.length) setLyrics(next.map((cue) => cue.text).join("\n"));
      toast({ title: next.length ? "Lyrics synced" : "No lyrics detected" });
    } catch (err) {
      toast({ title: "Lyrics sync failed", description: errorMessage(err), variant: "destructive" });
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
        artworkUrl,
        audioUrl,
        duration,
        title,
        artistName,
        text,
        lyrics,
        lyricCues: cues,
        visualStyle,
        particleEffect,
        videoType: "promo",
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
        duration: rendered.duration,
        width: rendered.width,
        height: rendered.height,
        userId: user?.id,
      });
      setOutputUrl(saved.videoUrl);
      setVideos((current) => [{ id: saved.project.id, title, render_output_url: saved.videoUrl, duration: rendered.duration, rendering_status: "complete" }, ...current]);
      toast({ title: "Promo rendered on this device" });
    } catch (err) {
      toast({ title: "Render failed", description: errorMessage(err), variant: "destructive" });
    } finally {
      setBusy("");
    }
  };

  return (
    <Screen>
      <View className="gap-4">
        <H1>{campaignId ? "Campaign video" : "Studio"}</H1>
        <Muted>
          Rendering, artwork color, and lyrics sync run on this device with the same free Remotion and Whisper-tiny path as the website. Encoding needs WebCodecs, which works in Chrome, Firefox, and Android Chrome.
        </Muted>
        {engine.error ? <Muted>{engine.error}</Muted> : <Muted>{engine.ready ? "Renderer ready." : "Loading the on-device renderer…"}</Muted>}
        <Field label="Title" value={title} onChangeText={setTitle} autoCapitalize="words" />
        <Field label="Artist" value={artistName} onChangeText={setArtistName} autoCapitalize="words" />
        <Field label="Hook text" value={text} onChangeText={setText} autoCapitalize="sentences" />
        <Field label="Lyrics" value={lyrics} onChangeText={setLyrics} multiline autoCapitalize="sentences" />
        <Field label="Artwork URL" value={artworkUrl} onChangeText={setArtworkUrl} placeholder="https://" />
        <Field label="Audio URL" value={audioUrl} onChangeText={setAudioUrl} placeholder="https://" />
        <P className="font-semibold">Visual style</P>
        <View className="flex-row flex-wrap gap-2">
          {STYLES.map((item) => (
            <Chip key={item.value} label={item.label} selected={visualStyle === item.value} onPress={() => setVisualStyle(item.value)} />
          ))}
        </View>
        <P className="font-semibold">Particles</P>
        <View className="flex-row flex-wrap gap-2">
          {PARTICLES.map((item) => (
            <Chip key={item.value} label={item.label} selected={particleEffect === item.value} onPress={() => setParticleEffect(item.value)} />
          ))}
        </View>
        <P className="font-semibold">Duration</P>
        <View className="flex-row gap-2">
          {[15, 30].map((seconds) => (
            <Chip key={seconds} label={`${seconds}s`} selected={duration === seconds} onPress={() => setDuration(seconds)} />
          ))}
        </View>
        {profileLabel ? <Muted>{profileLabel}</Muted> : null}
        {engine.progress && busy ? (
          <View className="gap-2">
            <Progress value={engine.progress.progress} />
            <Muted>{engine.progress.message || "Working…"}</Muted>
          </View>
        ) : null}
        <Button label="Analyze artwork and audio" variant="outline" loading={busy === "analyze"} onPress={analyze} />
        <Button label="Sync lyrics" variant="outline" loading={busy === "sync"} onPress={sync} />
        <Button label="Render on this device" loading={busy === "render"} onPress={render} />
        {cues.length ? (
          <Card className="gap-1">
            <P className="font-semibold">Lyric cues</P>
            {cues.slice(0, 8).map((cue) => (
              <Muted key={`${cue.start}-${cue.text}`}>
                {cue.start.toFixed(1)}s {cue.text}
              </Muted>
            ))}
          </Card>
        ) : null}
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
