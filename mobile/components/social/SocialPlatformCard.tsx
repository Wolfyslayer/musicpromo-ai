import { Facebook, Instagram, Loader2, Music2, Youtube } from 'lucide-react-native';
import { Image, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/StatusBadge';
import { useToast } from '@/lib/toast';
import { CONNECTION_STATUS } from '@/services/socialService';

const ICONS: Record<string, typeof Music2> = {
  Instagram,
  Music2,
  Youtube,
  Facebook,
};

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
  provider: {
    id: string;
    name: string;
    icon?: string;
    color?: string;
    description?: string;
    status?: string;
    oauthImplemented?: boolean;
    configured?: boolean;
    connection?: {
      id?: string;
      username?: string;
      accountName?: string;
      profileImageUrl?: string;
    };
    needsPublishReauth?: boolean;
    canPublish?: boolean;
  };
  onConnect?: (id: string) => void | Promise<void>;
  onDisconnect?: (provider: unknown) => void | Promise<void>;
  connecting?: boolean;
  disconnecting?: boolean;
}) {
  const { toast } = useToast();
  const Icon = ICONS[provider.icon || ''] || Music2;
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

  return (
    <View className="rounded-2xl border border-border bg-card/50 p-4">
      <View className="flex-row items-start gap-3">
        {connected && provider.connection?.profileImageUrl ? (
          <Image source={{ uri: provider.connection.profileImageUrl }} className="h-11 w-11 rounded-xl" />
        ) : (
          <View
            className="h-11 w-11 items-center justify-center rounded-xl"
            style={{ backgroundColor: `${provider.color || '#888'}22` }}
          >
            <Icon color={provider.color || '#888'} size={20} />
          </View>
        )}
        <View className="min-w-0 flex-1">
          <View className="flex-row flex-wrap items-center gap-2">
            <Text className="text-base font-semibold text-foreground">{provider.name}</Text>
            <StatusBadge status={provider.status || CONNECTION_STATUS.UNAVAILABLE} />
          </View>
          {connected ? (
            <View className="mt-1 gap-0.5">
              {provider.connection?.username ? (
                <Text className="text-sm font-semibold text-foreground">@{provider.connection.username}</Text>
              ) : null}
              {provider.connection?.accountName ? (
                <Text className="text-sm text-muted-foreground">{provider.connection.accountName}</Text>
              ) : null}
              {provider.needsPublishReauth ? (
                <Text className="text-xs text-amber-600">Reconnect to enable publishing permissions.</Text>
              ) : null}
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
      <View className="mt-4 flex-row flex-wrap gap-2">
        {connected ? (
          <>
            {provider.needsPublishReauth && onConnect ? (
              <Button disabled={connecting} onPress={handleConnect}>
                {connecting ? <Loader2 color="#fff" size={14} /> : null}
                <Text className="ml-1 text-sm font-semibold text-white">Reconnect</Text>
              </Button>
            ) : null}
            <Button variant="outline" disabled={disconnecting || !onDisconnect} onPress={() => onDisconnect?.(provider)}>
              {disconnecting ? <Loader2 color="#64748b" size={14} /> : null}
              <Text className="ml-1 text-sm font-semibold text-foreground">Disconnect</Text>
            </Button>
          </>
        ) : (
          <Button disabled={unavailable || connecting || !oauthReady} onPress={handleConnect}>
            {connecting ? <Loader2 color="#fff" size={14} /> : null}
            <Text className="ml-1 text-sm font-semibold text-white">Connect</Text>
          </Button>
        )}
      </View>
    </View>
  );
}
