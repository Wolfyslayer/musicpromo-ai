import { View } from "react-native";
import { router, Stack, usePathname } from "expo-router";
import { House } from "lucide-react-native";
import { useAuth } from "@/lib/AuthContext";
import { Screen } from "@/components/Screen";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";

export default function NotFound() {
  const pathname = usePathname();
  const pageName = (pathname || "").substring(1);
  const { user, isAuthenticated } = useAuth();

  return (
    <Screen contentClassName="grow justify-center py-12">
      <Stack.Screen options={{ title: "Not found" }} />
      <View className="w-full max-w-md items-center gap-6 self-center">
        <View className="items-center gap-2">
          <Text className="text-7xl font-500 text-muted-foreground/50">404</Text>
          <View className="h-0.5 w-16 bg-border" />
        </View>

        <View className="items-center gap-3">
          <Text className="text-center text-2xl font-500">Page Not Found</Text>
          <Text className="text-center leading-relaxed text-muted-foreground">
            The page <Text className="font-500 text-foreground">&quot;{pageName}&quot;</Text> could not be found in this
            application.
          </Text>
        </View>

        {isAuthenticated && user?.role === "admin" ? (
          <View className="mt-2 w-full flex-row items-start gap-3 rounded-lg border border-border bg-muted/40 p-4">
            <View className="mt-0.5 h-5 w-5 items-center justify-center rounded-full bg-orange-100">
              <View className="h-2 w-2 rounded-full bg-orange-400" />
            </View>
            <View className="flex-1 gap-1">
              <Text className="text-sm font-500">Admin Note</Text>
              <Text className="text-sm leading-relaxed text-muted-foreground">
                This could mean that the AI hasn&apos;t implemented this page yet. Ask it to implement it in the chat.
              </Text>
            </View>
          </View>
        ) : null}

        <View className="pt-4">
          <Button variant="outline" icon={House} onPress={() => router.replace("/")}>
            Go Home
          </Button>
        </View>
      </View>
    </Screen>
  );
}
