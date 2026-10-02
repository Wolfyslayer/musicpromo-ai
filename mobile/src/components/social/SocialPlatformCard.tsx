import { Image } from 'expo-image';
import { Camera, Music2, Play, Users } from 'lucide-react-native';
import { View } from 'react-native';

import StatusBadge from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { toast } from '@/components/ui/use-toast';
import { CONNECTION_STATUS } from '@/services/socialService';

const ICONS: Record<string, any> = { Instagram: Camera, Music2, Youtube: Play, Facebook: Users };

const SECRET_HINTS: Record<string, string> = {
  instagram: 'Add META_CLIENT_ID and META_CLIENT_SECRET in Base44 secrets.',
  tiktok: 'Add TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET in Base44 secrets.',
  youtube: 'Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Base44 secrets.',
  facebook: 'Facebook Page connect is not available yet.',
};

export default function SocialPlatformCard({
  provider,
  onConnect,
  onDisconnect,
  connecting = false,
  disconnecting = false,
}: {
  provider: any;
  onConnect?: (id: string) => Promise<void> | void;
  onDisconnect?: (provider: any) => Promise<void> | void;
  connecting?: boolean;
  disconnecting?: boolean;
}) {
  const PlatformIcon = ICONS[provider.icon] || Music2;
  const connected = provider.status === CONNECTION_STATUS.CONNECTED && provider.connection;
  const oauthReady = provider.oauthImplemented === true;
  const unavailable = !connected && !oauthReady;

  const handleConnect = async () => {
    if (unavailable || connecting) return;
    if (!onConnect) {
      toast({
        title: `${provider.name} coming soon`,
        description: 'Social account connections will be available after platform OAuth is configured.',
      });
      return;
    }
    await onConnect(provider.id);
  };

  const handleDisconnect = async () => {
    if (!onDisconnect || disconnecting) return;
    await onDisconnect(provider);
  };

  return (
    <View className="rounded-2xl border border-border/60 bg-card/50 p-4">
      <View className="flex-row items-start gap-3">
        {connected && provider.connection?.profileImageUrl ? (
          <Image source={{ uri: provider.connection.profileImageUrl }} style={{ width: 44, height: 44, borderRadius: 12 }} contentFit="cover" />
        ) : (
          <View className="size-11 items-center justify-center rounded-xl" style={{ backgroundColor: `${provider.color}22` }}>
            <Icon as={PlatformIcon} size={20} color={provider.color} />
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
                <Text className="text-sm font-semibold" numberOfLines={1}>
                  @{provider.connection.username}
                </Text>
              ) : null}
              {provider.connection.accountName ? (
                <Text className="text-sm text-muted-foreground" numberOfLines={1}>
                  {provider.connection.accountName}
                </Text>
              ) : null}
              {provider.needsPublishReauth ? <Text className="text-xs text-amber-600">Reconnect to enable publishing permissions.</Text> : null}
              {provider.canPublish ? <Text className="text-xs text-muted-foreground">Publishing enabled</Text> : null}
            </View>
          ) : (
            <>
              <Text className="mt-1 text-sm text-muted-foreground">{provider.description}</Text>
              <Text className="mt-2 text-xs text-muted-foreground">
                {!oauthReady
                  ? SECRET_HINTS[provider.id] || 'Coming later.'
                  : provider.configured === false
                    ? SECRET_HINTS[provider.id] || 'OAuth secrets are not configured yet.'
                    : provider.configured === true
                      ? 'Ready to connect'
                      : 'Not connected'}
              </Text>
            </>
          )}
        </View>
      </View>

      <View className="mt-4 flex-row flex-wrap items-center gap-2">
        {connected ? (
          <>
            {provider.needsPublishReauth && onConnect ? (
              <Button className="rounded-full" loading={connecting} onPress={handleConnect} accessibilityLabel={`Reconnect ${provider.name} for publishing`}>
                Reconnect
              </Button>
            ) : null}
            <Button
              variant="outline"
              className="rounded-full"
              loading={disconnecting}
              disabled={!onDisconnect}
              onPress={handleDisconnect}
              accessibilityLabel={`Disconnect ${provider.name}`}>
              Disconnect
            </Button>
          </>
        ) : (
          <>
            <Button
              className="flex-1 rounded-full"
              loading={connecting}
              disabled={unavailable || !oauthReady}
              onPress={handleConnect}
              accessibilityLabel={`Connect ${provider.name}`}>
              Connect
            </Button>
            {!oauthReady ? <Text className="text-xs text-muted-foreground">Coming later</Text> : null}
          </>
        )}
      </View>
    </View>
  );
}
