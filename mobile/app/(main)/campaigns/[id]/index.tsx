import { useLocalSearchParams } from 'expo-router';
import { PlaceholderScreen } from '@/components/PlaceholderScreen';

export default function CampaignDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <PlaceholderScreen title="Campaign Detail" description={`Campaign ${id} — port CampaignDetail.jsx`} />;
}
