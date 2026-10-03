import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import ArtistSocialIconLinks from "@/components/ArtistSocialIconLinks";
import ProfileBadges from "@/components/community/ProfileBadges";
import { Button } from "@/components/ui/button";
import PageHeader from "@/components/PageHeader";
import SurfacePanel from "@/components/SurfacePanel";
import EmptyState from "@/components/EmptyState";
import { useToast } from "@/components/ui/use-toast";
import { loadCommunityMembers } from "@/services/communityService";
import { genreToSlug, slugToGenreLabel } from "@/services/communityProfileUtils";
import { formatHandleLabel, profilePublicPath } from "@/services/profileHandle";

export default function CommunityGenre() {
  const { slug } = useParams();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState([]);

  const label = slugToGenreLabel(slug || "");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const payload = await loadCommunityMembers();
        if (!cancelled) setMembers(payload.members || []);
      } catch (e) {
        if (!cancelled) {
          toast({ variant: "destructive", title: "Could not load genre hub", description: e.message });
          setMembers([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, toast]);

  const matched = useMemo(() => {
    const s = String(slug || "").toLowerCase();
    return members.filter((m) => {
      const slugs = m.genreSlugs || (m.genres || []).map(genreToSlug);
      return slugs.includes(s);
    });
  }, [members, slug]);

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" className="rounded-full" asChild>
        <Link to="/community">
          <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
          Community
        </Link>
      </Button>
      <PageHeader
        eyebrow="Genre hub"
        title={label || "Genre"}
        description={`Public artists tagged with ${label || "this genre"}.`}
      />

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : matched.length === 0 ? (
        <EmptyState
          title="No profiles in this hub yet"
          description="Try another genre from Discover, or add this genre to one of your artists."
          action={
            <Button className="rounded-full" asChild>
              <Link to="/community">Back to Discover</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {matched.map((member) => (
            <SurfacePanel key={member.id} className="space-y-3">
              <div className="flex items-start gap-3">
                <Link to={profilePublicPath(member)} className="shrink-0">
                  {member.avatarUrl ? (
                    <img src={member.avatarUrl} alt="" className="h-12 w-12 rounded-full object-cover" />
                  ) : (
                    <div className="grid h-12 w-12 place-items-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
                      {(member.displayName || "?").charAt(0).toUpperCase()}
                    </div>
                  )}
                </Link>
                <div className="min-w-0 flex-1">
                  <Link to={profilePublicPath(member)} className="font-heading text-base font-semibold hover:text-primary">
                    {member.displayName}
                  </Link>
                  {member.handle ? (
                    <p className="text-xs text-muted-foreground">{formatHandleLabel(member.handle)}</p>
                  ) : null}
                  <ProfileBadges badges={member.badges} className="mt-2" />
                  {member.bio ? (
                    <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{member.bio}</p>
                  ) : null}
                </div>
              </div>
              {member.artists?.[0] ? (
                <ArtistSocialIconLinks artist={member.artists[0]} size="sm" />
              ) : null}
            </SurfacePanel>
          ))}
        </div>
      )}
    </div>
  );
}
