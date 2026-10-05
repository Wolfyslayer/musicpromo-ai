import { useState } from "react";
import { Loader2 } from "lucide-react";
import { db } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import ArtworkUpload from "@/components/ArtworkUpload";
import ReleaseTracklistEditor from "@/components/releases/ReleaseTracklistEditor";
import { GENRES, LANGUAGES, RELEASE_TYPES } from "@/services/constants";
import { songDefaultsFromRelease } from "@/services/releaseDefaults";
import { useAuth } from "@/lib/AuthContext";

/**
 * Release metadata + tracklist (genre & language apply to every track).
 */
export default function ReleaseInfoStep({ release, artists, onSaved }) {
  const { toast } = useToast();
  const { requireAuth } = useAuth();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    title: release.title || "",
    artist_id: release.artist_id || "",
    release_type: release.release_type || "single",
    release_date: release.release_date || "",
    artwork_url: release.artwork_url || "",
    presave_url: release.presave_url || "",
    description: release.description || "",
    genre: release.genre || "",
    language: release.language || "English",
  });

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const saveRelease = async () => {
    if (!form.title.trim() || !form.artist_id) {
      toast({ variant: "destructive", title: "Title and artist required" });
      return;
    }
    if (!form.genre || !form.language) {
      toast({ variant: "destructive", title: "Genre and language required", description: "These apply to every song on the release." });
      return;
    }
    setBusy(true);
    try {
      const payload = {
        title: form.title.trim(),
        artist_id: form.artist_id,
        release_type: form.release_type || "single",
        release_date: form.release_date || null,
        artwork_url: form.artwork_url || "",
        presave_url: form.presave_url || "",
        description: form.description || "",
        genre: form.genre,
        language: form.language,
        status: release.status || "draft",
        is_demo: false,
      };
      await db.entities.Release.update(release.id, payload);
      const updatedRelease = { ...release, ...payload };
      const songs = await db.entities.Song.list("-created_date", 500);
      const onRelease = songs.filter((s) => s.release_id === release.id);
      const defaults = songDefaultsFromRelease(updatedRelease);
      await Promise.all(
        onRelease.map((s) =>
          db.entities.Song.update(s.id, {
            ...defaults,
            artist_id: form.artist_id,
          })
        )
      );
      toast({ title: "Release details saved" });
      onSaved?.();
    } catch (e) {
      toast({ variant: "destructive", title: "Save failed", description: e.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Set release info once — <strong>genre</strong> and <strong>language</strong> apply to every track. Next you will
        upload audio (and optional lyrics) per song, then generate the campaign plan.
      </p>

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Artwork</Label>
        <ArtworkUpload
          guard={requireAuth}
          value={form.artwork_url}
          onChange={(payload) => set("artwork_url", typeof payload === "string" ? payload : payload?.url || "")}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-xs text-muted-foreground">Release title</Label>
          <Input value={form.title} onChange={(e) => set("title", e.target.value)} className="rounded-xl" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Artist</Label>
          <Select value={form.artist_id} onValueChange={(v) => set("artist_id", v)}>
            <SelectTrigger className="rounded-xl">
              <SelectValue placeholder="Select artist" />
            </SelectTrigger>
            <SelectContent>
              {artists.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Type</Label>
          <Select value={form.release_type} onValueChange={(v) => set("release_type", v)}>
            <SelectTrigger className="rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RELEASE_TYPES.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Genre (all tracks)</Label>
          <Select value={form.genre} onValueChange={(v) => set("genre", v)}>
            <SelectTrigger className="rounded-xl">
              <SelectValue placeholder="Select genre" />
            </SelectTrigger>
            <SelectContent>
              {GENRES.map((g) => (
                <SelectItem key={g} value={g}>
                  {g}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Language (all tracks)</Label>
          <Select value={form.language} onValueChange={(v) => set("language", v)}>
            <SelectTrigger className="rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.map((lang) => (
                <SelectItem key={lang} value={lang}>
                  {lang}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Release date</Label>
          <Input type="date" value={form.release_date} onChange={(e) => set("release_date", e.target.value)} className="rounded-xl" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Pre-save URL (optional)</Label>
          <Input value={form.presave_url} onChange={(e) => set("presave_url", e.target.value)} className="rounded-xl" placeholder="https://" />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-xs text-muted-foreground">Description (optional)</Label>
          <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={3} className="rounded-xl" />
        </div>
      </div>

      <ReleaseTracklistEditor
        releaseId={release.id}
        artistId={form.artist_id || release.artist_id}
        releaseArtworkUrl={form.artwork_url}
        releaseDate={form.release_date}
        releaseGenre={form.genre}
        releaseLanguage={form.language}
        onSaved={onSaved}
      />

      <Button type="button" className="rounded-full" disabled={busy} onClick={() => requireAuth(saveRelease)}>
        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Save release details
      </Button>
    </div>
  );
}
