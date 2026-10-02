import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { Button, Card, Empty, Muted, P, Screen } from "@/components/ui";
import { loadArtists } from "@/lib/data";
import { initials } from "@/lib/format";
import type { Row } from "@/lib/types";

export default function Artists() {
  const router = useRouter();
  const [artists, setArtists] = useState<Row[] | null>(null);

  useEffect(() => {
    loadArtists().then(setArtists).catch(() => setArtists([]));
  }, []);

  return (
    <Screen>
      <View className="gap-4">
        <Muted>Manage multiple artist profiles from one account.</Muted>
        <Button label="New artist" onPress={() => router.push("/artists/new")} />
        {artists?.length ? (
          artists.map((artist) => (
            <Pressable key={artist.id} onPress={() => router.push(`/artists/${artist.id}`)}>
              <Card className="flex-row items-center gap-3">
                <View className="h-14 w-14 items-center justify-center rounded-full bg-primary/15">
                  <Text className="font-heading text-lg text-primary">{initials(artist.name)}</Text>
                </View>
                <View className="flex-1">
                  <P className="font-semibold">{artist.name}</P>
                  <Muted>{[artist.genre, artist.location].filter(Boolean).join(" · ") || "No genre yet"}</Muted>
                </View>
              </Card>
            </Pressable>
          ))
        ) : artists ? (
          <Empty title="No artists yet" description="Create an artist profile to start building campaigns." />
        ) : null}
      </View>
    </Screen>
  );
}
