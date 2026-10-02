import { Instagram, Music2, Youtube, Facebook, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import StatusBadge from "@/components/StatusBadge";
import { CONNECTION_STATUS } from "@/services/socialService";

function XBrandIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

const ICONS = {
  Instagram,
  Music2,
  Youtube,
  Facebook,
  XBrand: XBrandIcon,
};

const SECRET_HINTS = {
  instagram: "Add META_CLIENT_ID and META_CLIENT_SECRET in Base44 secrets.",
  tiktok: "Add TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET in Base44 secrets.",
  youtube: "Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Base44 secrets.",
  facebook: "Add FACEBOOK_CLIENT_ID and FACEBOOK_CLIENT_SECRET (separate Meta app from Instagram).",
  x: "Add X_CLIENT_ID and X_CLIENT_SECRET from the X developer portal (OAuth 2.0).",
};

/**
 * Platform card for the Social Hub (Instagram / TikTok / YouTube OAuth).
 */
export default function SocialPlatformCard({
  provider,
  onConnect,
  onDisconnect,
  connecting = false,
  disconnecting = false,
}) {
  const { toast } = useToast();
  const Icon = ICONS[provider.icon] || Music2;
  const connected = provider.status === CONNECTION_STATUS.CONNECTED && provider.connection;
  const profileImageUrl =
    provider.connection?.profileImageUrl || provider.connection?.profile_image_url || "";
  const username = provider.connection?.username || "";
  const accountName =
    provider.connection?.accountName || provider.connection?.account_name || "";
  const oauthReady = provider.oauthImplemented === true;
  const unavailable = !connected && !oauthReady;

  const handleConnect = async () => {
    if (unavailable || connecting) return;
    if (!onConnect) {
      if (!oauthReady) {
        toast({
          title: `${provider.name} coming soon`,
          description: SECRET_HINTS[provider.id] || "This platform is not available yet.",
        });
      }
      return;
    }
    await onConnect(provider.id);
  };

  const handleDisconnect = async () => {
    if (!onDisconnect || disconnecting) return;
    await onDisconnect(provider);
  };

  return (
    <div className="surface rounded-2xl p-4">
      <div className="flex items-start gap-3">
        {connected && profileImageUrl ? (
          <img
            src={profileImageUrl}
            alt=""
            referrerPolicy="no-referrer"
            className="h-11 w-11 shrink-0 rounded-xl object-cover"
          />
        ) : (
          <div
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl"
            style={{ background: `${provider.color}22`, color: provider.color }}
            aria-hidden
          >
            <Icon className="h-5 w-5" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-heading text-base font-600">{provider.name}</h3>
            <StatusBadge status={provider.status || CONNECTION_STATUS.UNAVAILABLE} />
          </div>
          {connected ? (
            <div className="mt-1 space-y-0.5">
              {username && (
                <p className="truncate text-sm font-600">
                  {username.startsWith("@") ? username : `@${username}`}
                </p>
              )}
              {accountName && (
                <p className="truncate text-sm text-muted-foreground">{accountName}</p>
              )}
              {connected && !profileImageUrl && !username && !accountName && (
                <p className="text-sm text-muted-foreground">Connected</p>
              )}
              {provider.needsPublishReauth && (
                <p className="text-xs text-amber-600">Reconnect to enable publishing permissions.</p>
              )}
              {provider.canPublish && (
                <p className="text-xs text-muted-foreground">Publishing enabled</p>
              )}
            </div>
          ) : (
            <>
              <p className="mt-1 text-sm text-muted-foreground">{provider.description}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                {!oauthReady
                  ? SECRET_HINTS[provider.id] || "Coming later."
                  : provider.configured === false
                    ? SECRET_HINTS[provider.id] ||
                      "OAuth secrets are not configured yet."
                    : provider.configured === true
                      ? "Ready to connect"
                      : "Not connected"}
              </p>
            </>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {connected ? (
          <>
            {provider.needsPublishReauth && onConnect && (
              <Button
                className="min-h-10 rounded-full"
                disabled={connecting}
                onClick={handleConnect}
                aria-label={`Reconnect ${provider.name} for publishing`}
              >
                {connecting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                Reconnect
              </Button>
            )}
            <Button
              variant="outline"
              className="min-h-10 rounded-full"
              disabled={disconnecting || !onDisconnect}
              onClick={handleDisconnect}
              aria-label={`Disconnect ${provider.name}`}
            >
              {disconnecting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
              Disconnect
            </Button>
          </>
        ) : (
          <>
            <Button
              className="min-h-11 w-full rounded-full sm:w-auto"
              disabled={unavailable || connecting || !oauthReady}
              onClick={handleConnect}
              aria-label={`Connect ${provider.name}`}
            >
              {connecting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
              Connect
            </Button>
            {!oauthReady && (
              <span className="text-xs text-muted-foreground">Coming later</span>
            )}
          </>
        )}
      </div>
    </div>
  );
}
