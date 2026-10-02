import { useLocalSearchParams } from 'expo-router';
import { PlaceholderScreen } from '@/components/PlaceholderScreen';

export default function ReleaseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <PlaceholderScreen title="Release Detail" description={`Release ${id}`} />;
}
