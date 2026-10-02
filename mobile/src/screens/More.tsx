import { useRouter } from 'expo-router';
import { ChevronRight, Disc3, FileText, ListMusic, LogIn, LogOut, Plus, Settings, Shield, Users } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { toast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';

const ITEMS = [
  { href: '/campaigns', label: 'Campaigns', icon: ListMusic },
  { href: '/create', label: 'New Campaign', icon: Plus },
  { href: '/artists', label: 'Artists', icon: Users },
  { href: '/releases', label: 'Releases', icon: Disc3 },
  { href: '/settings', label: 'Settings', icon: Settings },
] as const;

const LEGAL = [
  { href: '/privacy', label: 'Privacy Policy', icon: Shield },
  { href: '/terms', label: 'Terms of Service', icon: FileText },
] as const;

function Row({ label, icon, onPress, last }: { label: string; icon: any; onPress: () => void; last?: boolean }) {
  return (
    <Pressable onPress={onPress} className={`min-h-14 flex-row items-center gap-3 px-4 active:bg-muted/50 ${last ? '' : 'border-b border-border/50'}`}>
      <Icon as={icon} size={20} className="text-primary" />
      <Text className="flex-1 text-base font-medium">{label}</Text>
      <Icon as={ChevronRight} size={18} className="text-muted-foreground" />
    </Pressable>
  );
}

export default function More() {
  const router = useRouter();
  const { user, isAuthenticated, logout, requireAuth } = useAuth();

  return (
    <Screen tabScreen>
      <Card className="p-4">
        <Text className="font-semibold">{isAuthenticated ? user?.full_name || user?.email || 'Artist' : 'Guest preview'}</Text>
        <Text className="text-sm text-muted-foreground">{isAuthenticated ? user?.email : 'Sign in to save your work'}</Text>
      </Card>

      <Card className="overflow-hidden">
        {ITEMS.map((item, i) => (
          <Row key={item.href} label={item.label} icon={item.icon} last={i === ITEMS.length - 1} onPress={() => router.push(item.href)} />
        ))}
      </Card>

      <Card className="overflow-hidden">
        {LEGAL.map((item, i) => (
          <Row key={item.href} label={item.label} icon={item.icon} last={i === LEGAL.length - 1} onPress={() => router.push(item.href)} />
        ))}
      </Card>

      <View>
        {isAuthenticated ? (
          <Card className="overflow-hidden">
            <Row
              label="Sign out"
              icon={LogOut}
              last
              onPress={async () => {
                await logout();
                toast({ title: 'Signed out' });
              }}
            />
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <Row label="Sign in" icon={LogIn} last onPress={() => requireAuth()} />
          </Card>
        )}
      </View>
    </Screen>
  );
}
