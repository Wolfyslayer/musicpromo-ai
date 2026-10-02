import { View } from "react-native";
import { Image } from "expo-image";
import { AtSign, Camera, Music2, PlayCircle, ThumbsUp } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { toast } from "@/components/ui/toast";
import StatusBadge from "@/components/StatusBadge";
import { CONNECTION_STATUS } from "@/services/socialService";

// lucide-react-native v1 dropped the brand icons, so each provider gets a generic glyph in its brand color.
const ICONS = {
  Instagram: Camera,
  Music2,
  Youtube: PlayCircle,
  Facebook: ThumbsUp,
  Twitter: AtSign,
  X: AtSign,
};

const SECRET_HINTS = {
  instagram: "Add META_CLIENT_ID and META_CLIENT_SECRET in Base44 secrets.",
  tiktok: "Add TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET in Base44 secrets.",
  youtube: "Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Base44 secrets.",
  facebook: "Facebook Page connect is not available yet.",
};

/**
 * Platform card for the Social Hub (Instagram / TikTok / YouTube OAuth).
 */
export default function SocialPlatformCard({ provider, onConnect, onDisconnect, connecting = false, disconnecting = false }) {
  const ProviderIcon = ICONS[provider.icon] || Music2;
  const connected = provider.status === CONNECTION_STATUS.CONNECTED && provider.connection;
  const oauthReady = provider.oauthImplemented === true;
  const unavailable = !connected && !oauthReady;

  const handleConnect = async () => {
    if (unavailable || connecting) return;
    if (!onConnect) {
      toast({
        title: `${provider.name} coming soon`,
        description: "Social account connections will be available after platform OAuth is configured.",
      });
      return;
    }
    await onConnect(provider.id);
  };

  const handleDisconnect = async () => {
    if (!onDisconnect || disconnecting) return;
    await onDisconnect(provider);
  };

  const hint = !oauthReady
    ? SECRET_HINTS[provider.id] || "Coming later."
    : provider.configured === false
      ? SECRET_HINTS[provider.id] || "OAuth secrets are not configured yet."
      : provider.configured === true
        ? "Ready to connect"
        : "Not connected";

  return (
    <View className="rounded-2xl border border-border/60 bg-card p-4">
      <View className="flex-row items-start gap-3">
        {connected && provider.connection?.profileImageUrl ? (
          <View className="h-11 w-11 overflow-hidden rounded-xl">
            <Image
              source={{ uri: provider.connection.profileImageUrl }}
              contentFit="cover"
              style={{ width: "100%", height: "100%" }}
            />
          </View>
        ) : (
          <View
            className="h-11 w-11 items-center justify-center rounded-xl"
            style={{ backgroundColor: `${provider.color}22` }}
          >
            <ProviderIcon size={20} color={provider.color} strokeWidth={2} />
          </View>
        )}
        <View className="min-w-0 flex-1">
          <View className="flex-row flex-wrap items-center gap-2">
            <Text className="font-heading text-base">{provider.name}</Text>
            <StatusBadge status={provider.status || CONNECTION_STATUS.UNAVAILABLE} />
          </View>
          {connected ? (
            <View className="mt-1 gap-0.5">
              {provider.connection.username ? (
                <Text className="text-sm font-600" numberOfLines={1}>
                  @{provider.connection.username}
                </Text>
              ) : null}
              {provider.connection.accountName ? (
                <Text className="text-sm text-muted-foreground" numberOfLines={1}>
                  {provider.connection.accountName}
                </Text>
              ) : null}
              {provider.needsPublishReauth ? (
                <Text className="text-xs text-amber-600">Reconnect to enable publishing permissions.</Text>
              ) : null}
              {provider.canPublish ? <Text className="text-xs text-muted-foreground">Publishing enabled</Text> : null}
            </View>
          ) : (
            <>
              <Text className="mt-1 text-sm text-muted-foreground">{provider.description}</Text>
              <Text className="mt-2 text-xs text-muted-foreground">{hint}</Text>
            </>
          )}
        </View>
      </View>

      <View className="mt-4 flex-row flex-wrap items-center gap-2">
        {connected ? (
          <>
            {provider.needsPublishReauth && onConnect ? (
              <Button
                className="rounded-full"
                loading={connecting}
                onPress={handleConnect}
                accessibilityLabel={`Reconnect ${provider.name} for publishing`}
              >
                Reconnect
              </Button>
            ) : null}
            <Button
              variant="outline"
              className="rounded-full"
              loading={disconnecting}
              disabled={!onDisconnect}
              onPress={handleDisconnect}
              accessibilityLabel={`Disconnect ${provider.name}`}
            >
              Disconnect
            </Button>
          </>
        ) : (
          <>
            <Button
              className="w-full rounded-full"
              loading={connecting}
              disabled={unavailable || !oauthReady}
              onPress={handleConnect}
              accessibilityLabel={`Connect ${provider.name}`}
            >
              Connect
            </Button>
            {!oauthReady ? <Text className="text-xs text-muted-foreground">Coming later</Text> : null}
          </>
        )}
      </View>
    </View>
  );
}
