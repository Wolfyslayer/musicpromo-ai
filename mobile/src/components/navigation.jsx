import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { LogIn, LogOut } from "lucide-react-native";
import { useAuth } from "@/lib/AuthContext";
import { Icon } from "@/components/ui/icon";
import { toast } from "@/components/ui/toast";

export function stackScreenOptions(colors) {
  return {
    headerStyle: { backgroundColor: colors.background },
    headerTintColor: colors.foreground,
    headerTitleStyle: { fontFamily: "SpaceGrotesk_700Bold", fontSize: 17 },
    headerShadowVisible: false,
    headerBackButtonDisplayMode: "minimal",
    contentStyle: { backgroundColor: colors.background },
  };
}

/** Right side of the tab header: sign in / sign out, mirroring the web mobile header. */
export function HeaderAuthButton() {
  const { isAuthenticated, logout, requireAuth } = useAuth();
  return (
    <View className="flex-row items-center pr-2">
      {isAuthenticated ? (
        <Pressable
          onPress={async () => {
            await logout();
            toast({ title: "Signed out" });
            router.replace("/");
          }}
          className="h-11 w-11 items-center justify-center"
          accessibilityLabel="Sign out"
        >
          <Icon as={LogOut} size={20} className="text-muted-foreground" />
        </Pressable>
      ) : (
        <Pressable onPress={() => requireAuth()} className="h-11 w-11 items-center justify-center" accessibilityLabel="Sign in">
          <Icon as={LogIn} size={20} className="text-primary" />
        </Pressable>
      )}
    </View>
  );
}
