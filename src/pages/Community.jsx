import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Bookmark, Copy, Link2, Loader2, Search, Users } from "lucide-react";
import CommunitySpotlightRow from "@/components/community/CommunitySpotlightRow";
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
import CommunityFeedPanel from "@/components/community/CommunityFeedPanel";
import ProfileBadges from "@/components/community/ProfileBadges";
import { COLLAB_INTENT_OPTIONS, collabIntentLabel, genreToSlug } from "@/services/communityProfileUtils";
import CommunityCirclesPanel from "@/components/community/CommunityCirclesPanel";
import CommunityInboxPanel from "@/components/community/CommunityInboxPanel";
import { loadCommunityFeed, loadCommunityMembers, loadPromoSwapRequests, toggleCommunityFollow } from "@/services/communityService";
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
  const [intentFilter, setIntentFilter] = useState("all");
  const [linksOnly, setLinksOnly] = useState(false);
  const [sort, setSort] = useState("newest");
  const [followingOnly, setFollowingOnly] = useState(false);
  const [spotlight, setSpotlight] = useState({ featured: [], recentlyActive: [] });
  const [followingIds, setFollowingIds] = useState([]);
  const [followBusyId, setFollowBusyId] = useState(null);
  const [ownPublic, setOwnPublic] = useState(null);
  const [tab, setTab] = useState("discover");
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedItems, setFeedItems] = useState([]);
  const [inboxPending, setInboxPending] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [payload, own] = await Promise.all([
          loadCommunityMembers(),
          user?.id ? fetchOwnProfile(user.id).catch(() => null) : null,
        ]);
        if (!cancelled) {
          setMembers(payload.members || []);
          setFollowingIds(payload.followingIds || []);
          setSpotlight(payload.spotlight || { featured: [], recentlyActive: [] });
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

  useEffect(() => {
    if (!user?.id) return;
    loadPromoSwapRequests()
      .then((data) => setInboxPending(data.pendingIncoming || 0))
      .catch(() => setInboxPending(0));
  }, [user?.id, tab]);

  useEffect(() => {
    if (tab !== "following" || !user?.id) return;
    let cancelled = false;
    (async () => {
      setFeedLoading(true);
      try {
        const { items } = await loadCommunityFeed();
        if (!cancelled) setFeedItems(items);
      } catch (e) {
        if (!cancelled) {
          toast({ variant: "destructive", title: "Feed unavailable", description: e.message });
          setFeedItems([]);
        }
      } finally {
        if (!cancelled) setFeedLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tab, user?.id, toast]);

  const onToggleFollow = async (member) => {
    if (!member?.id || member.isSelf || followBusyId) return;
    setFollowBusyId(member.id);
    try {
      const { following } = await toggleCommunityFollow(member.id);
      setFollowingIds((prev) => {
        const set = new Set(prev);
        if (following) set.add(member.id);
        else set.delete(member.id);
        return [...set];
      });
      setMembers((prev) =>
        prev.map((m) => (m.id === member.id ? { ...m, isFollowing: following } : m))
      );
      toast({
        title: following ? "Following" : "Removed bookmark",
        description: following
          ? `${member.displayName} will appear in your Following filter.`
          : `${member.displayName} was removed from your list.`,
      });
    } catch (e) {
      toast({ variant: "destructive", title: "Could not update follow", description: e.message });
    } finally {
      setFollowBusyId(null);
    }
  };

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
      if (intentFilter !== "all" && !(m.collabIntents || []).includes(intentFilter)) return false;
      if (linksOnly && !(m.socialLinkCount > 0)) return false;
      if (followingOnly && !followingIds.includes(m.id)) return false;
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
  }, [members, query, genreFilter, intentFilter, linksOnly, followingOnly, followingIds, sort]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Artists"
        title="Community"
        description="Discover profiles, follow artists, and see campaign teasers in your feed."
      />

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={tab === "discover" ? "default" : "outline"}
          className="rounded-full"
          onClick={() => setTab("discover")}
        >
          Discover
        </Button>
        <Button
          type="button"
          size="sm"
          variant={tab === "following" ? "default" : "outline"}
          className="rounded-full"
          onClick={() => setTab("following")}
        >
          Following feed
        </Button>
        <Button
          type="button"
          size="sm"
          variant={tab === "circles" ? "default" : "outline"}
          className="rounded-full"
          onClick={() => setTab("circles")}
        >
          Circles
        </Button>
        <Button
          type="button"
          size="sm"
          variant={tab === "inbox" ? "default" : "outline"}
          className="rounded-full"
          onClick={() => setTab("inbox")}
        >
          Inbox{inboxPending ? ` (${inboxPending})` : ""}
        </Button>
      </div>

      {tab === "following" ? <CommunityFeedPanel loading={feedLoading} items={feedItems} /> : null}
      {tab === "circles" ? <CommunityCirclesPanel /> : null}
      {tab === "inbox" ? <CommunityInboxPanel /> : null}

      {tab !== "discover" ? null : ownPublic === false ? (
        <SurfacePanel className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Your profile is private. Turn on a public profile so others can discover you in Community.
          </p>
          <Button className="shrink-0 rounded-full" asChild>
            <Link to="/profile">Open your profile</Link>
          </Button>
        </SurfacePanel>
      ) : null}

      {tab === "discover" && !loading ? <CommunitySpotlightRow spotlight={spotlight} /> : null}

      {tab === "discover" ? (
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
            <Label className="text-xs text-muted-foreground">Collab intent</Label>
            <Select value={intentFilter} onValueChange={setIntentFilter}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="Any intent" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any intent</SelectItem>
                {COLLAB_INTENT_OPTIONS.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.label}
                  </SelectItem>
                ))}
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

          <div className="flex flex-wrap items-center gap-4 pt-5 sm:pt-0">
            <div className="flex items-center gap-2">
              <Switch id="links-only" checked={linksOnly} onCheckedChange={setLinksOnly} />
              <Label htmlFor="links-only" className="cursor-pointer text-sm font-normal">
                Has social links
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="following-only" checked={followingOnly} onCheckedChange={setFollowingOnly} />
              <Label htmlFor="following-only" className="cursor-pointer text-sm font-normal">
                Following ({followingIds.length})
              </Label>
            </div>
          </div>
        </div>
      </SurfacePanel>
      ) : null}

      {tab === "discover" && loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : tab === "discover" && filtered.length === 0 ? (
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
      ) : tab === "discover" ? (
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
                      <ProfileBadges badges={member.badges} className="mt-1.5" />
                      {(member.collabIntents || []).length ? (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {member.collabIntents.slice(0, 2).map((id) => (
                            <span
                              key={id}
                              className="rounded-full bg-violet-500/10 px-1.5 py-0.5 text-[9px] font-medium text-violet-800 dark:text-violet-200"
                            >
                              {collabIntentLabel(id)}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      {typeof member.completenessScore === "number" ? (
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          Profile strength {member.completenessScore}%
                        </p>
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
                      {!member.isSelf ? (
                        <Button
                          type="button"
                          variant={member.isFollowing || followingIds.includes(member.id) ? "secondary" : "ghost"}
                          size="sm"
                          className="h-8 rounded-full px-2"
                          disabled={followBusyId === member.id}
                          onClick={() => onToggleFollow(member)}
                          aria-label={
                            member.isFollowing || followingIds.includes(member.id)
                              ? "Unfollow artist"
                              : "Follow artist"
                          }
                        >
                          <Bookmark
                            className={`h-3.5 w-3.5 ${member.isFollowing || followingIds.includes(member.id) ? "fill-current" : ""}`}
                          />
                        </Button>
                      ) : null}
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
                        <Link
                          key={g}
                          to={`/community/genre/${genreToSlug(g)}`}
                          className="rounded-full bg-muted/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground hover:bg-muted"
                        >
                          {g}
                        </Link>
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
      ) : null}
    </div>
  );
}
