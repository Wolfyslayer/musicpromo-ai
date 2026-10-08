import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Screen } from "@/components/ui/Screen";
import { Text } from "@/components/ui/Text";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { LoadingBlock } from "@/components/ui/LoadingBlock";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { EmptyState } from "@/components/ui/EmptyState";
import { OfflineBanner } from "@/components/OfflineBanner";
import { createArtist, loadArtists } from "@/services/data";
import { spacing } from "@/theme";
import { userFacingError } from "@/lib/errors";

export default function ArtistsScreen() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [genre, setGenre] = useState("");
  const query = useQuery({ queryKey: ["artists"], queryFn: loadArtists });
  const create = useMutation({
    mutationFn: () => createArtist({ name, genre }),
    onSuccess: () => {
      setName("");
      setGenre("");
      qc.invalidateQueries({ queryKey: ["artists"] });
    },
  });

  return (
    <Screen>
      <OfflineBanner />
      <Text variant="heading">Artists</Text>
      <Text muted>Manage the artists linked to your promo campaigns.</Text>

      <Card>
        <Text variant="label">Add artist</Text>
        <Input label="Name" value={name} onChangeText={setName} />
        <Input label="Genre" value={genre} onChangeText={setGenre} />
        {create.isError ? (
          <ErrorBanner message={userFacingError(create.error, "Could not create artist.")} />
        ) : null}
        <Button
          title="Save artist"
          onPress={() => create.mutate()}
          loading={create.isPending}
          disabled={create.isPending || !name.trim()}
        />
      </Card>

      {query.isLoading ? <LoadingBlock /> : null}
      {query.isError ? (
        <ErrorBanner
          message={userFacingError(query.error, "Could not load artists.")}
          onRetry={() => query.refetch()}
        />
      ) : null}

      {query.isSuccess && !(query.data || []).length ? (
        <EmptyState title="No artists" description="Add an artist before creating a campaign." />
      ) : (
        (query.data || []).map((a) => (
          <Card
            key={String(a.id)}
            onPress={() => router.push(`/(app)/artists/${a.id}`)}
            accessibilityLabel={`Artist ${a.name}`}
          >
            <Text variant="bodyStrong">{String(a.name || "Untitled")}</Text>
            <Text muted variant="caption">
              {String(a.genre || "No genre")}
            </Text>
          </Card>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  gap: { gap: spacing.md },
});
