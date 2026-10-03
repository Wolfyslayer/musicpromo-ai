import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Share2, CalendarDays, Sparkles, Send, Clock, ExternalLink, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import SocialPlatformCard from "@/components/social/SocialPlatformCard";
import EmptyState from "@/components/EmptyState";
import StatusBadge from "@/components/StatusBadge";
import { useSocialHub } from "@/contexts/SocialHubContext";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { buildComposePath } from "@/services/socialService";
import { assignLegacySocialToArtistIfNeeded } from "@/services/artistSocial";
import { useToast } from "@/components/ui/use-toast";

export function SocialConnectPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const {
    providers,
    loading,
    connectingId,
    disconnectingId,
    onConnect,
    onDisconnect,
    pendingOAuthRedirect,
    clearPendingOAuthRedirect,
    ig,
    anyConnected,
    artists,
    socialArtistId,
    selectSocialArtist,
    reload,
  } = useSocialHub();

  useEffect(() => {
    const fromUrl = searchParams.get("artist") || "";
    if (fromUrl) selectSocialArtist(fromUrl);
  }, [searchParams, selectSocialArtist]);

  const selectedArtist = artists.find((a) => a.id === socialArtistId);

  const claimLegacyForArtist = async () => {
    if (!socialArtistId) {
      toast({ variant: "destructive", title: "Select an artist first" });
      return;
    }
    const { updated } = await assignLegacySocialToArtistIfNeeded(socialArtistId, { force: true });
    if (updated > 0) {
      toast({ title: `Linked ${updated} account-wide connection(s) to this artist` });
      await reload();
    } else {
      toast({ title: "No account-wide connections to move" });
    }
  };

  return (
    <div className="space-y-5">
      {pendingOAuthRedirect?.url ? (
        <section
          className="rounded-2xl border border-primary/40 bg-primary/10 p-4"
          role="status"
          aria-live="polite"
        >
          <p className="text-sm font-600">Finish connecting {pendingOAuthRedirect.label}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            If the login page did not open automatically, tap Continue. Some mobile browsers (including Brave) block
            redirects to Facebook until you tap a link.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button asChild className="min-h-11 rounded-full">
              <a href={pendingOAuthRedirect.url} rel="noopener noreferrer">
                Continue to {pendingOAuthRedirect.label}
              </a>
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-11 rounded-full"
              onClick={clearPendingOAuthRedirect}
            >
              Dismiss
            </Button>
          </div>
        </section>
      ) : null}
      <section className="rounded-2xl border border-border/60 bg-muted/20 p-4">
        <div className="mb-3 space-y-1.5">
          <Label className="text-xs text-muted-foreground">Connect socials for artist</Label>
          <Select
            value={socialArtistId || "__account__"}
            onValueChange={(v) => selectSocialArtist(v === "__account__" ? "" : v)}
          >
            <SelectTrigger className="max-w-md rounded-xl">
              <SelectValue placeholder="Account-wide (legacy)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__account__">Account-wide (any campaign)</SelectItem>
              {artists.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Each artist can have their own TikTok, Instagram, and YouTube. Campaign scheduling uses the campaign&apos;s artist.
            {selectedArtist ? (
              <span className="mt-1 block font-medium text-foreground/80">
                Connecting for: {selectedArtist.name}
              </span>
            ) : null}
          </p>
          {socialArtistId && artists.length > 1 ? (
            <Button type="button" variant="ghost" size="sm" className="mt-2 h-9 rounded-full px-3 text-xs" onClick={claimLegacyForArtist}>
              Use older account-wide connections for this artist
            </Button>
          ) : null}
        </div>
        <p className="text-sm text-muted-foreground">
          Connect at least one platform below. Schedule from Campaign Plan, or publish now from Compose.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            size="sm"
            className="min-h-10 rounded-full"
            disabled={!anyConnected}
            onClick={() => navigate(buildComposePath())}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Create Social Post
          </Button>
          <Button size="sm" variant="outline" className="min-h-10 rounded-full" onClick={() => navigate("/campaigns")}>
            <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Campaigns
          </Button>
          <Button size="sm" variant="outline" className="min-h-10 rounded-full" onClick={() => navigate("/releases")}>
            <CalendarDays className="mr-1.5 h-3.5 w-3.5" /> Releases
          </Button>
        </div>
        {ig?.status === "connected" && ig?.needsPublishReauth && (
          <p className="mt-3 text-sm text-amber-600">
            Instagram granted:{" "}
            <code className="text-xs">{ig.connection?.scopes || "none"}</code>
            . Publishing needs{" "}
            <code className="text-xs">instagram_business_content_publish</code>. Reconnect and approve Instagram
            publish permission.
          </p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-sm font-600 uppercase tracking-wider text-muted-foreground">
          Connected Accounts
        </h2>
        {loading ? (
          <div className="h-40 animate-shimmer rounded-2xl" />
        ) : (
          <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2">
            {providers.map((provider) => (
              <SocialPlatformCard
                key={provider.id}
                provider={provider}
                onConnect={provider.oauthImplemented ? onConnect : undefined}
                onDisconnect={provider.oauthImplemented ? onDisconnect : undefined}
                connecting={connectingId === provider.id}
                disconnecting={disconnectingId === provider.id}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export function SocialQueuePage() {
  const navigate = useNavigate();
  const { loading, drafts, anyConnected } = useSocialHub();

  return (
    <section className="rounded-2xl border border-border/60 bg-card/50 p-5">
      <div className="mb-3 flex items-center gap-2">
        <Clock className="h-4 w-4 text-primary" />
        <h2 className="font-heading text-sm font-600 uppercase tracking-wider text-muted-foreground">
          Drafts & scheduled
        </h2>
      </div>
      {loading ? (
        <div className="h-24 animate-shimmer rounded-xl" />
      ) : drafts.length === 0 ? (
        <EmptyState
          icon={Send}
          title="No drafts yet"
          description="Create a social post from a campaign day or schedule auto-publish in the campaign plan."
          action={
            <Button
              className="min-h-10 rounded-full"
              disabled={!anyConnected}
              onClick={() => navigate(buildComposePath())}
            >
              Create Social Post
            </Button>
          }
          className="border-0 bg-transparent p-2"
        />
      ) : (
        <ul className="space-y-2">
          {drafts.map((p) => (
            <li
              key={p.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/50 bg-muted/20 px-3 py-2"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={p.status} />
                  <span className="truncate text-sm font-600">{(p.caption || "Untitled").slice(0, 60)}</span>
                </div>
                <p className="text-xs text-muted-foreground capitalize">
                  {p.mediaType || "IMAGE"} · {p.provider || "instagram"}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="rounded-full"
                onClick={() => navigate(`/social/compose?post=${p.id}`)}
              >
                Open
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function SocialActivityPage() {
  const navigate = useNavigate();
  const { loading, recent } = useSocialHub();

  return (
    <section className="rounded-2xl border border-border/60 bg-card/50 p-5">
      <div className="mb-3 flex items-center gap-2">
        <Share2 className="h-4 w-4 text-primary" />
        <h2 className="font-heading text-sm font-600 uppercase tracking-wider text-muted-foreground">
          Recent posts
        </h2>
      </div>
      {loading ? (
        <div className="h-24 animate-shimmer rounded-xl" />
      ) : recent.length === 0 ? (
        <EmptyState
          icon={Share2}
          title="No published posts yet"
          description="Successful and failed publish attempts will appear here."
          className="border-0 bg-transparent p-2"
        />
      ) : (
        <ul className="space-y-2">
          {recent.map((p) => (
            <li
              key={p.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/50 bg-muted/20 px-3 py-2"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={p.status} />
                  <span className="truncate text-sm font-600">{(p.caption || "Untitled").slice(0, 60)}</span>
                </div>
                <p className="text-xs capitalize text-muted-foreground">{p.provider || "instagram"}</p>
                {p.status === "failed" && (
                  <p className="text-xs text-destructive">{p.errorMessage || "Publishing failed"}</p>
                )}
                {p.status === "published" && p.externalPostId && (
                  <p className="text-xs text-muted-foreground">ID: {p.externalPostId}</p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {p.externalPermalink && (
                  <Button size="sm" variant="outline" className="rounded-full" asChild>
                    <a href={p.externalPermalink} target="_blank" rel="noreferrer">
                      <ExternalLink className="mr-1 h-3.5 w-3.5" /> View
                    </a>
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-full"
                  onClick={() => navigate(`/social/compose?post=${p.id}`)}
                >
                  Open
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
