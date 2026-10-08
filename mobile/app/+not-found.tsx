import { Link, Stack } from "expo-router";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { useAppTheme } from "@/theme/ThemeProvider";

export default function NotFoundScreen() {
  const { colors } = useAppTheme();
  return (
    <>
      <Stack.Screen options={{ title: "Not found" }} />
      <Screen>
        <Text variant="display">Screen not found</Text>
        <Text muted>That route isn’t in the native app yet — try Home.</Text>
        <Link href="/" asChild>
          <Text color={colors.primary} variant="bodyStrong">
            Go home
          </Text>
        </Link>
      </Screen>
    </>
  );
}
