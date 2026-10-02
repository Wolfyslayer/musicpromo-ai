import { useLocalSearchParams } from 'expo-router';
import { PlaceholderScreen } from '@/components/PlaceholderScreen';

export default function CampaignContentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <PlaceholderScreen title="Campaign Content" description={`Campaign ${id} content workspace`} />;
}
