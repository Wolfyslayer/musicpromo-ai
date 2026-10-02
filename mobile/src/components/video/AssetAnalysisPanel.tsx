import { ActivityIndicator, Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { energyLabel } from '@/services/assetAnalysis';
import { fmtDuration } from '@/services/format';

const ENERGIES = [
  ['fast', 'Fast / Aggressive'],
  ['slow', 'Slow / Acoustic'],
];

export default function AssetAnalysisPanel({ profile, analyzing, onEnergy }: { profile?: any; analyzing?: boolean; onEnergy?: (energy: string) => void }) {
  return (
    <View className="rounded-2xl border border-border bg-card p-4">
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text className="text-[10px] font-bold uppercase tracking-[2px] text-primary">Asset analysis</Text>
          <Text className="mt-1 text-sm text-muted-foreground">
            Cover colors and track energy shape the visual template and the hooks saved with this campaign.
          </Text>
        </View>
        {analyzing ? <ActivityIndicator size="small" /> : null}
      </View>

      <View className="mt-4 gap-2">
        {ENERGIES.map(([id, label]) => (
          <Pressable
            key={id}
            onPress={() => onEnergy?.(id)}
            className={cn('min-h-11 justify-center rounded-xl border px-3 py-2', profile?.energy === id ? 'border-primary bg-primary/15' : 'border-border bg-background')}>
            <Text className={cn('text-sm font-semibold', profile?.energy === id ? 'text-primary' : 'text-foreground')}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {profile ? (
        <View className="mt-4 gap-3">
          <View className="rounded-xl border border-border/70 bg-background/60 p-3">
            <Text className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Artwork</Text>
            <View className="mt-2 flex-row items-center gap-2">
              <View className="size-8 rounded-lg border border-border" style={{ backgroundColor: profile.palette }} />
              <View className="flex-1">
                <Text className="text-sm font-semibold">{profile.label}</Text>
                <Text className="text-xs text-muted-foreground">
                  {profile.template} · {profile.particleEffect === 'smoke' ? 'fog' : profile.particleEffect}
                </Text>
              </View>
            </View>
          </View>
          <View className="rounded-xl border border-border/70 bg-background/60 p-3">
            <Text className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Audio</Text>
            <Text className="mt-2 text-sm font-semibold">{energyLabel(profile.energy)}</Text>
            <Text className="text-xs text-muted-foreground">
              {profile.detectedEnergy && profile.energy === profile.detectedEnergy ? 'Read from the track' : 'Tagged by you'}
              {profile.duration ? ` · ${fmtDuration(profile.duration)}` : ''}
            </Text>
          </View>
          <View>
            <Text className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Hooks</Text>
            <View className="mt-2 gap-1.5">
              {(profile.hooks || []).map((hook: string) => (
                <View key={hook} className="rounded-lg bg-muted/50 px-3 py-2">
                  <Text className="text-sm">{hook}</Text>
                </View>
              ))}
            </View>
            <Text className="mt-2 text-xs text-muted-foreground">{(profile.keywords || []).join(' · ')}</Text>
          </View>
        </View>
      ) : (
        <Text className="mt-3 text-sm text-muted-foreground">Upload artwork and a track to generate the profile.</Text>
      )}
    </View>
  );
}
