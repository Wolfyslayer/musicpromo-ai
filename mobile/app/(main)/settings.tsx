import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/lib/AuthContext';

export default function SettingsScreen() {
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuth();

  return (
    <View className="flex-1 gap-4 bg-background p-4">
      <Text className="text-2xl font-bold text-foreground">Settings</Text>
      {isAuthenticated ? (
        <>
          <Text className="text-foreground">{user?.full_name || user?.email}</Text>
          <Text className="text-muted-foreground">{user?.email}</Text>
          <Button
            variant="outline"
            label="Sign out"
            onPress={async () => {
              await logout();
              router.replace('/');
            }}
          />
        </>
      ) : (
        <Button label="Sign in" onPress={() => router.push('/login')} />
      )}
      <Text className="text-sm text-muted-foreground">
        Theme and connector settings from the web Settings page will be ported in a later pass.
      </Text>
    </View>
  );
}
