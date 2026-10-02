import { useLocalSearchParams } from 'expo-router';
import { PlaceholderScreen } from '@/components/PlaceholderScreen';

export default function ReleaseEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <PlaceholderScreen title="Edit Release" description={`Release ${id}`} />;
}
