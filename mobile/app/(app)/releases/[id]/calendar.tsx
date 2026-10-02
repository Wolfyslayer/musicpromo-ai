import { useEffect, useMemo, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { Pressable, View } from "react-native";
import { Badge, Card, Muted, P, Screen } from "@/components/ui";
import { loadReleaseCalendar } from "@/lib/data";
import { errorMessage, fmtDate, fmtMonthYear } from "@/lib/format";
import type { Row } from "@/lib/types";

export default function ReleaseCalendar() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [entries, setEntries] = useState<Row[]>([]);
  const [title, setTitle] = useState("Calendar");
  const [error, setError] = useState("");
  const [cursor, setCursor] = useState(() => new Date());

  useEffect(() => {
    loadReleaseCalendar(String(id))
      .then((result) => {
        setEntries(result.entries);
        setTitle(result.release?.title || "Calendar");
      })
      .catch((err) => setError(errorMessage(err)));
  }, [id]);

  const monthKey = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
  const visible = useMemo(
    () => entries.filter((entry) => String(entry.date || "").startsWith(monthKey)),
    [entries, monthKey]
  );

  const shift = (amount: number) => {
    const next = new Date(cursor);
    next.setMonth(next.getMonth() + amount);
    setCursor(next);
  };

  return (
    <Screen>
      <View className="gap-4">
        <P className="font-semibold">{title}</P>
        {error ? <Muted>{error}</Muted> : null}
        <View className="flex-row items-center justify-between">
          <Pressable onPress={() => shift(-1)} className="rounded-full bg-muted px-4 py-2">
            <P>Prev</P>
          </Pressable>
          <P className="font-semibold">{fmtMonthYear(cursor)}</P>
          <Pressable onPress={() => shift(1)} className="rounded-full bg-muted px-4 py-2">
            <P>Next</P>
          </Pressable>
        </View>
        {visible.length ? (
          visible.map((entry) => (
            <Card key={entry.id} className="gap-1">
              <View className="flex-row items-center justify-between">
                <P className="font-semibold">{fmtDate(entry.date)}</P>
                <Badge status={entry.status} />
              </View>
              <Muted>
                {entry.campaign_name} · Day {entry.day_number} · {entry.platform}
              </Muted>
              <P>{entry.caption || entry.hook || entry.content_type}</P>
            </Card>
          ))
        ) : (
          <Muted>No campaign days in this month.</Muted>
        )}
      </View>
    </Screen>
  );
}
