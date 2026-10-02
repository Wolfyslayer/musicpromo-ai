import { Link, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { Share2 } from 'lucide-react-native';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/lib/toast';
import { CAMPAIGN_DURATIONS, PLATFORMS, VIDEO_TEMPLATES_LIST } from '@/services/constants';
import { applyTheme, DEFAULT_SETTINGS, getSettings, saveSettings } from '@/services/settings';

type SettingsState = typeof DEFAULT_SETTINGS;

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="gap-4 rounded-2xl border border-border bg-card p-5">
      <Text className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{title}</Text>
      {children}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between py-1.5">
      <Text className="text-sm text-muted-foreground">{label}</Text>
      <Text className="text-sm font-medium text-foreground">{value}</Text>
    </View>
  );
}

export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [s, setS] = useState<SettingsState>(DEFAULT_SETTINGS);

  useEffect(() => {
    getSettings().then((loaded) => {
      setS(loaded as SettingsState);
      applyTheme();
    });
  }, []);

  const set = <K extends keyof SettingsState>(k: K, v: SettingsState[K]) =>
    setS((p) => ({ ...p, [k]: v }));

  const save = async () => {
    await saveSettings(s);
    toast({ title: 'Settings saved' });
  };

  const togglePlatform = (id: string) => {
    setS((p) => {
      const has = p.defaultPlatforms.includes(id);
      return {
        ...p,
        defaultPlatforms: has
          ? p.defaultPlatforms.filter((x) => x !== id)
          : [...p.defaultPlatforms, id],
      };
    });
  };

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="gap-6 p-4 pb-12">
      <Text className="font-heading text-2xl font-bold text-foreground">Settings</Text>

      <Card title="Account">
        <Row label="Name" value={user?.full_name || '—'} />
        <Row label="Email" value={user?.email || '—'} />
        <Row label="Role" value={user?.role || '—'} />
        <Button
          variant="outline"
          label="Sign out"
          onPress={async () => {
            await logout();
            router.replace('/');
          }}
        />
      </Card>

      <Card title="Social Accounts">
        <Text className="text-sm font-semibold text-foreground">Manage connected platforms</Text>
        <Text className="text-xs text-muted-foreground">
          Open the Social Hub to connect Instagram, TikTok, and YouTube.
        </Text>
        <Button variant="outline" label="Open Social Hub" onPress={() => router.push('/social')} />
      </Card>

      <Card title="AI Preferences">
        <Label className="text-xs text-muted-foreground">AI Provider</Label>
        <Select value={s.aiProvider} onValueChange={(v) => set('aiProvider', v)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Base44 InvokeLLM (default)">Base44 InvokeLLM (default)</SelectItem>
            <SelectItem value="custom">Custom endpoint (configure after export)</SelectItem>
          </SelectContent>
        </Select>
        <Text className="text-xs text-muted-foreground">
          Prompts are modular and provider-agnostic. Swap providers without changing the UI.
        </Text>
      </Card>

      <Card title="Default Campaign">
        <Label className="text-xs text-muted-foreground">Default length</Label>
        <Select value={String(s.defaultDuration)} onValueChange={(v) => set('defaultDuration', Number(v))}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CAMPAIGN_DURATIONS.map((d) => (
              <SelectItem key={d.days} value={String(d.days)}>
                {d.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Label className="text-xs text-muted-foreground">Default posting time</Label>
        <Input value={s.defaultPostingTime} onChangeText={(v) => set('defaultPostingTime', v)} />
        <Label className="text-xs text-muted-foreground">Default platforms</Label>
        <View className="flex-row flex-wrap gap-2">
          {PLATFORMS.map((p) => (
            <Pressable
              key={p.id}
              onPress={() => togglePlatform(p.id)}
              className={`rounded-full border px-3 py-1.5 ${
                s.defaultPlatforms.includes(p.id) ? 'border-primary/40 bg-primary/15' : 'border-border'
              }`}
            >
              <Text
                className={`text-xs ${
                  s.defaultPlatforms.includes(p.id) ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                {p.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </Card>

      <Card title="Video Preferences">
        <Label className="text-xs text-muted-foreground">Default template</Label>
        <Select value={s.defaultTemplate} onValueChange={(v) => set('defaultTemplate', v)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {VIDEO_TEMPLATES_LIST.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Label className="text-xs text-muted-foreground">Default duration (seconds)</Label>
        <Input
          keyboardType="numeric"
          value={String(s.defaultVideoDuration)}
          onChangeText={(v) => set('defaultVideoDuration', Number(v) || 15)}
        />
      </Card>

      <Card title="Appearance">
        <Text className="text-sm font-semibold text-foreground">Matches your device</Text>
        <Text className="text-xs text-muted-foreground">
          Light and dark follow the system setting. Brand purple and pink stay the same in both.
        </Text>
      </Card>

      <Card title="Notifications">
        {(
          [
            ['campaignReady', 'Campaign generation complete'],
            ['weeklyReport', 'Weekly performance summary'],
            ['performanceTips', 'AI performance tips'],
          ] as const
        ).map(([k, label]) => (
          <View key={k} className="flex-row items-center justify-between py-2">
            <Text className="text-sm text-foreground">{label}</Text>
            <Switch
              value={!!s.notifications[k]}
              onValueChange={(c) => set('notifications', { ...s.notifications, [k]: c })}
            />
          </View>
        ))}
      </Card>

      <Card title="Legal">
        <View className="flex-row flex-wrap gap-4">
          <Link href="/privacy">
            <Text className="text-sm text-primary">Privacy Policy</Text>
          </Link>
          <Link href="/terms">
            <Text className="text-sm text-primary">Terms of Service</Text>
          </Link>
        </View>
        <Text className="text-xs text-muted-foreground">
          Public URLs for TikTok / Google / Meta app review: /privacy and /terms.
        </Text>
      </Card>

      <Button label="Save settings" onPress={save} />
    </ScrollView>
  );
}
