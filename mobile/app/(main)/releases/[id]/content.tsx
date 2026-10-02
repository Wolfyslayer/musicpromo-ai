import { useLocalSearchParams } from 'expo-router';
import { PlaceholderScreen } from '@/components/PlaceholderScreen';

export default function ReleaseContentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <PlaceholderScreen title="Release Content" description={`Release ${id}`} />;
}
