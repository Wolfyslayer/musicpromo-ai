import { db } from "@/api/base44Client";

import { useEffect, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";

import { loadArtists } from "@/services/data";
import { GENRES, LANGUAGES, RELEASE_STATUSES, RELEASE_TYPES } from "@/services/constants";
import ReleaseTracklistEditor from "@/components/releases/ReleaseTracklistEditor";
import { todayISO } from "@/services/format";
import ArtworkUpload from "@/components/ArtworkUpload";
import { useAuth } from "@/lib/AuthContext";
import PageHeader from "@/components/PageHeader";
import SurfacePanel from "@/components/SurfacePanel";
import ReleaseDeleteDialog from "@/components/releases/ReleaseDeleteDialog";

export default function ReleaseEditor() {
  const { id } = useParams();
  const location = useLocation();
  // /releases/new has no :id param, so id is undefined — detect create via pathname.
  const isNew = location.pathname === "/releases/new" || id === "new";
  const releaseId = isNew ? null : id;
  const navigate = useNavigate();
  const { toast } = useToast();
  const { requireAuth } = useAuth();
  const [artists, setArtists] = useState([]);
  const [loading, setLoading] = useState(!isNew);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    title: "",
    artist_id: "",
    release_date: todayISO(),
    status: "draft",
    artwork_url: "",
    description: "",
    presave_url: "",
    release_type: "single",
    genre: "",
    language: "English",
  });

  useEffect(() => {
    loadArtists().then(setArtists).catch(() => setArtists([]));
  }, []);

  useEffect(() => {
    if (isNew || !releaseId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    db.entities.Release.get(releaseId)
      .then((r) => {
        setForm({
          title: r.title || "",
          artist_id: r.artist_id || "",
          release_date: r.release_date || todayISO(),
          status: r.status || "draft",
          artwork_url: r.artwork_url || "",
          description: r.description || "",
          presave_url: r.presave_url || "",
          release_type: r.release_type || "single",
          genre: r.genre || "",
          language: r.language || "English",
        });
      })
      .catch((e) => {
        toast({ variant: "destructive", title: "Release not found", description: e.message });
        navigate("/releases");
      })
      .finally(() => setLoading(false));
  }, [releaseId, isNew, navigate, toast]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.title?.trim()) {
      toast({ variant: "destructive", title: "Title required" });
      return;
    }
    if (!form.artist_id) {
      toast({ variant: "destructive", title: "Artist required" });
      return;
    }
    setBusy(true);
    try {
      const payload = {
        title: form.title.trim(),
        artist_id: form.artist_id,
        release_date: form.release_date || null,
        status: form.status || "draft",
        artwork_url: form.artwork_url || "",
        description: form.description || "",
        presave_url: form.presave_url || "",
        release_type: form.release_type || "single",
        genre: form.genre || "",
        language: form.language || "English",
        is_demo: false,
      };
      if (isNew) {
        const created = await db.entities.Release.create(payload);
        toast({ title: "Release created" });
        navigate(`/releases/${created.id}`);
      } else {
        await db.entities.Release.update(releaseId, payload);
        toast({ title: "Release saved" });
        navigate(`/releases/${releaseId}`);
      }
    } catch (e) {
      toast({ variant: "destructive", title: "Save failed", description: e.message });
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="h-64 animate-shimmer rounded-2xl" />;

  return (
    <div className="space-y-5">
      <button
        onClick={() => navigate(isNew ? "/releases" : `/releases/${releaseId}`)}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>
      <PageHeader title={isNew ? "New release" : "Edit release"} eyebrow="Catalog" />

      <SurfacePanel className="space-y-5">
        <div>
          <Label className="text-xs text-muted-foreground">Artwork</Label>
          <div className="mt-2">
            <ArtworkUpload
              guard={requireAuth}
              value={form.artwork_url}
              onChange={(payload) =>
                set("artwork_url", typeof payload === "string" ? payload : payload?.url || "")
              }
            />
          </div>
        </div>

        <Field label="Release Title *">
          <Input
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="e.g. Vad lämnar vi efter oss?"
            className="rounded-xl"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Artist *">
            <Select value={form.artist_id} onValueChange={(v) => set("artist_id", v)}>
              <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select artist" /></SelectTrigger>
              <SelectContent>
                {artists.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Release Date">
            <Input
              type="date"
              value={form.release_date}
              onChange={(e) => set("release_date", e.target.value)}
              className="rounded-xl"
            />
          </Field>
          <Field label="Release type">
            <Select value={form.release_type} onValueChange={(v) => set("release_type", v)}>
              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                {RELEASE_TYPES.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Genre">
            <Select value={form.genre} onValueChange={(v) => set("genre", v)}>
              <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select genre" /></SelectTrigger>
              <SelectContent>
                {GENRES.map((g) => (
                  <SelectItem key={g} value={g}>{g}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Language">
            <Select value={form.language} onValueChange={(v) => set("language", v)}>
              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((lang) => (
                  <SelectItem key={lang} value={lang}>{lang}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Status">
            <Select value={form.status} onValueChange={(v) => set("status", v)}>
              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                {RELEASE_STATUSES.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Pre-save URL (optional)">
            <Input
              value={form.presave_url}
              onChange={(e) => set("presave_url", e.target.value)}
              placeholder="https://"
              className="rounded-xl"
            />
          </Field>
        </div>

        <Field label="Description (optional)">
          <Textarea
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            rows={3}
            placeholder="Short release notes…"
            className="rounded-xl"
          />
        </Field>

        <Button onClick={save} disabled={busy} className="w-full rounded-full sm:w-auto">
          {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
          {busy ? "Saving…" : isNew ? "Create Release" : "Save Release"}
        </Button>
      </SurfacePanel>

      {!isNew && releaseId && form.artist_id ? (
        <SurfacePanel className="mt-4">
          <ReleaseTracklistEditor
            releaseId={releaseId}
            artistId={form.artist_id}
            releaseArtworkUrl={form.artwork_url}
            releaseDate={form.release_date}
            releaseGenre={form.genre}
            releaseLanguage={form.language}
          />
        </SurfacePanel>
      ) : null}

      {!isNew && releaseId ? (
        <SurfacePanel className="mt-4 border-destructive/30">
          <p className="mb-3 text-sm text-muted-foreground">
            Delete this release from your catalog. Songs are unlinked; existing campaign plans are kept.
          </p>
          <ReleaseDeleteDialog
            releaseId={releaseId}
            releaseTitle={form.title}
            onDeleted={(err) => {
              if (err) {
                toast({ variant: "destructive", title: "Could not delete release", description: err.message });
                return;
              }
              toast({ title: "Release deleted" });
              navigate("/releases");
            }}
            triggerVariant="destructive"
            triggerSize="default"
          />
        </SurfacePanel>
      ) : null}
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
