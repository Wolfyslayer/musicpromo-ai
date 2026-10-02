import { Text, View } from 'react-native';
import { ArtworkImage } from '@/components/ArtworkImage';

export default function VideoPreview({
  project,
}: {
  project?: { artwork_url?: string; render_output_url?: string; title?: string };
  playing?: boolean;
}) {
  const src = project?.render_output_url || project?.artwork_url;
  return (
    <View className="overflow-hidden rounded-xl border border-border bg-muted/30">
      <ArtworkImage src={src} className="aspect-[9/16] w-full" rounded="rounded-xl" />
      {project?.title ? (
        <Text className="p-2 text-center text-xs text-muted-foreground" numberOfLines={1}>
          {project.title}
        </Text>
      ) : null}
    </View>
  );
}
