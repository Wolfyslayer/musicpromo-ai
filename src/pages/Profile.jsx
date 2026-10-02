import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Camera, Globe, Loader2, Lock, Pencil, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import PageHeader from "@/components/PageHeader";
import SurfacePanel from "@/components/SurfacePanel";
import { useAuth } from "@/lib/AuthContext";
import { loadArtists } from "@/services/data";
import {
  formatHandleLabel,
  isUuid,
  normalizeHandleInput,
  profilePublicPath,
} from "@/services/profileHandle";
import {
  fetchOwnProfile,
  fetchPublicProfile,
  profileDisplayName,
  updateOwnProfile,
  uploadProfileAvatar,
} from "@/services/userProfile";
import { getConnectionStatus } from "@/services/socialService";

function Avatar({ url, name }) {
  const initial = (name || "?").charAt(0).toUpperCase();
  if (url) {
    return (
      <img src={url} alt="" className="h-24 w-24 rounded-full object-cover ring-2 ring-border/60" />
    );
  }
  return (
    <div className="grid h-24 w-24 place-items-center rounded-full bg-primary/15 text-2xl font-semibold text-primary ring-2 ring-border/60">
      {initial}
    </div>
  );
}

function ArtistCards({ artists }) {
  if (!artists?.length) return null;
  return (
    <div className="space-y-3">
      <h3 className="font-heading text-sm font-600 uppercase tracking-wider text-muted-foreground">Artists</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        {artists.map((a) => (
          <div key={a.id} className="surface rounded-2xl p-4">
            <div className="flex items-center gap-3">
              {a.profile_image ? (
                <img src={a.profile_image} alt="" className="h-12 w-12 rounded-full object-cover" />
              ) : (
                <div className="grid h-12 w-12 place-items-center rounded-full bg-muted text-sm font-600">
                  {a.name?.charAt(0)}
                </div>
              )}
              <div>
                <p className="font-600">{a.name}</p>
                {a.genre ? <p className="text-xs text-muted-foreground">{a.genre}</p> : null}
              </div>
            </div>
            {a.biography ? (
              <p className="mt-2 line-clamp-3 text-xs text-muted-foreground">{a.biography}</p>
            ) : null}
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              {a.spotify_url ? (
                <a href={a.spotify_url} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                  Spotify
                </a>
              ) : null}
              {a.instagram_url ? (
                <a href={a.instagram_url} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                  Instagram
                </a>
              ) : null}
              {a.tiktok_url ? (
                <a href={a.tiktok_url} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                  TikTok
                </a>
              ) : null}
              {a.youtube_url ? (
                <a href={a.youtube_url} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                  YouTube
                </a>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function slugMatchesOwnProfile(slug, userId, row) {
  if (!slug || !userId) return true;
  if (slug === userId) return true;
  const handle = row?.handle ? String(row.handle).toLowerCase() : "";
  return handle && slug.toLowerCase() === handle;
}

export default function Profile() {
  const { userId: routeSlug } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [isOwn, setIsOwn] = useState(!routeSlug);
  const [editing, setEditing] = useState(() => searchParams.get("edit") === "1");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [profile, setProfile] = useState(null);
  const [publicView, setPublicView] = useState(null);
  const [artists, setArtists] = useState([]);
  const [socialConnections, setSocialConnections] = useState([]);

  const [form, setForm] = useState({
    display_name: "",
    handle: "",
    bio: "",
    profile_public: true,
    hide_artists_on_profile: false,
  });

  useEffect(() => {
    if (searchParams.get("edit") === "1" && isOwn) {
      setEditing(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, isOwn, setSearchParams]);

  useEffect(() => {
    if (!isAuthenticated && !routeSlug) {
      navigate("/login");
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setPublicView(null);
      try {
        if (isAuthenticated && user?.id) {
          const row = await fetchOwnProfile(user.id);
          if (cancelled) return;
          const own = slugMatchesOwnProfile(routeSlug, user.id, row);
          setIsOwn(own);
          if (own) {
            setProfile(row);
            setForm({
              display_name: row?.display_name || row?.full_name || "",
              handle: row?.handle || "",
              bio: row?.bio || "",
              profile_public: row?.profile_public !== false,
              hide_artists_on_profile: row?.hide_artists_on_profile === true,
            });
            const [artistList, status] = await Promise.all([
              loadArtists(),
              getConnectionStatus().catch(() => null),
            ]);
            if (!cancelled) {
              setArtists(artistList);
              setSocialConnections(status?.connections || []);
            }
            if (!cancelled && routeSlug && isUuid(routeSlug) && row?.handle) {
              navigate(profilePublicPath(row), { replace: true });
            }
          } else if (routeSlug) {
            const res = await fetchPublicProfile(routeSlug);
            if (!res?.ok) {
              toast({ variant: "destructive", title: "Profile is private or not found" });
              navigate("/");
              return;
            }
            if (!cancelled) setPublicView(res.profile);
          }
        } else if (routeSlug) {
          setIsOwn(false);
          const res = await fetchPublicProfile(routeSlug);
          if (!res?.ok) {
            toast({ variant: "destructive", title: "Profile is private or not found" });
            navigate("/login");
            return;
          }
          if (!cancelled) setPublicView(res.profile);
        }
      } catch (e) {
        if (!cancelled) {
          toast({ variant: "destructive", title: "Could not load profile", description: e.message });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [routeSlug, user?.id, navigate, toast, isAuthenticated]);

  const displayName = isOwn
    ? profileDisplayName(profile, user)
    : publicView?.displayName || "Artist";

  const ownVisibleArtists = form.hide_artists_on_profile
    ? []
    : artists.filter((a) => a.show_on_public_profile !== false);

  const save = async () => {
    if (!user?.id) return;
    setSaving(true);
    try {
      const updated = await updateOwnProfile(user.id, form);
      setProfile(updated);
      setEditing(false);
      toast({ title: "Profile saved" });
      navigate(profilePublicPath(updated), { replace: true });
    } catch (e) {
      toast({ variant: "destructive", title: "Save failed", description: e.message });
    } finally {
      setSaving(false);
    }
  };

  const onPickAvatar = async (file) => {
    if (!file || !user?.id) return;
    setUploading(true);
    try {
      const updated = await uploadProfileAvatar(user.id, file);
      setProfile(updated);
      toast({ title: "Profile photo updated" });
    } catch (e) {
      toast({ variant: "destructive", title: "Upload failed", description: e.message });
    } finally {
      setUploading(false);
    }
  };

  const useGooglePhoto = async () => {
    if (!user?.id) return;
    const googleUrl = user.avatar_url;
    if (!googleUrl) {
      toast({ variant: "destructive", title: "No Google photo on this account" });
      return;
    }
    setSaving(true);
    try {
      const updated = await updateOwnProfile(user.id, {
        avatar_url: googleUrl,
        avatar_override: false,
      });
      setProfile(updated);
      toast({ title: "Using Google profile photo" });
    } catch (e) {
      toast({ variant: "destructive", title: "Could not reset photo", description: e.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isOwn && publicView) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Community" title={publicView.displayName} description="Public artist profile" />
        <SurfacePanel className="space-y-5">
          <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:text-left">
            <Avatar url={publicView.avatarUrl} name={publicView.displayName} />
            <div>
              <h2 className="font-heading text-xl font-semibold">{publicView.displayName}</h2>
              {publicView.handle ? (
                <p className="text-sm text-muted-foreground">{formatHandleLabel(publicView.handle)}</p>
              ) : null}
              {publicView.bio ? (
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">{publicView.bio}</p>
              ) : null}
            </div>
          </div>
          {!publicView.hideArtists && publicView.artists?.length ? (
            <ArtistCards artists={publicView.artists} />
          ) : null}
        </SurfacePanel>
      </div>
    );
  }

  if (isOwn && !editing) {
    const publicPath = profile?.profile_public !== false ? profilePublicPath(profile || user) : null;
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Account"
          title={displayName}
          description={
            profile?.handle
              ? `Your public profile ${formatHandleLabel(profile.handle)}`
              : "Set a @handle so others can find you in Community."
          }
          actions={
            <Button type="button" variant="outline" size="sm" className="rounded-full gap-1.5" onClick={() => setEditing(true)}>
              <Pencil className="h-3.5 w-3.5" />
              Edit profile
            </Button>
          }
        />

        <SurfacePanel className="space-y-5">
          <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:text-left">
            <Avatar url={profile?.avatar_url} name={displayName} />
            <div className="min-w-0 flex-1">
              <h2 className="font-heading text-xl font-semibold">{displayName}</h2>
              {profile?.handle ? (
                <p className="text-sm text-primary">{formatHandleLabel(profile.handle)}</p>
              ) : (
                <p className="text-sm text-muted-foreground">No @handle yet — tap Edit to claim one.</p>
              )}
              {form.bio ? (
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">{form.bio}</p>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">Add a short bio in edit mode.</p>
              )}
              {publicPath ? (
                <p className="mt-3 text-xs text-muted-foreground">
                  Public link:{" "}
                  <Link to={publicPath} className="text-primary hover:underline">
                    {window.location.origin}
                    {publicPath}
                  </Link>
                </p>
              ) : (
                <p className="mt-3 flex items-center justify-center gap-1 text-xs text-muted-foreground sm:justify-start">
                  <Lock className="h-3.5 w-3.5" /> Profile is private — only you can see this page.
                </p>
              )}
            </div>
          </div>
          {ownVisibleArtists.length ? <ArtistCards artists={ownVisibleArtists} /> : null}
        </SurfacePanel>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Account"
        title="Edit profile"
        description="Photo, @handle, bio, and privacy for Community."
        actions={
          isOwn ? (
            <Button type="button" variant="ghost" size="sm" className="rounded-full" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          ) : null
        }
      />

      <SurfacePanel className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="relative">
            <Avatar url={profile?.avatar_url} name={displayName} />
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => onPickAvatar(e.target.files?.[0])}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="absolute bottom-0 right-0 grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground shadow-md"
              aria-label="Upload profile photo"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            </button>
          </div>
          <div className="flex-1 space-y-2">
            <p className="text-sm text-muted-foreground">{user?.email}</p>
            {user?.avatar_url ? (
              <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={useGooglePhoto}>
                Use Google photo
              </Button>
            ) : null}
            {form.profile_public && profile ? (
              <p className="text-xs text-muted-foreground">
                Public link:{" "}
                <Link to={profilePublicPath({ ...profile, handle: form.handle || profile.handle })} className="text-primary hover:underline">
                  {window.location.origin}
                  {profilePublicPath({ ...profile, handle: form.handle || profile.handle })}
                </Link>
              </p>
            ) : (
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <Lock className="h-3.5 w-3.5" /> Profile is private — only you can see this page.
              </p>
            )}
          </div>
        </div>

        <div className="grid gap-4">
          <div className="space-y-1.5">
            <Label>Display name</Label>
            <Input
              value={form.display_name}
              onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
              className="rounded-xl"
              placeholder="Stage or real name"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Handle</Label>
            <div className="flex overflow-hidden rounded-xl border border-input bg-background focus-within:ring-2 focus-within:ring-ring">
              <span className="flex items-center bg-muted/40 px-3 text-sm text-muted-foreground">@</span>
              <Input
                value={form.handle}
                onChange={(e) =>
                  setForm((f) => ({ ...f, handle: normalizeHandleInput(e.target.value) }))
                }
                className="rounded-none border-0 focus-visible:ring-0"
                placeholder="your_name"
                maxLength={24}
                autoComplete="off"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              3–24 characters: lowercase letters, numbers, and underscores. Leave blank to clear.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>Bio</Label>
            <Textarea
              value={form.bio}
              onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
              rows={4}
              className="rounded-xl"
              placeholder="Short intro for other artists (optional)"
              maxLength={500}
            />
          </div>
        </div>

        <div className="space-y-3 rounded-2xl border border-border/60 bg-muted/15 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-start gap-2">
              <Globe className="mt-0.5 h-4 w-4 text-primary" />
              <div>
                <p className="text-sm font-600">Public profile</p>
                <p className="text-xs text-muted-foreground">Allow a shareable profile page for community discovery.</p>
              </div>
            </div>
            <Switch
              checked={form.profile_public}
              onCheckedChange={(c) => setForm((f) => ({ ...f, profile_public: c }))}
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-start gap-2">
              <Users className="mt-0.5 h-4 w-4 text-primary" />
              <div>
                <p className="text-sm font-600">Hide artists on public profile</p>
                <p className="text-xs text-muted-foreground">
                  Keep your profile public but hide roster cards and links. Social connections stay artist-scoped in Social Hub.
                </p>
              </div>
            </div>
            <Switch
              checked={form.hide_artists_on_profile}
              onCheckedChange={(c) => setForm((f) => ({ ...f, hide_artists_on_profile: c }))}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" className="rounded-full" disabled={saving} onClick={save}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save profile
          </Button>
          <Button type="button" variant="outline" className="rounded-full" onClick={() => setEditing(false)}>
            Done
          </Button>
        </div>
      </SurfacePanel>

      <SurfacePanel className="space-y-4">
        <h2 className="font-heading text-sm font-600 uppercase tracking-wider text-muted-foreground">
          Artists on your public profile
        </h2>
        {form.hide_artists_on_profile ? (
          <p className="text-sm text-muted-foreground">Artist cards are hidden while your profile stays public.</p>
        ) : ownVisibleArtists.length ? (
          <ul className="space-y-2">
            {ownVisibleArtists.map((a) => (
              <li key={a.id} className="flex items-center justify-between rounded-xl border border-border/50 px-3 py-2">
                <span className="text-sm font-500">{a.name}</span>
                <Button variant="ghost" size="sm" className="rounded-full" asChild>
                  <Link to={`/artists/${a.id}`}>Edit</Link>
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            No artists visible.{" "}
            <Link to="/artists/new" className="text-primary hover:underline">
              Create an artist
            </Link>{" "}
            and enable &quot;Show on public profile&quot; in the editor.
          </p>
        )}

        <h3 className="pt-2 font-heading text-xs font-600 uppercase tracking-wider text-muted-foreground">
          Connected platforms (by artist)
        </h3>
        <p className="text-xs text-muted-foreground">
          OAuth connections in Social Hub are tied to the artist you select there. Legacy connections without an artist still work as a fallback.
        </p>
        {socialConnections.length ? (
          <ul className="text-sm text-muted-foreground">
            {socialConnections.map((c) => (
              <li key={c.id}>
                {c.provider} — {c.username || c.accountName || "connected"}
                {c.artistId ? ` (artist ${c.artistId.slice(0, 8)}…)` : " (account-wide)"}
              </li>
            ))}
          </ul>
        ) : (
          <Button variant="outline" className="rounded-full" asChild>
            <Link to="/social/connect">Connect social accounts</Link>
          </Button>
        )}
      </SurfacePanel>
    </div>
  );
}
