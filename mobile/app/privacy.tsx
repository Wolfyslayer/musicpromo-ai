import { ScrollView, Text } from 'react-native';
import { PlaceholderScreen } from '@/components/PlaceholderScreen';

export default function PrivacyScreen() {
  return (
    <ScrollView className="flex-1 bg-background">
      <PlaceholderScreen
        title="Privacy Policy"
        description="Port the LegalPage content from src/pages/PrivacyPolicy.jsx once you approve the mobile legal copy pass."
      />
    </ScrollView>
  );
}
