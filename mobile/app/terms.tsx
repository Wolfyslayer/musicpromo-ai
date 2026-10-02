import { ScrollView } from 'react-native';
import { PlaceholderScreen } from '@/components/PlaceholderScreen';

export default function TermsScreen() {
  return (
    <ScrollView className="flex-1 bg-background">
      <PlaceholderScreen
        title="Terms of Service"
        description="Port the LegalPage content from src/pages/TermsOfService.jsx once you approve the mobile legal copy pass."
      />
    </ScrollView>
  );
}
