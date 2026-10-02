import { LinearGradient } from 'expo-linear-gradient';
import { Sparkles } from 'lucide-react-native';
import { View } from 'react-native';

import { Text } from '@/components/ui/text';

export default function Logo({ size = 28, withWord = true }: { size?: number; withWord?: boolean }) {
  return (
    <View className="flex-row items-center gap-2.5">
      <LinearGradient
        colors={['#a164f7', '#f04ca9']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ width: size, height: size, borderRadius: size * 0.3, alignItems: 'center', justifyContent: 'center' }}>
        <Sparkles size={size * 0.5} color="#fff" strokeWidth={2.5} />
      </LinearGradient>
      {withWord ? (
        <Text className="font-heading-bold text-lg leading-none tracking-tight">
          MusicPromo<Text className="font-heading-bold text-lg text-primary"> AI</Text>
        </Text>
      ) : null}
    </View>
  );
}
