import { Link, useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { useAuth } from "@/components/AuthProvider";
import { Button, Card, Muted, P, Screen } from "@/components/ui";

const LINKS = [
  { href: "/campaigns" as const, label: "Campaigns", detail: "Plans, duplicates, and archives" },
  { href: "/create" as const, label: "New campaign", detail: "Song, artwork, goals" },
  { href: "/artists" as const, label: "Artists", detail: "Profiles and links" },
  { href: "/releases" as const, label: "Releases", detail: "Singles, EPs, and calendars" },
  { href: "/settings" as const, label: "Settings", detail: "Defaults and notifications" },
  { href: "/privacy" as const, label: "Privacy Policy", detail: "Public legal page" },
  { href: "/terms" as const, label: "Terms of Service", detail: "Public legal page" },
];

export default function More() {
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuth();
  return (
    <Screen>
      <View className="gap-4">
        <Card className="gap-1">
          <P className="font-semibold">{isAuthenticated ? user?.full_name || user?.email : "Guest preview"}</P>
          <Muted>{isAuthenticated ? user?.email : "Sign in to save artists, releases, and campaigns."}</Muted>
          {isAuthenticated ? (
            <View className="mt-3">
              <Button label="Sign out" variant="outline" onPress={() => logout()} />
            </View>
          ) : (
            <View className="mt-3">
              <Button label="Sign in" onPress={() => router.push("/login")} />
            </View>
          )}
        </Card>
        {LINKS.map((item) => (
          <Link key={item.href} href={item.href} asChild>
            <Pressable>
              <Card>
                <Text className="font-sans text-base font-semibold text-foreground">{item.label}</Text>
                <Muted>{item.detail}</Muted>
              </Card>
            </Pressable>
          </Link>
        ))}
      </View>
    </Screen>
  );
}
