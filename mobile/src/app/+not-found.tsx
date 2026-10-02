import { Link, Stack } from 'expo-router';
import { SearchX } from 'lucide-react-native';
import { View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';

export default function NotFound() {
  return (
    <>
      <Stack.Screen options={{ title: 'Not found' }} />
      <View className="flex-1 items-center justify-center gap-3 bg-background px-8">
        <Icon as={SearchX} size={40} className="text-muted-foreground" />
        <Text className="font-heading text-xl">Page not found</Text>
        <Text className="text-center text-sm text-muted-foreground">The page you are looking for doesn&apos;t exist.</Text>
        <Link href="/" className="mt-2 text-base font-semibold text-primary">
          Go home
        </Link>
      </View>
    </>
  );
}
