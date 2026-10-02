import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { Switch, View } from "react-native";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/Toast";
import { Button, Card, Chip, Field, Muted, P, Screen, SelectField } from "@/components/ui";
import { CAMPAIGN_DURATIONS, PLATFORMS, VIDEO_TEMPLATES_LIST } from "@/lib/constants";
import { DEFAULT_SETTINGS, getSettings, saveSettings, type Settings } from "@/lib/settings";

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  useEffect(() => {
    getSettings().then(setSettings);
  }, []);

  const togglePlatform = (id: string) => {
    setSettings((current) => ({
      ...current,
      defaultPlatforms: current.defaultPlatforms.includes(id)
        ? current.defaultPlatforms.filter((item) => item !== id)
        : [...current.defaultPlatforms, id],
    }));
  };

  return (
    <Screen>
      <View className="gap-4">
        <Card className="gap-2">
          <P className="font-semibold">Account</P>
          <Muted>Name · {user?.full_name || "—"}</Muted>
          <Muted>Email · {user?.email || "—"}</Muted>
          <Muted>Role · {user?.role || "—"}</Muted>
        </Card>
        <Card className="gap-3">
          <P className="font-semibold">Social accounts</P>
          <Muted>Connect Instagram, TikTok, and YouTube from the Social Hub.</Muted>
          <Button label="Open Social Hub" variant="outline" onPress={() => router.push("/social")} />
        </Card>
        <Card className="gap-3">
          <P className="font-semibold">AI preferences</P>
          <SelectField
            label="AI provider"
            value={settings.aiProvider}
            onChange={(value) => setSettings((current) => ({ ...current, aiProvider: value }))}
            options={[
              { label: "Base44 InvokeLLM (default)", value: "Base44 InvokeLLM (default)" },
              { label: "Custom endpoint", value: "custom" },
            ]}
          />
        </Card>
        <Card className="gap-3">
          <P className="font-semibold">Default campaign</P>
          <SelectField
            label="Default length"
            value={String(settings.defaultDuration)}
            onChange={(value) => setSettings((current) => ({ ...current, defaultDuration: Number(value) }))}
            options={CAMPAIGN_DURATIONS.map((item) => ({ label: item.label, value: String(item.days) }))}
          />
          <Field label="Default posting time" value={settings.defaultPostingTime} onChangeText={(value) => setSettings((current) => ({ ...current, defaultPostingTime: value }))} placeholder="18:00" />
          <View className="flex-row flex-wrap gap-2">
            {PLATFORMS.map((platform) => (
              <Chip key={platform.id} label={platform.label} selected={settings.defaultPlatforms.includes(platform.id)} onPress={() => togglePlatform(platform.id)} />
            ))}
          </View>
        </Card>
        <Card className="gap-3">
          <P className="font-semibold">Video preferences</P>
          <Muted>These defaults are stored for when you render on the web studio.</Muted>
          <SelectField
            label="Default template"
            value={settings.defaultTemplate}
            onChange={(value) => setSettings((current) => ({ ...current, defaultTemplate: value }))}
            options={VIDEO_TEMPLATES_LIST.map((item) => ({ label: item, value: item }))}
          />
          <Field
            label="Default duration (seconds)"
            value={String(settings.defaultVideoDuration)}
            onChangeText={(value) => setSettings((current) => ({ ...current, defaultVideoDuration: Number(value) || 15 }))}
            keyboardType="number-pad"
          />
        </Card>
        <Card className="gap-2">
          <P className="font-semibold">Appearance</P>
          <Muted>Light and dark follow the device. Brand purple and pink stay the same in both.</Muted>
        </Card>
        <Card className="gap-3">
          <P className="font-semibold">Notifications</P>
          {(
            [
              ["campaignReady", "Campaign generation complete"],
              ["weeklyReport", "Weekly performance summary"],
              ["performanceTips", "AI performance tips"],
            ] as const
          ).map(([key, label]) => (
            <View key={key} className="flex-row items-center justify-between">
              <Muted>{label}</Muted>
              <Switch
                value={settings.notifications[key]}
                onValueChange={(checked) =>
                  setSettings((current) => ({ ...current, notifications: { ...current.notifications, [key]: checked } }))
                }
              />
            </View>
          ))}
        </Card>
        <Button
          label="Save settings"
          onPress={async () => {
            await saveSettings(settings);
            toast({ title: "Settings saved" });
          }}
        />
      </View>
    </Screen>
  );
}
