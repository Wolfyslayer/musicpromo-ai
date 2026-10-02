import { Image } from 'expo-image';
import { Image as ImageIcon } from 'lucide-react-native';
import { View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';

/** Album artwork with a graceful placeholder. Pass the size via className, e.g. `size-20`. */
export default function ArtworkImage({ src, className, rounded = 'rounded-2xl' }: { src?: string | null; alt?: string; className?: string; rounded?: string }) {
  if (!src) {
    return (
      <View className={cn('items-center justify-center bg-muted', rounded, className)}>
        <Icon as={ImageIcon} size={32} className="text-muted-foreground/50" />
      </View>
    );
  }
  return (
    <View className={cn('overflow-hidden bg-muted', rounded, className)}>
      <Image source={{ uri: src }} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={150} />
    </View>
  );
}
