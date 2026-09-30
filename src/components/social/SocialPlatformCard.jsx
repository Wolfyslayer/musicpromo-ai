import { Instagram, Music2, Youtube, Facebook, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import StatusBadge from "@/components/StatusBadge";
import { CONNECTION_STATUS } from "@/services/socialService";

const ICONS = {
  Instagram,
  Music2,
  Youtube,
  Facebook,
};

/**
 * Platform card for the Social Hub.
 * Instagram may run real OAuth; other providers stay unavailable.
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
  const unavailable =
    !connected &&
    (provider.status === CONNECTION_STATUS.UNAVAILABLE || provider.available === false);

  const handleConnect = async () => {
    if (unavailable || connecting) return;
    if (!onConnect) {
      toast({
        title: `${provider.name} coming soon`,
        description: "Social account connections will be available after platform OAuth is configured.",
      });
      return;
    }
    await onConnect(provider);
  };

  const handleDisconnect = async () => {
    if (!onDisconnect || disconnecting) return;
    await onDisconnect(provider);
  };

  return (
    <div className="rounded-2xl border border-border/60 bg-card/50 p-4">
      <div className="flex items-start gap-3">
        {connected && provider.connection?.profileImageUrl ? (
          <img
            src={provider.connection.profileImageUrl}
            alt=""
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
              {provider.connection.username && (
                <p className="truncate text-sm font-600">@{provider.connection.username}</p>
              )}
              {provider.connection.accountName && (
                <p className="truncate text-sm text-muted-foreground">{provider.connection.accountName}</p>
              )}
              {provider.needsPublishReauth && (
                <p className="text-xs text-amber-600">Reconnect to enable Instagram publishing.</p>
              )}
              {provider.canPublish && (
                <p className="text-xs text-muted-foreground">Publishing enabled</p>
              )}
            </div>
          ) : (
            <>
              <p className="mt-1 text-sm text-muted-foreground">{provider.description}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                {unavailable
                  ? provider.id === "instagram"
                    ? "Instagram OAuth is not configured yet. Add Meta secrets in Base44."
                    : "Social account connections will be available after platform integration is configured."
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
              disabled={disconnecting}
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
              className="min-h-10 rounded-full"
              disabled={unavailable || connecting}
              onClick={handleConnect}
              aria-label={`Connect ${provider.name}`}
            >
              {connecting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
              Connect
            </Button>
            {unavailable && provider.id !== "instagram" && (
              <span className="text-xs text-muted-foreground">Coming in a later phase</span>
            )}
          </>
        )}
      </div>
    </div>
  );
}
