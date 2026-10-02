// @ts-nocheck
import { View, Text, Pressable, ScrollView, Linking, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import CopyButton from '@/components/CopyButton';

/**
 * Compact labeled text card for captions, hooks, hashtags, CTAs, etc.
 */
export default function PromoTextCard({ label, text, className = "" }) {
  if (!text) return null;
  return (
    <View className={`rounded-xl border border-border/50 bg-muted/30 p-3 ${className}`}>
      <View className="mb-1.5 flex items-center justify-between gap-2">
        <Text className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</Text>
        <CopyButton text={text} label="Copy" />
      </View>
      <Text className={`text-sm ${label === 'HASHTAGS' ? 'font-mono text-xs text-primary' : 'text-foreground'}`}>{text}</Text>
    </View>
  );
}
