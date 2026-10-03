import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Copy, Link2, Loader2, Search, Users } from "lucide-react";
import ArtistSocialIconLinks from "@/components/ArtistSocialIconLinks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import PageHeader from "@/components/PageHeader";
import SurfacePanel from "@/components/SurfacePanel";
import EmptyState from "@/components/EmptyState";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/lib/AuthContext";
import { loadCommunityMembers } from "@/services/communityService";
import { absoluteProfileUrl, formatHandleLabel, profilePublicPath } from "@/services/profileHandle";
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

function copyProfileLink(member, toast) {
  const url = absoluteProfileUrl(member);
  navigator.clipboard
    .writeText(url)
    .then(() => toast({ title: "Profile link copied" }))
    .catch(() => toast({ variant: "destructive", title: "Could not copy link" }));
}

export default function Community() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState([]);
  const [query, setQuery] = useState("");
  const [genreFilter, setGenreFilter] = useState("all");
  const [linksOnly, setLinksOnly] = useState(false);
  const [sort, setSort] = useState("newest");
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

  const genreOptions = useMemo(() => {
    const set = new Set();
    for (const m of members) {
      for (const g of m.genres || []) {
        if (g) set.add(String(g));
      }
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [members]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = members.filter((m) => {
      if (q) {
        const blob = `${m.displayName} ${m.handle || ""} ${m.bio || ""} ${(m.genres || []).join(" ")} ${(m.artists || []).map((a) => a.name).join(" ")}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      if (genreFilter !== "all" && !(m.genres || []).includes(genreFilter)) return false;
      if (linksOnly && !(m.socialLinkCount > 0)) return false;
      return true;
    });

    list = [...list];
    if (sort === "name") {
      list.sort((a, b) => String(a.displayName).localeCompare(String(b.displayName)));
    } else if (sort === "artists") {
      list.sort((a, b) => (b.artistCount || 0) - (a.artistCount || 0));
    } else {
      list.sort(
        (a, b) =>
          Date.parse(b.memberSince || 0) - Date.parse(a.memberSince || 0) ||
          String(a.displayName).localeCompare(String(b.displayName))
      );
    }
    return list;
  }, [members, query, genreFilter, linksOnly, sort]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Discover"
        title="Community"
        description="Browse public artist profiles, explore genres, and connect through social links."
      />

      {ownPublic === false ? (
        <SurfacePanel className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Your profile is private. Turn on a public profile so others can discover you in Community.
          </p>
          <Button className="shrink-0 rounded-full" asChild>
            <Link to="/profile">Open your profile</Link>
          </Button>
        </SurfacePanel>
      ) : null}

      <SurfacePanel className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-heading text-lg font-semibold">{members.length}</p>
            <p className="text-xs text-muted-foreground">public artist{members.length === 1 ? "" : "s"}</p>
          </div>
          {!loading && members.length ? (
            <p className="text-xs text-muted-foreground">
              Showing {filtered.length} of {members.length}
            </p>
          ) : null}
        </div>

        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, handle, genre, or artist…"
            className="rounded-full pl-9"
          />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="flex min-w-[10rem] flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Sort</Label>
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger className="rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="name">Name (A–Z)</SelectItem>
                <SelectItem value="artists">Most artists</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex min-w-[10rem] flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Genre</Label>
            <Select value={genreFilter} onValueChange={setGenreFilter}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="All genres" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All genres</SelectItem>
                {genreOptions.map((g) => (
                  <SelectItem key={g} value={g}>
                    {g}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2 pt-5 sm:pt-0">
            <Switch id="links-only" checked={linksOnly} onCheckedChange={setLinksOnly} />
            <Label htmlFor="links-only" className="cursor-pointer text-sm font-normal">
              Has social links
            </Label>
          </div>
        </div>
      </SurfacePanel>

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
              ? "Try another search, genre, or turn off “Has social links”."
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
                <Link to={member.isSelf ? "/profile" : profilePublicPath(member)} className="shrink-0">
                  <MemberAvatar url={member.avatarUrl} name={member.displayName} />
                </Link>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link
                        to={member.isSelf ? "/profile" : profilePublicPath(member)}
                        className="font-heading truncate text-base font-semibold hover:text-primary"
                      >
                        {member.displayName}
                      </Link>
                      {member.handle ? (
                        <p className="truncate text-xs text-muted-foreground">{formatHandleLabel(member.handle)}</p>
                      ) : null}
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        {member.isSelf ? <span className="font-medium text-primary">You</span> : null}
                        {member.artistCount > 0 ? (
                          <span>
                            {member.artistCount} artist{member.artistCount === 1 ? "" : "s"}
                          </span>
                        ) : null}
                        {member.socialLinkCount > 0 ? (
                          <span className="inline-flex items-center gap-0.5">
                            <Link2 className="h-3 w-3" aria-hidden />
                            {member.socialLinkCount} link{member.socialLinkCount === 1 ? "" : "s"}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col gap-1">
                      <Button variant="ghost" size="sm" className="h-8 rounded-full px-2" asChild>
                        <Link to={member.isSelf ? "/profile" : profilePublicPath(member)}>View</Link>
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 rounded-full px-2"
                        onClick={() => copyProfileLink(member, toast)}
                        aria-label="Copy profile link"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  {(member.genres || []).length ? (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {member.genres.slice(0, 4).map((g) => (
                        <button
                          key={g}
                          type="button"
                          className="rounded-full bg-muted/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground hover:bg-muted"
                          onClick={() => setGenreFilter(g)}
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  {member.bio ? (
                    <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{member.bio}</p>
                  ) : null}
                </div>
              </div>

              {member.artists?.length ? (
                <ul className="space-y-2 border-t border-border/40 pt-3">
                  {member.artists.slice(0, 3).map((artist) => (
                    <li key={artist.id} className="text-sm">
                      <p className="font-500">{artist.name}</p>
                      {artist.genre ? <p className="text-xs text-muted-foreground">{artist.genre}</p> : null}
                      <ArtistSocialIconLinks artist={artist} className="mt-2" size="sm" />
                    </li>
                  ))}
                  {member.artists.length > 3 ? (
                    <li className="text-xs text-muted-foreground">+{member.artists.length - 3} more on profile</li>
                  ) : null}
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
