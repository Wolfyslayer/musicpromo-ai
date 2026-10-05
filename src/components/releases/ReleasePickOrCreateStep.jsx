import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { db } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import ArtworkUpload from "@/components/ArtworkUpload";
import { loadArtists, loadReleases } from "@/services/data";
import { RELEASE_TYPES } from "@/services/constants";
import { todayISO } from "@/services/format";
import { useAuth } from "@/lib/AuthContext";

/**
 * Step 1 of campaign create: pick an existing release or create one with a tracklist.
 */
export default function ReleasePickOrCreateStep({ onReleaseReady }) {
  const { toast } = useToast();
  const { requireAuth } = useAuth();
  const [mode, setMode] = useState("pick");
  const [releases, setReleases] = useState([]);
  const [artists, setArtists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [form, setForm] = useState({
    title: "",
    artist_id: "",
    release_type: "single",
    release_date: todayISO(),
    artwork_url: "",
    presave_url: "",
    trackTitles: "Track 1",
  });

  useEffect(() => {
    Promise.all([loadReleases(), loadArtists()])
      .then(([r, a]) => {
        setReleases(r || []);
        setArtists(a || []);
      })
      .finally(() => setLoading(false));
  }, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const continueWithExisting = () => {
    if (!selectedId) {
      toast({ variant: "destructive", title: "Select a release" });
      return;
    }
    onReleaseReady(selectedId);
  };

  const createAndContinue = async () => {
    if (!form.title.trim() || !form.artist_id) {
      toast({ variant: "destructive", title: "Release title and artist required" });
      return;
    }
    const titles = form.trackTitles
      .split("\n")
      .map((t) => t.trim())
      .filter(Boolean);
    if (!titles.length) {
      toast({ variant: "destructive", title: "Add at least one track title" });
      return;
    }
    setBusy(true);
    try {
      const release = await db.entities.Release.create({
        title: form.title.trim(),
        artist_id: form.artist_id,
        release_type: form.release_type || "single",
        release_date: form.release_date || null,
        artwork_url: form.artwork_url || "",
        presave_url: form.presave_url || "",
        status: "draft",
        is_demo: false,
      });
      for (let i = 0; i < titles.length; i++) {
        await db.entities.Song.create({
          artist_id: form.artist_id,
          release_id: release.id,
          title: titles[i],
          track_number: i + 1,
          release_date: form.release_date || null,
          artwork_url: form.artwork_url || "",
          is_demo: false,
        });
      }
      toast({ title: "Release created" });
      onReleaseReady(release.id);
    } catch (e) {
      toast({ variant: "destructive", title: "Could not create release", description: e.message });
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading releases…
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Every campaign belongs to a <strong>release</strong> (single, EP, or album). Pick one you already have or create
        it here — then you will plan rollout and social posts for each track.
      </p>

      <div className="inline-flex rounded-full bg-muted/50 p-1">
        <button
          type="button"
          className={`rounded-full px-4 py-1.5 text-sm font-medium ${mode === "pick" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
          onClick={() => setMode("pick")}
        >
          Existing release
        </button>
        <button
          type="button"
          className={`rounded-full px-4 py-1.5 text-sm font-medium ${mode === "new" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
          onClick={() => setMode("new")}
        >
          New release
        </button>
      </div>

      {mode === "pick" ? (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Release</Label>
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="Choose a release" />
              </SelectTrigger>
              <SelectContent>
                {releases.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.title} {r.song_count ? `(${r.song_count} tracks)` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {!releases.length ? (
            <p className="text-xs text-muted-foreground">No releases yet — switch to New release.</p>
          ) : null}
          <Button type="button" className="rounded-full" onClick={continueWithExisting}>
            Continue with this release
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
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
              <Input value={form.title} onChange={(e) => set("title", e.target.value)} className="rounded-xl" placeholder="Album or single name" />
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
              <Label className="text-xs text-muted-foreground">Release date</Label>
              <Input type="date" value={form.release_date} onChange={(e) => set("release_date", e.target.value)} className="rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Pre-save URL (optional)</Label>
              <Input value={form.presave_url} onChange={(e) => set("presave_url", e.target.value)} className="rounded-xl" placeholder="https://" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Track titles (one per line)</Label>
            <Textarea
              value={form.trackTitles}
              onChange={(e) => set("trackTitles", e.target.value)}
              rows={form.release_type === "single" ? 2 : 6}
              className="rounded-xl font-mono text-sm"
              placeholder={"Intro\nSingle name\nOutro"}
            />
            <p className="text-xs text-muted-foreground">
              Singles & EPs: one campaign per track. Albums: one line per song, then one shared album campaign in the next steps.
            </p>
          </div>
          <Button type="button" className="rounded-full" disabled={busy} onClick={() => requireAuth(createAndContinue)}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Create release & continue
          </Button>
        </div>
      )}
    </div>
  );
}
