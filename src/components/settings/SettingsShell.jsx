import { Navigate, Outlet, useOutletContext } from "react-router-dom";
import SectionNavMenu from "@/components/navigation/SectionNavMenu";
import { SETTINGS_SECTIONS } from "@/lib/settingsNav";
import { useEffect, useMemo, useState } from "react";
import { useToast } from "@/components/ui/use-toast";
import { getSettings, saveSettings, applyTheme, DEFAULT_SETTINGS } from "@/services/settings";
import { PLATFORMS } from "@/services/constants";
import { Button } from "@/components/ui/button";
import PageHeader from "@/components/PageHeader";

export function useSettingsOutlet() {
  return useOutletContext();
}

function SettingsShellInner() {
  const { toast } = useToast();
  const [s, setS] = useState(DEFAULT_SETTINGS);

  useEffect(() => {
    setS(getSettings());
    applyTheme();
  }, []);

  const set = (k, v) => setS((p) => ({ ...p, [k]: v }));

  const togglePlatform = (id) => {
    setS((p) => {
      const has = p.defaultPlatforms.includes(id);
      return {
        ...p,
        defaultPlatforms: has ? p.defaultPlatforms.filter((x) => x !== id) : [...p.defaultPlatforms, id],
      };
    });
  };

  const save = () => {
    saveSettings(s);
    toast({ title: "Settings saved" });
  };

  const outletContext = useMemo(
    () => ({ s, set, save, togglePlatform, platforms: PLATFORMS }),
    [s]
  );

  return (
    <div className="space-y-4 pb-24 md:pb-8">
      <div className="glass-bar sticky top-0 z-20 -mx-4 space-y-3 border-b border-border/40 px-4 py-3 md:static md:mx-0 md:border-0 md:bg-transparent md:px-0 md:py-0">
        <PageHeader title="Settings" description="Account, defaults, and notifications." className="!animate-none" />
        <SectionNavMenu basePath="/settings" sections={SETTINGS_SECTIONS} />
      </div>

      <Outlet context={outletContext} />

      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-border/60 bg-background/95 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur md:static md:border-0 md:bg-transparent md:p-0 md:pb-0">
        <Button onClick={save} className="w-full rounded-full md:w-auto">
          Save settings
        </Button>
      </div>
    </div>
  );
}

export default function SettingsShell() {
  return <SettingsShellInner />;
}

export function SettingsIndexRedirect() {
  return <Navigate to="/settings/account" replace />;
}
