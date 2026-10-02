import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { Pressable, ScrollView, Text, View } from 'react-native';

export type LegalBlock =
  | { type: 'p'; text: string }
  | { type: 'h2'; text: string }
  | { type: 'ul'; items: string[] };

export default function LegalDocumentScreen({
  title,
  lastUpdated,
  blocks,
}: {
  title: string;
  lastUpdated?: string;
  blocks: LegalBlock[];
}) {
  const router = useRouter();

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="gap-4 p-4 pb-12">
      <Pressable onPress={() => router.back()} className="flex-row items-center gap-1.5">
        <ArrowLeft color="#64748b" size={16} />
        <Text className="text-sm text-muted-foreground">Back</Text>
      </Pressable>

      <View>
        <Text className="font-heading text-2xl font-bold text-foreground">{title}</Text>
        {lastUpdated ? (
          <Text className="mt-1 text-xs text-muted-foreground">Last updated: {lastUpdated}</Text>
        ) : null}
      </View>

      {blocks.map((block, i) => {
        if (block.type === 'h2') {
          return (
            <Text key={i} className="mt-2 text-lg font-semibold text-foreground">
              {block.text}
            </Text>
          );
        }
        if (block.type === 'ul') {
          return (
            <View key={i} className="gap-2 pl-1">
              {block.items.map((item, j) => (
                <View key={j} className="flex-row gap-2">
                  <Text className="text-muted-foreground">•</Text>
                  <Text className="flex-1 text-sm leading-6 text-muted-foreground">{item}</Text>
                </View>
              ))}
            </View>
          );
        }
        return (
          <Text key={i} className="text-sm leading-6 text-muted-foreground">
            {block.text}
          </Text>
        );
      })}
    </ScrollView>
  );
}
