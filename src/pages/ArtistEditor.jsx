import { db } from '@/api/base44Client';

import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, ImagePlus, Share2, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";

import { GENRES } from "@/services/constants";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import PageHeader from "@/components/PageHeader";
import SurfacePanel from "@/components/SurfacePanel";
import { normalizeArtistRow, openSocialConnectForArtist } from "@/services/artistSocial";
import {
  artistFormNeedsSocialUrlSync,
  connectionAvatarOptions,
  syncArtistFormFromConnections,
} from "@/services/artistSocialUrls";
import { getConnectionStatus } from "@/services/socialService";
import { cn } from "@/lib/utils";

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
  const [form, setForm] = useState({
    name: "",
    profile_image: "",
    biography: "",
    genre: "",
    location: "",
    website: "",
    spotify_url: "",
    youtube_url: "",
    tiktok_url: "",
    instagram_url: "",
    facebook_url: "",
    show_on_public_profile: true,
    profile_image_from_provider: "",
  });
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [connections, setConnections] = useState([]);
  const initialSyncRef = useRef(false);

  const refreshConnectionsAndMerge = useCallback(
    async (baseForm, { silent = false } = {}) => {
      if (isNew || !id) return baseForm;
      const status = await getConnectionStatus().catch(() => null);
      const list = status?.connections || [];
      setConnections(list);
      const merged = syncArtistFormFromConnections(baseForm, list, id);
      if (!silent && artistFormNeedsSocialUrlSync(baseForm, list, id)) {
        toast({
          title: "Social links updated",
          description: "Connected account URLs were filled in. Save to keep them on this artist.",
        });
      }
      return merged;
    },
    [id, isNew, toast]
  );

  const refetchSocialMerge = useCallback(
    async (currentForm, { silent = true } = {}) => {
      if (isNew || !id) return currentForm;
      const merged = await refreshConnectionsAndMerge(currentForm, { silent });
      setForm(merged);
      return merged;
    },
    [id, isNew, refreshConnectionsAndMerge]
  );

  useEffect(() => {
    initialSyncRef.current = false;
    if (!isNew) {
      (async () => {
        try {
          const a = await db.entities.Artist.get(id);
          const base = normalizeArtistRow(a);
          const next = await refreshConnectionsAndMerge(base, { silent: true });
          setForm((f) => ({ ...f, ...next }));
          initialSyncRef.current = true;
        } catch {
          navigate("/artists");
        }
      })();
    }
  }, [id, isNew, navigate, refreshConnectionsAndMerge]);

  useEffect(() => {
    if (isNew || !id) return undefined;
    const onFocus = () => {
      if (!initialSyncRef.current) return;
      setForm((current) => {
        void refetchSocialMerge(current, { silent: true });
        return current;
      });
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [id, isNew, refetchSocialMerge]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const pickImage = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await db.integrations.Core.UploadPublicFile({ file });
      setForm((f) => ({ ...f, profile_image: file_url, profile_image_from_provider: "upload" }));
    } catch (e) {
      toast({ variant: "destructive", title: "Upload failed", description: e.message });
    } finally {
      setUploading(false);
    }
  };

  const removeArtist = async () => {
    if (isNew) return;
    setDeleting(true);
    try {
      const campaigns = await db.entities.Campaign.list("-created_date", 200);
      const inUse = (campaigns || []).filter((c) => c.artist_id === id && !c.is_demo);
      if (inUse.length) {
        toast({
          variant: "destructive",
          title: "Artist in use",
          description: `This artist is linked to ${inUse.length} campaign(s). Remove or reassign those first.`,
        });
        setDeleteOpen(false);
        return;
      }
      await db.entities.Artist.delete(id);
      toast({ title: "Artist deleted" });
      navigate("/artists");
    } catch (e) {
      toast({ variant: "destructive", title: "Delete failed", description: e.message });
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  };

  const avatarOptions = !isNew ? connectionAvatarOptions(connections, id) : [];

  const pickSocialAvatar = (provider, url) => {
    setForm((f) => ({
      ...f,
      profile_image: url,
      profile_image_from_provider: provider,
    }));
  };

  const syncFromConnections = () => {
    if (isNew) return;
    setForm((current) => {
      void refetchSocialMerge(current, { silent: false });
      return current;
    });
  };

  const save = async () => {
    if (!form.name?.trim()) { toast({ variant: "destructive", title: "Name required" }); return; }
    setBusy(true);
    try {
      const payload = isNew ? form : await refreshConnectionsAndMerge(form, { silent: true });
      if (isNew) {
        const created = await db.entities.Artist.create({ ...payload, is_demo: false });
        toast({ title: "Artist created" });
        navigate(`/artists/${created.id}`);
      } else {
        await db.entities.Artist.update(id, payload);
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
              <button
                type="button"
                onClick={() =>
                  setForm((f) => ({ ...f, profile_image: "", profile_image_from_provider: "" }))
                }
                className="absolute -right-1 -top-1 grid h-6 w-6 place-items-center rounded-full bg-destructive text-destructive-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button onClick={() => inputRef.current?.click()} className="grid h-20 w-20 place-items-center rounded-full border-2 border-dashed border-border/70 bg-muted/30 text-muted-foreground hover:border-primary/50">
              {uploading ? <Loader2 className="h-6 w-6 animate-spin" /> : <ImagePlus className="h-6 w-6" />}
            </button>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-600">Profile image</p>
            <p className="text-xs text-muted-foreground">Upload your own or use a photo from a connected social account.</p>
            {form.profile_image && (
              <button type="button" onClick={() => inputRef.current?.click()} className="mt-1 text-xs text-primary">
                Replace upload
              </button>
            )}
            {avatarOptions.length ? (
              <div className="mt-3">
                <p className="text-xs font-500 text-muted-foreground">From connected accounts</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {avatarOptions.map((opt) => {
                    const active =
                      form.profile_image === opt.url &&
                      form.profile_image_from_provider === opt.provider;
                    return (
                      <button
                        key={opt.provider}
                        type="button"
                        title={opt.label}
                        onClick={() => pickSocialAvatar(opt.provider, opt.url)}
                        className={cn(
                          "relative rounded-full ring-2 ring-offset-2 ring-offset-background transition",
                          active ? "ring-primary" : "ring-transparent hover:ring-border"
                        )}
                      >
                        <img src={opt.url} alt="" className="h-11 w-11 rounded-full object-cover" />
                        <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-muted px-1.5 text-[10px] font-medium capitalize">
                          {opt.provider}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
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

        <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/15 px-3 py-3">
          <div>
            <p className="text-sm font-600">Show on public profile</p>
            <p className="text-xs text-muted-foreground">Listed on your community profile when it is public.</p>
          </div>
          <Switch
            checked={form.show_on_public_profile !== false}
            onCheckedChange={(c) => set("show_on_public_profile", c)}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {FIELDS.map((f) => (
            <Field key={f.key} label={f.label}><Input value={form[f.key]} onChange={(e) => set(f.key, e.target.value)} placeholder="https://" /></Field>
          ))}
        </div>

        {!isNew ? (
          <div className="rounded-2xl border border-border/60 bg-muted/15 p-4">
            <p className="text-sm font-600">Social publishing</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Connect TikTok, Instagram, and YouTube for this artist. Links and profile photos can sync from these accounts.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-full"
                onClick={() => openSocialConnectForArtist(navigate, id)}
              >
                <Share2 className="mr-1.5 h-4 w-4" />
                Connect platforms for {form.name || "this artist"}
              </Button>
              <Button type="button" variant="secondary" className="rounded-full" onClick={syncFromConnections}>
                Sync links from connections
              </Button>
            </div>
          </div>
        ) : null}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          {!isNew ? (
            <Button
              type="button"
              variant="ghost"
              className="rounded-full text-destructive hover:text-destructive"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="mr-1.5 h-4 w-4" />
              Delete artist
            </Button>
          ) : (
            <span />
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => navigate("/artists")} className="rounded-full">
              Cancel
            </Button>
            <Button onClick={save} disabled={busy} className="rounded-full">
              {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              {isNew ? "Create Artist" : "Save"}
            </Button>
          </div>
        </div>
      </SurfacePanel>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {form.name || "this artist"}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the artist profile from your roster. Campaigns linked to this artist must be removed first.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
              onClick={removeArtist}
            >
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
