import { useRouter } from "expo-router";
import { View } from "react-native";
import { Button, Card, H1, Muted, P, Screen } from "@/components/ui";

export default function Studio() {
  const router = useRouter();
  return (
    <Screen>
      <View className="gap-4">
        <H1>Studio</H1>
        <Muted>The web studio renders 9:16 promo videos with Remotion. That renderer uses browser canvas and WebCodecs, so it is not part of this mobile build.</Muted>
        <Card className="gap-3">
          <P className="font-semibold">What you can do here</P>
          <Muted>Create campaigns, upload artwork and audio, review the day plan, and open videos that were already rendered on the web.</Muted>
          <Button label="New campaign" onPress={() => router.push("/create")} />
          <Button label="Browse campaigns" variant="outline" onPress={() => router.push("/campaigns")} />
        </Card>
      </View>
    </Screen>
  );
}
