import { usePathname, useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';

type Props = {
  title: string;
  description?: string;
};

export function PlaceholderScreen({ title, description }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  return (
    <View className="flex-1 items-center justify-center gap-4 bg-background px-6">
      <Text className="text-center text-2xl font-bold text-foreground">{title}</Text>
      <Text className="text-center text-muted-foreground">
        {description ??
          'This screen is routed in Expo Router but not fully ported from the web app yet. See docs/MOBILE_MIGRATION.md.'}
      </Text>
      <Text className="text-xs text-muted-foreground">{pathname}</Text>
      <Button label="Back to Dashboard" variant="outline" onPress={() => router.replace('/')} />
    </View>
  );
}
