import { Share2, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { loadCampaigns } from "@/services/data";
import { resetReleaseLaunchTour } from "@/services/releaseLaunchTour";
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
import { useWorkspace } from "@/lib/workspaceContext";
import {
  createWorkspaceStudio,
  inviteWorkspaceStudioMember,
  listWorkspaceStudios,
  removeWorkspaceStudioMember,
} from "@/services/workspaceService";

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

export function SettingsTeamPage() {
  const { toast } = useToast();
  const { managedOwnerId, setManagedWorkspace, clearManagedWorkspace } = useWorkspace();
  const [loading, setLoading] = useState(true);
  const [studios, setStudios] = useState([]);
  const [memberships, setMemberships] = useState([]);
  const [newStudioName, setNewStudioName] = useState("");
  const [creating, setCreating] = useState(false);
  const [inviteEmail, setInviteEmail] = useState({});
  const [busy, setBusy] = useState(null);

  const reload = async () => {
    setLoading(true);
    try {
      const data = await listWorkspaceStudios();
      setStudios(data.studios);
      setMemberships(data.memberships);
    } catch (e) {
      toast({ variant: "destructive", title: "Team load failed", description: e.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, []);

  const ownedStudios = studios.filter((s) => memberships.some((m) => m.studioId === s.id && m.isOwnStudio));
  const managedOptions = memberships.filter((m) => !m.isOwnStudio);

  const runCreate = async () => {
    const name = newStudioName.trim();
    if (name.length < 2) return;
    setCreating(true);
    try {
      await createWorkspaceStudio(name);
      setNewStudioName("");
      toast({ title: "Studio created" });
      await reload();
    } catch (e) {
      toast({ variant: "destructive", title: "Could not create studio", description: e.message });
    } finally {
      setCreating(false);
    }
  };

  const runInvite = async (studioId) => {
    const email = String(inviteEmail[studioId] || "").trim();
    if (!email) return;
    setBusy(`invite-${studioId}`);
    try {
      await inviteWorkspaceStudioMember(studioId, email);
      setInviteEmail((p) => ({ ...p, [studioId]: "" }));
      toast({ title: "Manager invited" });
      await reload();
    } catch (e) {
      toast({ variant: "destructive", title: "Invite failed", description: e.message });
    } finally {
      setBusy(null);
    }
  };

  const runRemove = async (studioId, memberUserId) => {
    setBusy(`remove-${memberUserId}`);
    try {
      await removeWorkspaceStudioMember(studioId, memberUserId);
      toast({ title: "Member removed" });
      await reload();
    } catch (e) {
      toast({ variant: "destructive", title: "Remove failed", description: e.message });
    } finally {
      setBusy(null);
    }
  };

  const switchWorkspace = async (ownerUserId, label) => {
    try {
      if (!ownerUserId) {
        clearManagedWorkspace();
        toast({ title: "Back to your workspace" });
      } else {
        await setManagedWorkspace(ownerUserId, label);
        toast({ title: "Workspace switched", description: label });
      }
      window.location.assign("/");
    } catch (e) {
      toast({ variant: "destructive", title: "Switch failed", description: e.message });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card title="Switch workspace">
        <p className="text-sm text-muted-foreground">
          Managers can open an artist&apos;s campaigns, releases, and analytics. Owners invite by email (account must
          exist).
        </p>
        <div className="flex flex-wrap gap-2 pt-2">
          <Button
            type="button"
            variant={!managedOwnerId ? "default" : "outline"}
            className="rounded-full"
            onClick={() => switchWorkspace(null, "")}
          >
            My workspace
          </Button>
          {managedOptions.map((m) => (
            <Button
              key={m.studioId}
              type="button"
              variant={managedOwnerId === m.ownerId ? "default" : "outline"}
              className="rounded-full"
              onClick={() => switchWorkspace(m.ownerId, m.ownerLabel || m.studioName)}
            >
              {m.ownerLabel || m.studioName}
            </Button>
          ))}
        </div>
      </Card>

      <Card title="Create studio team">
        <p className="text-sm text-muted-foreground">Name your roster (up to 3 owned studios, 10 members each).</p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1.5">
            <Label className="text-xs text-muted-foreground">Studio name</Label>
            <Input
              value={newStudioName}
              onChange={(e) => setNewStudioName(e.target.value)}
              placeholder="Night Shift Collective"
              className="rounded-xl"
            />
          </div>
          <Button type="button" className="rounded-full" disabled={creating} onClick={runCreate}>
            {creating ? "Creating…" : "Create studio"}
          </Button>
        </div>
      </Card>

      {ownedStudios.map((studio) => (
        <Card key={studio.id} title={studio.name}>
          <p className="text-xs text-muted-foreground">Managers can edit campaigns and schedule posts for you.</p>
          <ul className="divide-y divide-border/50 rounded-xl border border-border/50 text-sm">
            {(studio.members || []).map((member) => (
              <li key={member.userId} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <span>
                  {member.displayName}
                  {member.email ? ` · ${member.email}` : ""}
                  <span className="ml-2 text-xs capitalize text-muted-foreground">{member.role}</span>
                </span>
                {member.role === "manager" ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="rounded-full"
                    disabled={busy === `remove-${member.userId}`}
                    onClick={() => runRemove(studio.id, member.userId)}
                  >
                    Remove
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
          <div className="flex flex-col gap-2 pt-3 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1.5">
              <Label className="text-xs text-muted-foreground">Invite manager (email)</Label>
              <Input
                type="email"
                value={inviteEmail[studio.id] || ""}
                onChange={(e) => setInviteEmail((p) => ({ ...p, [studio.id]: e.target.value }))}
                placeholder="manager@label.com"
                className="rounded-xl"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              disabled={busy === `invite-${studio.id}`}
              onClick={() => runInvite(studio.id)}
            >
              Send invite
            </Button>
          </div>
        </Card>
      ))}

      {!ownedStudios.length && !managedOptions.length ? (
        <p className="text-sm text-muted-foreground">Create a studio to invite managers, or ask an artist to invite you.</p>
      ) : null}
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
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [campaignRows, setCampaignRows] = useState(null);
  const [launchReleaseId, setLaunchReleaseId] = useState("");

  useEffect(() => {
    loadCampaigns()
      .then(setCampaignRows)
      .catch(() => setCampaignRows([]));
  }, []);

  const releaseOptions = useMemo(() => {
    const map = new Map();
    for (const c of campaignRows || []) {
      if (!c.release_id || !c.release) continue;
      if (!map.has(c.release_id)) {
        map.set(c.release_id, {
          id: c.release_id,
          title: c.release.title || c.name || "Release",
        });
      }
    }
    return Array.from(map.values());
  }, [campaignRows]);

  useEffect(() => {
    if (launchReleaseId || !releaseOptions.length) return;
    setLaunchReleaseId(releaseOptions[0].id);
  }, [launchReleaseId, releaseOptions]);

  const replayLaunchTour = () => {
    if (!user?.id || !launchReleaseId) {
      toast({
        variant: "destructive",
        title: "No release found",
        description: "Link a campaign to a release first, then replay the launch tour.",
      });
      return;
    }
    resetReleaseLaunchTour(user.id, launchReleaseId);
    navigate(`/releases/${launchReleaseId}/launch`);
    toast({ title: "Launch tour", description: "Opening your release command center…" });
  };

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

      <Card title="Release launch tour">
        <p className="text-sm text-muted-foreground">
          Replay the walkthrough for the release command center (timeline, checklist, quick post in the day drawer).
        </p>
        {releaseOptions.length ? (
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1.5">
              <Label className="text-xs text-muted-foreground">Release</Label>
              <Select value={launchReleaseId} onValueChange={setLaunchReleaseId}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Choose release" />
                </SelectTrigger>
                <SelectContent>
                  {releaseOptions.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="button" variant="outline" className="rounded-full" onClick={replayLaunchTour}>
              Replay launch tour
            </Button>
          </div>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">Create a campaign linked to a release to enable this tour.</p>
        )}
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
