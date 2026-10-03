import { Link } from "react-router-dom";
import { Loader2, Megaphone, Radio } from "lucide-react";
import ArtworkImage from "@/components/ArtworkImage";
import EmptyState from "@/components/EmptyState";
import SurfacePanel from "@/components/SurfacePanel";
import { Button } from "@/components/ui/button";
import { formatHandleLabel, profilePublicPath } from "@/services/profileHandle";

function FeedAvatar({ user }) {
  if (user?.avatarUrl) {
    return (
      <img src={user.avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover ring-2 ring-border/40" />
    );
  }
  return (
    <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
      {(user?.displayName || "?").charAt(0).toUpperCase()}
    </div>
  );
}

export default function CommunityFeedPanel({ loading, items }) {
  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!items?.length) {
    return (
      <EmptyState
        icon={Radio}
        title="Your feed is quiet"
        description="Follow artists in Discover to see campaign teasers and recent activity here."
        action={
          <Button className="rounded-full" asChild>
            <Link to="/community">Browse Discover</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item, idx) => {
        const user = item.user;
        const key = `${item.type}-${user?.id}-${item.at}-${idx}`;
        if (item.type === "campaign_share" && item.campaign) {
          return (
            <SurfacePanel key={key} className="flex gap-3">
              <Link to={profilePublicPath(user)} className="shrink-0">
                <FeedAvatar user={user} />
              </Link>
              <div className="min-w-0 flex-1 space-y-2">
                <p className="text-sm">
                  <Link to={profilePublicPath(user)} className="font-semibold hover:text-primary">
                    {user?.displayName}
                  </Link>
                  {user?.handle ? (
                    <span className="text-muted-foreground"> {formatHandleLabel(user.handle)}</span>
                  ) : null}
                  <span className="text-muted-foreground"> shared a campaign</span>
                </p>
                <div className="flex gap-3 rounded-xl border border-border/50 bg-muted/15 p-3">
                  {item.campaign.artworkUrl ? (
                    <ArtworkImage
                      src={item.campaign.artworkUrl}
                      alt=""
                      className="h-14 w-14 shrink-0 rounded-lg"
                      rounded="rounded-lg"
                    />
                  ) : (
                    <div className="grid h-14 w-14 shrink-0 place-items-center rounded-lg bg-muted">
                      <Megaphone className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate font-600">{item.campaign.title}</p>
                    {item.campaign.teaser ? (
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{item.campaign.teaser}</p>
                    ) : null}
                  </div>
                </div>
              </div>
            </SurfacePanel>
          );
        }
        if (item.type === "profile_active") {
          return (
            <SurfacePanel key={key} className="flex items-center gap-3">
              <Link to={profilePublicPath(user)}>
                <FeedAvatar user={user} />
              </Link>
              <div className="min-w-0 flex-1">
                <p className="text-sm">
                  <Link to={profilePublicPath(user)} className="font-semibold hover:text-primary">
                    {user?.displayName}
                  </Link>
                  <span className="text-muted-foreground"> — {item.message || "Recently active"}</span>
                </p>
              </div>
              <Button variant="outline" size="sm" className="shrink-0 rounded-full" asChild>
                <Link to={profilePublicPath(user)}>View</Link>
              </Button>
            </SurfacePanel>
          );
        }
        return null;
      })}
    </div>
  );
}
