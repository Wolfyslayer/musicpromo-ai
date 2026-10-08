import { Stack, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { Card } from "@/components/ui/Card";
import { LoadingBlock } from "@/components/ui/LoadingBlock";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { Button } from "@/components/ui/Button";
import { db } from "@/api/base44Client";
import { userFacingError } from "@/lib/errors";
import type { EntityRow } from "@/services/types";

export default function ArtistDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useQuery({
    queryKey: ["artist", id],
    queryFn: async () => (await db.entities.Artist.get(String(id))) as EntityRow,
    enabled: Boolean(id),
  });

  const artist = query.data;

  return (
    <>
      <Stack.Screen options={{ title: String(artist?.name || "Artist") }} />
      <Screen>
        {query.isLoading ? <LoadingBlock /> : null}
        {query.isError ? (
          <ErrorBanner
            message={userFacingError(query.error, "Could not load artist.")}
            onRetry={() => query.refetch()}
          />
        ) : null}
        {artist ? (
          <Card>
            <Text variant="heading">{String(artist.name)}</Text>
            <Text muted>Genre: {String(artist.genre || "—")}</Text>
            <Text muted variant="caption">
              Id {String(artist.id)}
            </Text>
          </Card>
        ) : null}
        <Button title="Refresh" variant="outline" onPress={() => query.refetch()} />
      </Screen>
    </>
  );
}
