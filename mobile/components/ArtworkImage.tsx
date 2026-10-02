import { Image } from 'expo-image';
import { ImageIcon } from 'lucide-react-native';
import { View } from 'react-native';
import { cn } from '@/lib/utils';

export function ArtworkImage({
  src,
  alt = 'Artwork',
  className,
  rounded = 'rounded-2xl',
}: {
  src?: string | null;
  alt?: string;
  className?: string;
  rounded?: string;
}) {
  if (!src) {
    return (
      <View className={cn('items-center justify-center bg-muted', rounded, className)}>
        <ImageIcon color="#94a3b8" size={32} />
      </View>
    );
  }
  return (
    <Image
      source={{ uri: src }}
      accessibilityLabel={alt}
      className={cn(rounded, className)}
      contentFit="cover"
    />
  );
}
