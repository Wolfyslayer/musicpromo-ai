import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, Loader2, Search, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import PageHeader from "@/components/PageHeader";
import SurfacePanel from "@/components/SurfacePanel";
import EmptyState from "@/components/EmptyState";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/lib/AuthContext";
import { loadCommunityMembers } from "@/services/communityService";
import { fetchOwnProfile } from "@/services/userProfile";

function MemberAvatar({ url, name }) {
  if (url) {
    return <img src={url} alt="" className="h-12 w-12 rounded-full object-cover ring-2 ring-border/50" />;
  }
  return (
    <div className="grid h-12 w-12 place-items-center rounded-full bg-primary/15 text-sm font-semibold text-primary ring-2 ring-border/50">
      {(name || "?").charAt(0).toUpperCase()}
    </div>
  );
}

function socialLinks(artist) {
  const links = [
    ["Instagram", artist.instagram_url],
    ["TikTok", artist.tiktok_url],
    ["YouTube", artist.youtube_url],
    ["Spotify", artist.spotify_url],
  ].filter(([, href]) => href && String(href).trim());
  return links;
}

export default function Community() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState([]);
  const [query, setQuery] = useState("");
  const [ownPublic, setOwnPublic] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [list, own] = await Promise.all([
          loadCommunityMembers(),
          user?.id ? fetchOwnProfile(user.id).catch(() => null) : null,
        ]);
        if (!cancelled) {
          setMembers(list);
          setOwnPublic(own?.profile_public !== false);
        }
      } catch (e) {
        if (!cancelled) {
          toast({ variant: "destructive", title: "Community unavailable", description: e.message });
          setMembers([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, toast]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) => {
      const blob = `${m.displayName} ${m.bio || ""} ${(m.artists || []).map((a) => a.name).join(" ")}`.toLowerCase();
      return blob.includes(q);
    });
  }, [members, query]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Discover"
        title="Community"
        description="Find other artists with public profiles and connect via their social links."
      />

      {ownPublic === false ? (
        <SurfacePanel className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Your profile is private. Turn on a public profile so others can discover you in Community.
          </p>
          <Button className="shrink-0 rounded-full" asChild>
            <Link to="/profile">Open profile settings</Link>
          </Button>
        </SurfacePanel>
      ) : null}

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search artists or genres…"
          className="rounded-full pl-9"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title={members.length ? "No matches" : "No public profiles yet"}
          description={
            members.length
              ? "Try a different search term."
              : "Be the first — enable a public profile and add artist social links."
          }
          action={
            <Button className="rounded-full" asChild>
              <Link to="/profile">Set up your profile</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map((member) => (
            <SurfacePanel key={member.id} className="flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <MemberAvatar url={member.avatarUrl} name={member.displayName} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h2 className="font-heading truncate text-base font-semibold">{member.displayName}</h2>
                      {member.isSelf ? (
                        <span className="text-xs font-medium text-primary">You</span>
                      ) : null}
                    </div>
                    <Button variant="ghost" size="sm" className="shrink-0 rounded-full" asChild>
                      <Link to={member.isSelf ? "/profile" : `/profile/${member.id}`}>View</Link>
                    </Button>
                  </div>
                  {member.bio ? (
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{member.bio}</p>
                  ) : null}
                </div>
              </div>

              {member.artists?.length ? (
                <ul className="space-y-2 border-t border-border/40 pt-3">
                  {member.artists.slice(0, 3).map((artist) => (
                    <li key={artist.id} className="text-sm">
                      <p className="font-500">{artist.name}</p>
                      {artist.genre ? (
                        <p className="text-xs text-muted-foreground">{artist.genre}</p>
                      ) : null}
                      <div className="mt-1 flex flex-wrap gap-2">
                        {socialLinks(artist).map(([label, href]) => (
                          <a
                            key={label}
                            href={href}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-0.5 text-xs text-primary hover:underline"
                          >
                            {label}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="border-t border-border/40 pt-3 text-xs text-muted-foreground">
                  No artist links listed yet.
                </p>
              )}
            </SurfacePanel>
          ))}
        </div>
      )}
    </div>
  );
}
