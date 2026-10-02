import { Loader2 } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';
import { energyLabel } from '@/services/assetAnalysis';

export default function AssetAnalysisPanel({
  profile,
  analyzing,
  onEnergy,
}: {
  profile?: Record<string, unknown> | null;
  analyzing?: boolean;
  onEnergy?: (energy: string) => void;
}) {
  const hooks = (profile?.hooks as string[]) || [];
  return (
    <View className="rounded-2xl border border-border bg-card p-4">
      <View className="flex-row items-center justify-between gap-3">
        <View className="flex-1">
          <Text className="text-[10px] font-bold uppercase tracking-wider text-primary">Asset analysis</Text>
          <Text className="mt-1 text-sm text-muted-foreground">
            Cover colors and track energy shape the visual template and hooks for this campaign.
          </Text>
        </View>
        {analyzing ? <Loader2 color="#8b5cf6" size={18} /> : null}
      </View>
      <View className="mt-4 flex-row flex-wrap gap-2">
        {[
          ['fast', 'Fast / Aggressive'],
          ['slow', 'Slow / Acoustic'],
        ].map(([id, label]) => (
          <Pressable
            key={id}
            onPress={() => onEnergy?.(id)}
            className={`min-h-11 flex-1 rounded-xl border px-3 py-2 ${
              profile?.energy === id ? 'border-primary bg-primary/15' : 'border-border bg-background'
            }`}
          >
            <Text
              className={`text-sm font-semibold ${
                profile?.energy === id ? 'text-primary' : 'text-foreground'
              }`}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>
      {profile ? (
        <View className="mt-4 gap-3">
          <View className="rounded-xl border border-border/70 bg-background/60 p-3">
            <Text className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Artwork</Text>
            <Text className="mt-2 text-sm font-semibold text-foreground">{String(profile.label || '')}</Text>
            <Text className="text-xs text-muted-foreground">
              {String(profile.template || '')} · {String(profile.particleEffect || '')}
            </Text>
          </View>
          <View className="rounded-xl border border-border/70 bg-background/60 p-3">
            <Text className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Audio</Text>
            <Text className="mt-2 text-sm font-semibold text-foreground">
              {energyLabel(String(profile.energy || ''))}
            </Text>
          </View>
          {hooks.length ? (
            <View>
              <Text className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Hooks</Text>
              {hooks.map((hook) => (
                <Text key={hook} className="mt-2 rounded-lg bg-muted/50 px-3 py-2 text-sm text-foreground">
                  {hook}
                </Text>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
