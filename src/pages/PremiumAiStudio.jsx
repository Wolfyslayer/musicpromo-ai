import { useEffect, useMemo, useState } from "react";
import { dispatchOpenBillingPlans } from "@/lib/billingEvents";
import { Loader2, Music2, Split, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/lib/AuthContext";
import { billingFailureToast } from "@/lib/billingErrors";
import { fetchBillingStatus } from "@/services/billingService";
import { loadArtists, loadSongs } from "@/services/data";
import { audioDisplayName } from "@/services/audioDisplay";
import { resolvePlayableAudioUrl } from "@/services/videoService";
import {
  fetchStemSplitStatus,
  fetchSunoStatus,
  generateSunoTrack,
  splitAudioStems,
} from "@/services/premiumAiService";
import PageHeader from "@/components/PageHeader";

const STEM_SOURCE_URL = "__url__";

export default function PremiumAiStudio() {
  const { requireAuth, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [billing, setBilling] = useState(null);
  const [sunoStatus, setSunoStatus] = useState(null);
  const [stemStatus, setStemStatus] = useState(null);
  const [sunoForm, setSunoForm] = useState({ title: "", prompt: "", lyrics: "" });
  const [sunoUrl, setSunoUrl] = useState("");
  const [sunoBusy, setSunoBusy] = useState(false);
  const [stemUrl, setStemUrl] = useState("");
  const [stemInput, setStemInput] = useState("");
  const [stemSongId, setStemSongId] = useState("");
  const [stemSource, setStemSource] = useState(STEM_SOURCE_URL);
  const [stemPreviewUrl, setStemPreviewUrl] = useState("");
  const [songs, setSongs] = useState([]);
  const [artists, setArtists] = useState([]);
  const [stems, setStems] = useState(null);
  const [stemBusy, setStemBusy] = useState(false);

  useEffect(() => {
    fetchBillingStatus().then(setBilling).catch(() => {});
    fetchSunoStatus().then(setSunoStatus).catch(() => setSunoStatus({ configured: false }));
    fetchStemSplitStatus().then(setStemStatus).catch(() => setStemStatus({ configured: false }));
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      setSongs([]);
      setArtists([]);
      return;
    }
    Promise.all([loadSongs(), loadArtists()])
      .then(([songRows, artistRows]) => {
        setSongs(songRows || []);
        setArtists(artistRows || []);
      })
      .catch(() => {
        setSongs([]);
        setArtists([]);
      });
  }, [isAuthenticated]);

  const artistNameById = useMemo(() => {
    const map = {};
    for (const a of artists) map[a.id] = a.name || "Artist";
    return map;
  }, [artists]);

  const songsWithAudio = useMemo(
    () =>
      (songs || [])
        .filter((s) => String(s.audio_url || "").trim())
        .sort((a, b) => String(b.created_date || "").localeCompare(String(a.created_date || ""))),
    [songs]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (stemSource !== STEM_SOURCE_URL && stemSongId) {
        const song = songsWithAudio.find((s) => s.id === stemSongId);
        const resolved = song?.audio_url ? await resolvePlayableAudioUrl(song.audio_url) : "";
        if (!cancelled) setStemPreviewUrl(resolved || "");
        return;
      }
      if (stemSource === STEM_SOURCE_URL && stemInput.trim()) {
        const resolved = await resolvePlayableAudioUrl(stemInput.trim());
        if (!cancelled) setStemPreviewUrl(resolved || stemInput.trim());
        return;
      }
      if (!cancelled) setStemPreviewUrl("");
    })();
    return () => {
      cancelled = true;
    };
  }, [stemSource, stemSongId, stemInput, songsWithAudio]);

  const hasSuno = billing?.billingExempt || billing?.premiumFeatures?.suno_generation;
  const hasStem = billing?.billingExempt || billing?.premiumFeatures?.stem_split;

  const runSuno = () =>
    requireAuth(async () => {
      if (!sunoForm.prompt.trim()) {
        toast({ variant: "destructive", title: "Add a prompt", description: "Describe the song you want." });
        return;
      }
      setSunoBusy(true);
      try {
        const data = await generateSunoTrack({
          title: sunoForm.title,
          prompt: sunoForm.prompt,
          lyrics: sunoForm.lyrics,
        });
        setSunoUrl(data.audioUrl || "");
        toast({ title: "Track ready", description: "Download or attach to a release." });
      } catch (e) {
        const fail = billingFailureToast(e);
        toast({ variant: "destructive", title: fail.title, description: fail.description });
      } finally {
        setSunoBusy(false);
      }
    });

  const runStem = () =>
    requireAuth(async () => {
      const usingSong = stemSource !== STEM_SOURCE_URL && stemSongId;
      if (!usingSong && !stemInput.trim()) {
        toast({
          variant: "destructive",
          title: "Choose audio",
          description: "Pick an uploaded song from your catalog or paste a public MP3/WAV link.",
        });
        return;
      }
      setStemBusy(true);
      setStems(null);
      try {
        const data = usingSong
          ? await splitAudioStems({ songId: stemSongId })
          : await splitAudioStems({ audioUrl: stemInput.trim() });
        const label = usingSong
          ? songsWithAudio.find((s) => s.id === stemSongId)?.title || "Catalog song"
          : stemInput.trim();
        setStemUrl(label);
        setStems(data.stems || {});
        toast({ title: "Stems ready", description: "Download each stem below." });
      } catch (e) {
        const fail = billingFailureToast(e);
        toast({ variant: "destructive", title: fail.title, description: fail.description });
      } finally {
        setStemBusy(false);
      }
    });

  return (
    <div className="space-y-8 pb-16">
      <PageHeader
        eyebrow="Premium AI"
        title="Songs & stems"
        description="Creator plan and above — full promo stack plus Suno & stems, priced below most AI-only apps."
        actions={
          !hasSuno || !hasStem ? (
            <Button type="button" className="rounded-full" onClick={() => dispatchOpenBillingPlans()}>
              Upgrade from $9/mo
            </Button>
          ) : null
        }
      />

      {!hasSuno || !hasStem ? (
        <p className="rounded-xl border border-primary/25 bg-primary/5 px-4 py-3 text-sm">
          Suno generation and stem splitting require an active <strong>Creator</strong>, <strong>Pro</strong>, or{" "}
          <strong>Studio</strong> subscription.{" "}
          <button type="button" className="font-semibold text-primary underline" onClick={() => dispatchOpenBillingPlans()}>
            Compare plans
          </button>
        </p>
      ) : null}

      <section className="space-y-4 rounded-2xl border border-border/70 bg-card p-5">
        <div className="flex items-center gap-2">
          <Music2 className="h-5 w-5 text-primary" />
          <h2 className="font-heading text-lg font-semibold">AI song (Suno)</h2>
        </div>
        {!sunoStatus?.configured ? (
          <p className="text-sm text-amber-200/90">
            Backend: TemPolor — set <code className="text-xs">SUNO_API_KEY</code> (raw key in TemPolor console, not
            Bearer), <code className="text-xs">PUBLIC_APP_URL</code> (e.g. https://musicpromoai.site), optional{" "}
            <code className="text-xs">SUNO_API_BASE_URL</code> (must include https:// — default
            https://api.tempolor.com), and <code className="text-xs">SUNO_API_MODEL</code> (tempolor-latest).
          </p>
        ) : sunoStatus?.provider === "tempolor" ? (
          <p className="text-xs text-muted-foreground">{sunoStatus.note}</p>
        ) : null}
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5 md:col-span-2">
            <Label>Title</Label>
            <Input
              value={sunoForm.title}
              onChange={(e) => setSunoForm((f) => ({ ...f, title: e.target.value }))}
              className="rounded-xl"
              placeholder="Single title"
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label>Prompt</Label>
            <Textarea
              value={sunoForm.prompt}
              onChange={(e) => setSunoForm((f) => ({ ...f, prompt: e.target.value }))}
              rows={4}
              className="rounded-xl"
              placeholder="Upbeat Afro-pop, female vocal, summer festival energy…"
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label>Lyrics (optional)</Label>
            <Textarea
              value={sunoForm.lyrics}
              onChange={(e) => setSunoForm((f) => ({ ...f, lyrics: e.target.value }))}
              rows={5}
              className="rounded-xl font-mono text-sm"
              placeholder="Verse / chorus lyrics…"
            />
          </div>
        </div>
        <Button type="button" className="rounded-full" disabled={sunoBusy || !hasSuno} onClick={runSuno}>
          {sunoBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
          Generate song
        </Button>
        {sunoUrl ? (
          <audio controls className="w-full" src={sunoUrl}>
            <track kind="captions" />
          </audio>
        ) : null}
      </section>

      <section className="space-y-4 rounded-2xl border border-border/70 bg-card p-5">
        <div className="flex items-center gap-2">
          <Split className="h-5 w-5 text-primary" />
          <h2 className="font-heading text-lg font-semibold">Stem splitter</h2>
        </div>
        {!stemStatus?.configured ? (
          <p className="text-sm text-amber-200/90">
            Backend: TemPolor stems use the same <code className="text-xs">SUNO_API_KEY</code> +{" "}
            <code className="text-xs">PUBLIC_APP_URL</code> as AI songs (optional{" "}
            <code className="text-xs">SUNO_API_STEM_MODEL</code>, default Stems v2). Or set{" "}
            <code className="text-xs">REPLICATE_API_TOKEN</code> for Replicate Demucs instead.
          </p>
        ) : stemStatus?.provider === "tempolor" ? (
          <p className="text-xs text-muted-foreground">{stemStatus.note}</p>
        ) : null}
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Audio source</Label>
            <Select
              value={stemSource}
              onValueChange={(v) => {
                setStemSource(v);
                setStems(null);
                if (v === STEM_SOURCE_URL) {
                  setStemSongId("");
                } else if (!stemSongId && songsWithAudio[0]?.id) {
                  setStemSongId(songsWithAudio[0].id);
                }
              }}
            >
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="Choose source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={STEM_SOURCE_URL}>Paste a public URL</SelectItem>
                <SelectItem value="catalog" disabled={songsWithAudio.length === 0}>
                  My uploaded songs{songsWithAudio.length ? ` (${songsWithAudio.length})` : ""}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {stemSource !== STEM_SOURCE_URL ? (
            <div className="space-y-1.5">
              <Label>Song from catalog</Label>
              {songsWithAudio.length ? (
                <Select value={stemSongId || undefined} onValueChange={setStemSongId}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Choose a song with uploaded audio" />
                  </SelectTrigger>
                  <SelectContent>
                    {songsWithAudio.map((song) => (
                      <SelectItem key={song.id} value={song.id}>
                        {song.title || "Untitled"}
                        {song.artist_id ? ` · ${artistNameById[song.artist_id] || "Artist"}` : ""}
                        {song.track_number ? ` · #${song.track_number}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Upload audio on a release track first (Releases → edit release → track audio).
                </p>
              )}
              {stemSongId ? (
                <p className="text-xs text-muted-foreground">
                  File:{" "}
                  {audioDisplayName({
                    audioFilename: songsWithAudio.find((s) => s.id === stemSongId)?.audio_filename,
                    audioUrl: songsWithAudio.find((s) => s.id === stemSongId)?.audio_url,
                  })}
                </p>
              ) : null}
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>Public audio URL</Label>
              <Input
                value={stemInput}
                onChange={(e) => setStemInput(e.target.value)}
                className="rounded-xl"
                placeholder="https://…/track.mp3"
              />
            </div>
          )}

          {stemPreviewUrl ? (
            <audio controls className="w-full" src={stemPreviewUrl}>
              <track kind="captions" />
            </audio>
          ) : null}
        </div>
        <Button
          type="button"
          variant="outline"
          className="rounded-full"
          disabled={
            stemBusy ||
            !hasStem ||
            (stemSource !== STEM_SOURCE_URL ? !stemSongId : !stemInput.trim())
          }
          onClick={runStem}
        >
          {stemBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Split className="mr-2 h-4 w-4" />}
          Split stems
        </Button>
        {stems ? (
          <ul className="space-y-2 text-sm">
            {Object.entries(stems).map(([name, url]) => (
              <li key={name} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/50 px-3 py-2">
                <span className="font-medium capitalize">
                  {name === "stems_zip" ? "All stems (ZIP)" : name.replace(/_/g, " ")}
                </span>
                <a href={url} target="_blank" rel="noreferrer" className="text-primary underline">
                  Download
                </a>
              </li>
            ))}
          </ul>
        ) : null}
        {stemUrl && !stems ? null : null}
      </section>
    </div>
  );
}
