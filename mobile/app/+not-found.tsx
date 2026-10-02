import { Link } from "expo-router";
import { Text, View } from "react-native";

export default function NotFound() {
  return (
    <View className="flex-1 items-center justify-center gap-3 bg-background px-6">
      <Text className="font-heading text-2xl text-foreground">Page not found</Text>
      <Link href="/" className="font-sans text-base text-primary">
        Back to dashboard
      </Link>
    </View>
  );
}
