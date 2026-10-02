import { db } from '@/api/base44Client';

import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, ImagePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";

import { GENRES } from "@/services/constants";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PageHeader from "@/components/PageHeader";
import SurfacePanel from "@/components/SurfacePanel";

const FIELDS = [
  { key: "website", label: "Website" },
  { key: "spotify_url", label: "Spotify URL" },
  { key: "youtube_url", label: "YouTube URL" },
  { key: "tiktok_url", label: "TikTok URL" },
  { key: "instagram_url", label: "Instagram URL" },
  { key: "facebook_url", label: "Facebook URL" },
];

export default function ArtistEditor() {
  const { id } = useParams();
  const isNew = id === "new";
  const navigate = useNavigate();
  const { toast } = useToast();
  const inputRef = useRef(null);
  const [form, setForm] = useState({ name: "", profile_image: "", biography: "", genre: "", location: "", website: "", spotify_url: "", youtube_url: "", tiktok_url: "", instagram_url: "", facebook_url: "" });
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!isNew) {
      db.entities.Artist.get(id).then((a) => setForm((f) => ({ ...f, ...a }))).catch(() => navigate("/artists"));
    }
  }, [id, isNew, navigate]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const pickImage = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await db.integrations.Core.UploadPublicFile({ file });
      set("profile_image", file_url);
    } catch (e) {
      toast({ variant: "destructive", title: "Upload failed", description: e.message });
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!form.name?.trim()) { toast({ variant: "destructive", title: "Name required" }); return; }
    setBusy(true);
    try {
      if (isNew) {
        const created = await db.entities.Artist.create({ ...form, is_demo: false });
        toast({ title: "Artist created" });
        navigate(`/artists/${created.id}`);
      } else {
        await db.entities.Artist.update(id, form);
        toast({ title: "Artist saved" });
        navigate("/artists");
      }
    } catch (e) {
      toast({ variant: "destructive", title: "Save failed", description: e.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <button onClick={() => navigate("/artists")} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to artists
      </button>
      <PageHeader title={isNew ? "New artist" : "Edit artist"} eyebrow="Roster" />

      <SurfacePanel className="space-y-5">
        {/* Profile image */}
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => pickImage(e.target.files?.[0])} />
        <div className="flex items-center gap-4">
          {form.profile_image ? (
            <div className="relative">
              <img src={form.profile_image} alt="Profile" className="h-20 w-20 rounded-full object-cover" />
              <button onClick={() => set("profile_image", "")} className="absolute -right-1 -top-1 grid h-6 w-6 place-items-center rounded-full bg-destructive text-destructive-foreground"><X className="h-3.5 w-3.5" /></button>
            </div>
          ) : (
            <button onClick={() => inputRef.current?.click()} className="grid h-20 w-20 place-items-center rounded-full border-2 border-dashed border-border/70 bg-muted/30 text-muted-foreground hover:border-primary/50">
              {uploading ? <Loader2 className="h-6 w-6 animate-spin" /> : <ImagePlus className="h-6 w-6" />}
            </button>
          )}
          <div>
            <p className="text-sm font-600">Profile image</p>
            <p className="text-xs text-muted-foreground">JPG / PNG / WEBP — stored publicly.</p>
            {form.profile_image && <button onClick={() => inputRef.current?.click()} className="mt-1 text-xs text-primary">Replace</button>}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Artist Name *"><Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Aurora Vale" /></Field>
          <Field label="Genre">
            <Select value={form.genre} onValueChange={(v) => set("genre", v)}>
              <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select genre" /></SelectTrigger>
              <SelectContent>{GENRES.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Location"><Input value={form.location} onChange={(e) => set("location", e.target.value)} placeholder="e.g. Stockholm, SE" /></Field>
          <Field label="Website"><Input value={form.website} onChange={(e) => set("website", e.target.value)} placeholder="https://" /></Field>
        </div>

        <Field label="Biography"><Textarea value={form.biography} onChange={(e) => set("biography", e.target.value)} rows={4} placeholder="Short bio…" /></Field>

        <div className="grid gap-4 sm:grid-cols-2">
          {FIELDS.map((f) => (
            <Field key={f.key} label={f.label}><Input value={form[f.key]} onChange={(e) => set(f.key, e.target.value)} placeholder="https://" /></Field>
          ))}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => navigate("/artists")}>Cancel</Button>
          <Button onClick={save} disabled={busy} className="rounded-full">{busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}{isNew ? "Create Artist" : "Save"}</Button>
        </div>
      </SurfacePanel>
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
