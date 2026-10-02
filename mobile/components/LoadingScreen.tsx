import { ActivityIndicator, View } from 'react-native';

export function LoadingScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-background">
      <ActivityIndicator size="large" color="hsl(265, 90%, 68%)" />
    </View>
  );
}
