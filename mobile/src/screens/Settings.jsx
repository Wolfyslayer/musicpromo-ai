import { useState } from "react";
import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LogIn, LogOut, Share2 } from "lucide-react-native";
import { useAuth } from "@/lib/AuthContext";
import { Screen, LoadingState, PageHeader } from "@/components/Screen";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Chip, Switch } from "@/components/ui/controls";
import { Text } from "@/components/ui/text";
import { toast } from "@/components/ui/toast";
import { CAMPAIGN_DURATIONS, PLATFORMS, VIDEO_TEMPLATES_LIST } from "@/services/constants";
import { DEFAULT_SETTINGS, getSettings, saveSettings } from "@/services/settings";

const AI_PROVIDERS = [
  { value: "Base44 InvokeLLM (default)", label: "Base44 InvokeLLM (default)" },
  { value: "custom", label: "Custom endpoint (configure after export)" },
];

const NOTIFICATIONS = {
  campaignReady: "Campaign generation complete",
  weeklyReport: "Weekly performance summary",
  performanceTips: "AI performance tips",
};

export default function Settings() {
  const query = useQuery({ queryKey: ["settings"], queryFn: getSettings });

  if (!query.data) return <LoadingState label="Loading settings…" />;
  return <SettingsForm initial={query.data} />;
}

function SettingsForm({ initial }) {
  const { user, isAuthenticated, requireAuth, logout } = useAuth();
  const queryClient = useQueryClient();
  const [s, setS] = useState(() => ({ ...DEFAULT_SETTINGS, ...initial }));
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setS((p) => ({ ...p, [k]: v }));

  const save = async () => {
    const next = { ...s, defaultVideoDuration: Number(s.defaultVideoDuration) || DEFAULT_SETTINGS.defaultVideoDuration };
    setSaving(true);
    try {
      await saveSettings(next);
      setS(next);
      queryClient.setQueryData(["settings"], next);
      toast({ title: "Settings saved" });
    } catch (err) {
      toast({ variant: "destructive", title: "Could not save settings", description: err?.message });
    } finally {
      setSaving(false);
    }
  };

  const togglePlatform = (id) => {
    setS((p) => {
      const has = p.defaultPlatforms.includes(id);
      return { ...p, defaultPlatforms: has ? p.defaultPlatforms.filter((x) => x !== id) : [...p.defaultPlatforms, id] };
    });
  };

  const signOut = async () => {
    await logout();
    router.replace("/");
  };

  return (
    <Screen contentClassName="gap-6">
      <PageHeader title="Settings" />

      <Card title="Account">
        <Row label="Name" value={user?.full_name || "—"} />
        <Row label="Email" value={user?.email || "—"} />
        <Row label="Role" value={user?.role || "—"} />
        {isAuthenticated ? (
          <Button variant="outline" icon={LogOut} className="rounded-full" onPress={signOut}>
            Sign out
          </Button>
        ) : (
          <Button icon={LogIn} className="rounded-full" onPress={() => requireAuth()}>
            Sign in
          </Button>
        )}
      </Card>

      <Card title="Social Accounts">
        <View>
          <Text className="text-sm font-600">Manage connected platforms</Text>
          <Text className="text-xs text-muted-foreground">Open the Social Hub to connect Instagram, TikTok, and YouTube.</Text>
        </View>
        <Button variant="outline" icon={Share2} className="min-h-10 rounded-full" onPress={() => router.push("/social")}>
          Open Social Hub
        </Button>
      </Card>

      <Card title="AI Preferences">
        <Field
          label="AI Provider"
          hint="Prompts are modular and provider-agnostic. Swap providers without changing the UI."
        >
          <Select
            value={s.aiProvider}
            onValueChange={(v) => set("aiProvider", v)}
            options={AI_PROVIDERS}
            title="AI Provider"
          />
        </Field>
      </Card>

      <Card title="Default Campaign">
        <Field label="Default length">
          <Select
            value={String(s.defaultDuration)}
            onValueChange={(v) => set("defaultDuration", Number(v))}
            options={CAMPAIGN_DURATIONS.map((d) => ({ value: String(d.days), label: d.label }))}
            title="Default length"
          />
        </Field>
        <Field label="Default posting time">
          <Input
            value={s.defaultPostingTime}
            onChangeText={(v) => set("defaultPostingTime", v)}
            placeholder="HH:MM"
            keyboardType="numbers-and-punctuation"
            maxLength={5}
          />
        </Field>
        <Field label="Default platforms">
          <View className="flex-row flex-wrap gap-2">
            {PLATFORMS.map((p) => (
              <Chip key={p.id} selected={s.defaultPlatforms.includes(p.id)} onPress={() => togglePlatform(p.id)}>
                {p.label}
              </Chip>
            ))}
          </View>
        </Field>
      </Card>

      <Card title="Video Preferences">
        <Field label="Default template">
          <Select
            value={s.defaultTemplate}
            onValueChange={(v) => set("defaultTemplate", v)}
            options={VIDEO_TEMPLATES_LIST}
            title="Default template"
          />
        </Field>
        <Field label="Default duration (seconds)">
          <Input
            value={String(s.defaultVideoDuration ?? "")}
            onChangeText={(v) => {
              const digits = v.replace(/\D/g, "");
              set("defaultVideoDuration", digits === "" ? "" : Math.min(60, Number(digits)));
            }}
            onEndEditing={() => set("defaultVideoDuration", Math.max(5, Number(s.defaultVideoDuration) || 5))}
            keyboardType="number-pad"
            maxLength={2}
          />
        </Field>
      </Card>

      <Card title="Appearance">
        <View>
          <Text className="text-sm font-600">Matches your device</Text>
          <Text className="text-xs text-muted-foreground">
            Light and dark follow the system setting. Brand purple and pink stay the same in both.
          </Text>
        </View>
      </Card>

      <Card title="Notifications">
        {Object.entries(NOTIFICATIONS).map(([k, label]) => (
          <View key={k} className="flex-row items-center justify-between gap-3 py-1">
            <Text className="flex-1 text-sm">{label}</Text>
            <Switch checked={!!s.notifications?.[k]} onCheckedChange={(c) => set("notifications", { ...s.notifications, [k]: c })} />
          </View>
        ))}
      </Card>

      <Card title="Legal">
        <View className="flex-row flex-wrap gap-4">
          <Pressable onPress={() => router.push("/privacy")} hitSlop={8}>
            <Text className="text-sm text-primary">Privacy Policy</Text>
          </Pressable>
          <Pressable onPress={() => router.push("/terms")} hitSlop={8}>
            <Text className="text-sm text-primary">Terms of Service</Text>
          </Pressable>
        </View>
        <Text className="text-xs text-muted-foreground">
          Public URLs for TikTok / Google / Meta app review: <Text className="text-xs text-foreground">/privacy</Text> and{" "}
          <Text className="text-xs text-foreground">/terms</Text>.
        </Text>
      </Card>

      <Button onPress={save} loading={saving} className="rounded-full">
        Save settings
      </Button>
    </Screen>
  );
}

function Card({ title, children }) {
  return (
    <View className="gap-4 rounded-2xl border border-border/60 bg-card p-5">
      <Text className="font-heading text-sm uppercase tracking-wider text-muted-foreground">{title}</Text>
      {children}
    </View>
  );
}

function Row({ label, value }) {
  return (
    <View className="flex-row items-center justify-between gap-3 py-1.5">
      <Text className="text-sm text-muted-foreground">{label}</Text>
      <Text className="flex-1 text-right text-sm font-500" numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}
