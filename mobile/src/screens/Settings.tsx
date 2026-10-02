import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { LogIn, LogOut, Share2 } from 'lucide-react-native';
import * as React from 'react';
import { useEffect, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { toast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';
import { cn } from '@/lib/utils';
import { CAMPAIGN_DURATIONS, PLATFORMS, VIDEO_TEMPLATES_LIST } from '@/services/constants';
import { DEFAULT_SETTINGS, getSettings, saveSettings } from '@/services/settings';

const AI_PROVIDERS = [
  { value: 'Base44 InvokeLLM (default)', label: 'Base44 InvokeLLM (default)' },
  { value: 'custom', label: 'Custom endpoint (configure after export)' },
];

const NOTIFICATION_LABELS: Record<string, string> = {
  campaignReady: 'Campaign generation complete',
  weeklyReport: 'Weekly performance summary',
  performanceTips: 'AI performance tips',
};

const MIN_VIDEO_SECONDS = 5;
const MAX_VIDEO_SECONDS = 60;

function parseTime(value: string) {
  const [h, m] = String(value || '18:00').split(':').map((n) => Number(n));
  const d = new Date();
  d.setHours(Number.isFinite(h) ? h : 18, Number.isFinite(m) ? m : 0, 0, 0);
  return d;
}

function formatTime(d: Date) {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function TimeField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [show, setShow] = useState(false);
  const date = parseTime(value);

  if (Platform.OS === 'ios') {
    return (
      <View className="h-11 flex-row items-center justify-start">
        <DateTimePicker value={date} mode="time" display="compact" onChange={(_, selected) => selected && onChange(formatTime(selected))} />
      </View>
    );
  }

  return (
    <>
      <Pressable onPress={() => setShow(true)} className="h-11 justify-center rounded-xl border border-input bg-background px-3">
        <Text className="text-base">{value || '--:--'}</Text>
      </Pressable>
      {show ? (
        <DateTimePicker
          value={date}
          mode="time"
          is24Hour
          onChange={(_, selected) => {
            setShow(false);
            if (selected) onChange(formatTime(selected));
          }}
        />
      ) : null}
    </>
  );
}

function SettingsCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="gap-4 rounded-2xl border border-border bg-card p-5">
      <Text className="font-heading text-sm uppercase tracking-wider text-muted-foreground">{title}</Text>
      {children}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between gap-4 py-1.5">
      <Text className="text-sm text-muted-foreground">{label}</Text>
      <Text className="flex-1 text-right text-sm font-medium" numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <Label className="mb-0 text-xs font-normal text-muted-foreground">{children}</Label>;
}

export default function Settings() {
  const { user, isAuthenticated, logout, requireAuth } = useAuth();
  const router = useRouter();
  const [s, setS] = useState<any>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    getSettings().then((stored: any) => {
      if (!active) return;
      setS(stored);
      setLoaded(true);
    });
    return () => {
      active = false;
    };
  }, []);

  const set = (k: string, v: any) => setS((p: any) => ({ ...p, [k]: v }));

  const save = async () => {
    const duration = Math.min(MAX_VIDEO_SECONDS, Math.max(MIN_VIDEO_SECONDS, Number(s.defaultVideoDuration) || MIN_VIDEO_SECONDS));
    const next = { ...s, defaultVideoDuration: duration };
    setSaving(true);
    try {
      await saveSettings(next);
      setS(next);
      toast({ title: 'Settings saved' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Could not save settings', description: err?.message });
    } finally {
      setSaving(false);
    }
  };

  const togglePlatform = (id: string) => {
    setS((p: any) => {
      const has = p.defaultPlatforms.includes(id);
      return { ...p, defaultPlatforms: has ? p.defaultPlatforms.filter((x: string) => x !== id) : [...p.defaultPlatforms, id] };
    });
  };

  const handleSignOut = async () => {
    await logout();
    toast({ title: 'Signed out' });
  };

  return (
    <Screen>
      <SettingsCard title="Account">
        <View>
          <Row label="Name" value={user?.full_name || '—'} />
          <Row label="Email" value={user?.email || '—'} />
          <Row label="Role" value={user?.role || '—'} />
        </View>
        {isAuthenticated ? (
          <Button variant="outline" className="rounded-full" onPress={handleSignOut}>
            <Icon as={LogOut} size={16} className="text-destructive" />
            <Text className="text-sm font-medium text-destructive">Sign out</Text>
          </Button>
        ) : (
          <Button variant="outline" className="rounded-full" onPress={() => requireAuth()}>
            <Icon as={LogIn} size={16} className="text-primary" />
            <Text className="text-sm font-medium">Sign in</Text>
          </Button>
        )}
      </SettingsCard>

      <SettingsCard title="Social Accounts">
        <View className="gap-3">
          <View>
            <Text className="text-sm font-semibold">Manage connected platforms</Text>
            <Text className="text-xs text-muted-foreground">Open the Social Hub to connect Instagram, TikTok, and YouTube.</Text>
          </View>
          <Button variant="outline" className="min-h-10 self-start rounded-full" onPress={() => router.push('/social')}>
            <Icon as={Share2} size={14} className="text-foreground" />
            <Text className="text-sm font-medium">Open Social Hub</Text>
          </Button>
        </View>
      </SettingsCard>

      <SettingsCard title="AI Preferences">
        <View className="gap-1.5">
          <FieldLabel>AI Provider</FieldLabel>
          <Select className="rounded-xl" title="AI Provider" value={s.aiProvider} onValueChange={(v) => set('aiProvider', v)} options={AI_PROVIDERS} />
          <Text className="text-xs text-muted-foreground">Prompts are modular and provider-agnostic. Swap providers without changing the UI.</Text>
        </View>
      </SettingsCard>

      <SettingsCard title="Default Campaign">
        <View className="gap-1.5">
          <FieldLabel>Default length</FieldLabel>
          <Select
            className="rounded-xl"
            title="Default length"
            value={String(s.defaultDuration)}
            onValueChange={(v) => set('defaultDuration', Number(v))}
            options={CAMPAIGN_DURATIONS.map((d: any) => ({ value: String(d.days), label: d.label }))}
          />
        </View>
        <View className="gap-1.5">
          <FieldLabel>Default posting time</FieldLabel>
          <TimeField value={s.defaultPostingTime} onChange={(v) => set('defaultPostingTime', v)} />
        </View>
        <View className="gap-2">
          <FieldLabel>Default platforms</FieldLabel>
          <View className="flex-row flex-wrap gap-2">
            {PLATFORMS.map((p: any) => {
              const active = s.defaultPlatforms.includes(p.id);
              return (
                <Pressable
                  key={p.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => togglePlatform(p.id)}
                  className={cn('rounded-full border px-3 py-1.5', active ? 'border-primary/40 bg-primary/15' : 'border-border')}>
                  <Text className={cn('text-xs font-medium', active ? 'text-primary' : 'text-muted-foreground')}>{p.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </SettingsCard>

      <SettingsCard title="Video Preferences">
        <View className="gap-1.5">
          <FieldLabel>Default template</FieldLabel>
          <Select className="rounded-xl" title="Default template" value={s.defaultTemplate} onValueChange={(v) => set('defaultTemplate', v)} options={VIDEO_TEMPLATES_LIST} />
        </View>
        <View className="gap-1.5">
          <FieldLabel>Default duration (seconds)</FieldLabel>
          <Input
            className="rounded-xl"
            keyboardType="number-pad"
            maxLength={3}
            value={s.defaultVideoDuration ? String(s.defaultVideoDuration) : ''}
            onChangeText={(v) => set('defaultVideoDuration', Number(v.replace(/\D/g, '')))}
          />
          <Text className="text-xs text-muted-foreground">
            Between {MIN_VIDEO_SECONDS} and {MAX_VIDEO_SECONDS} seconds.
          </Text>
        </View>
      </SettingsCard>

      <SettingsCard title="Appearance">
        <View>
          <Text className="text-sm font-semibold">Matches your device</Text>
          <Text className="text-xs text-muted-foreground">Light and dark follow the system setting. Brand purple and pink stay the same in both.</Text>
        </View>
      </SettingsCard>

      <SettingsCard title="Notifications">
        <View>
          {Object.entries(NOTIFICATION_LABELS).map(([k, label]) => (
            <View key={k} className="flex-row items-center justify-between gap-3 py-2">
              <Text className="flex-1 text-sm">{label}</Text>
              <Switch checked={!!s.notifications?.[k]} onCheckedChange={(c) => set('notifications', { ...s.notifications, [k]: c })} />
            </View>
          ))}
        </View>
      </SettingsCard>

      <SettingsCard title="Legal">
        <View className="flex-row flex-wrap gap-x-4 gap-y-2">
          <Pressable hitSlop={8} onPress={() => router.push('/privacy')}>
            <Text className="text-sm text-primary underline">Privacy Policy</Text>
          </Pressable>
          <Pressable hitSlop={8} onPress={() => router.push('/terms')}>
            <Text className="text-sm text-primary underline">Terms of Service</Text>
          </Pressable>
        </View>
        <Text className="text-xs text-muted-foreground">
          Public URLs for TikTok / Google / Meta app review: <Text className="text-xs">/privacy</Text> and <Text className="text-xs">/terms</Text>.
        </Text>
      </SettingsCard>

      <Button onPress={save} loading={saving} disabled={!loaded} className="rounded-full">
        Save settings
      </Button>
    </Screen>
  );
}
