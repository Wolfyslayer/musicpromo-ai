import { Share2 } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { deleteAccount } from "@/services/userProfile";
import { useToast } from "@/components/ui/use-toast";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CAMPAIGN_DURATIONS, VIDEO_TEMPLATES_LIST } from "@/services/constants";
import { useSettingsOutlet } from "@/components/settings/SettingsShell";

export function SettingsAccountPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  const runDelete = async () => {
    if (confirmText !== "DELETE") return;
    setDeleting(true);
    try {
      await deleteAccount();
      toast({ title: "Account deleted" });
      await logout(true);
    } catch (e) {
      toast({ variant: "destructive", title: "Deletion failed", description: e.message });
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
      setConfirmText("");
    }
  };

  return (
    <div className="space-y-4">
      <Card title="Account">
        <Row label="Name" value={user?.full_name || "—"} />
        <Row label="Email" value={user?.email || "—"} />
        <Row label="Role" value={user?.role || "—"} />
        <div className="pt-2">
          <Button variant="outline" className="rounded-full" asChild>
            <Link to="/profile">Open profile</Link>
          </Button>
        </div>
      </Card>
      <Card title="Social Accounts">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-600">Manage connected platforms</p>
            <p className="text-xs text-muted-foreground">
              Open the Social Hub to connect Instagram, TikTok, and YouTube.
            </p>
          </div>
          <Button
            variant="outline"
            className="min-h-10 shrink-0 rounded-full"
            onClick={() => navigate("/social/connect")}
          >
            <Share2 className="mr-1.5 h-3.5 w-3.5" /> Open Social Hub
          </Button>
        </div>
      </Card>
      <Card title="Legal">
        <div className="flex flex-wrap gap-3 text-sm">
          <a href="/privacy" className="text-primary underline-offset-4 hover:underline" target="_blank" rel="noreferrer">
            Privacy Policy
          </a>
          <a href="/terms" className="text-primary underline-offset-4 hover:underline" target="_blank" rel="noreferrer">
            Terms of Service
          </a>
        </div>
      </Card>

      <Card title="Delete account">
        <p className="text-sm text-muted-foreground">
          Permanently removes your campaigns, media, social connections, and sign-in. This cannot be undone.
        </p>
        <Button
          type="button"
          variant="destructive"
          className="mt-3 rounded-full"
          onClick={() => setDeleteOpen(true)}
        >
          Delete my account
        </Button>
      </Card>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete account permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              Type <strong>DELETE</strong> to confirm. All workspace data and your login will be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="DELETE"
            className="rounded-xl"
            autoComplete="off"
          />
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={confirmText !== "DELETE" || deleting}
              onClick={runDelete}
            >
              {deleting ? "Deleting…" : "Delete forever"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function SettingsStudioPage() {
  const { s, set, togglePlatform, platforms } = useSettingsOutlet();

  return (
    <div className="space-y-4">
      <Card title="AI Preferences">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">AI Provider</Label>
          <Select value={s.aiProvider} onValueChange={(v) => set("aiProvider", v)}>
            <SelectTrigger className="rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Base44 InvokeLLM (default)">Base44 InvokeLLM (default)</SelectItem>
              <SelectItem value="custom">Custom endpoint (configure after export)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card title="Default Campaign">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Default length</Label>
            <Select value={String(s.defaultDuration)} onValueChange={(v) => set("defaultDuration", Number(v))}>
              <SelectTrigger className="rounded-xl">
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
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Default posting time</Label>
            <Input
              type="time"
              value={s.defaultPostingTime}
              onChange={(e) => set("defaultPostingTime", e.target.value)}
              className="rounded-xl"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Default platforms</Label>
          <div className="flex flex-wrap gap-2">
            {platforms.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => togglePlatform(p.id)}
                className={`rounded-full border px-3 py-1.5 text-xs font-500 transition ${
                  s.defaultPlatforms.includes(p.id)
                    ? "border-primary/40 bg-primary/15 text-primary"
                    : "border-border text-muted-foreground"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      <Card title="Video Preferences">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Default template</Label>
            <Select value={s.defaultTemplate} onValueChange={(v) => set("defaultTemplate", v)}>
              <SelectTrigger className="rounded-xl">
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
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Default duration (seconds)</Label>
            <Input
              type="number"
              min={5}
              max={60}
              value={s.defaultVideoDuration}
              onChange={(e) => set("defaultVideoDuration", Number(e.target.value))}
              className="rounded-xl"
            />
          </div>
        </div>
      </Card>
    </div>
  );
}

export function SettingsPreferencesPage() {
  const { s, set } = useSettingsOutlet();

  return (
    <div className="space-y-4">
      <Card title="Setup tour">
        <p className="text-sm text-muted-foreground">
          Replay the first-login walkthrough for connecting social accounts and creating your first campaign.
        </p>
        <Button
          type="button"
          variant="outline"
          className="mt-2 rounded-full"
          onClick={() => window.dispatchEvent(new CustomEvent("musicpromo:show-onboarding-tutorial"))}
        >
          Show setup tour
        </Button>
      </Card>

      <Card title="Appearance">
        <p className="text-sm font-600">Matches your device</p>
        <p className="text-xs text-muted-foreground">
          Light and dark follow the system setting. Brand purple and pink stay the same in both.
        </p>
      </Card>

      <Card title="Notifications">
        {Object.entries({
          campaignReady: "Campaign generation complete",
          weeklyReport: "Weekly performance summary",
          performanceTips: "AI performance tips",
        }).map(([k, label]) => (
          <div key={k} className="flex items-center justify-between py-2">
            <span className="text-sm">{label}</span>
            <Switch
              checked={!!s.notifications[k]}
              onCheckedChange={(c) => set("notifications", { ...s.notifications, [k]: c })}
            />
          </div>
        ))}
      </Card>
    </div>
  );
}

function Card({ title, children }) {
  return (
    <div className="surface space-y-4 rounded-2xl p-5">
      <h2 className="font-heading text-sm font-600 uppercase tracking-wider text-muted-foreground">{title}</h2>
      {children}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-500">{value}</span>
    </div>
  );
}
