import { useLocalSearchParams } from 'expo-router';
import { PlaceholderScreen } from '@/components/PlaceholderScreen';

export default function CampaignVideoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <PlaceholderScreen title="Campaign Video" description={`Campaign ${id} video generator (web Remotion)`} />;
}
