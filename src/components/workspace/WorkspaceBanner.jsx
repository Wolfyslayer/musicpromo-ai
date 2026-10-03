import { Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/lib/workspaceContext";

export default function WorkspaceBanner() {
  const { isManagingOther, managedLabel, clearManagedWorkspace } = useWorkspace();

  if (!isManagingOther) return null;

  return (
    <div className="flex shrink-0 items-center justify-between gap-3 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2">
      <p className="flex items-center gap-2 text-xs text-foreground sm:text-sm">
        <Users className="h-4 w-4 text-amber-600" />
        Managing <span className="font-600">{managedLabel || "artist workspace"}</span> — campaigns and posts use their
        data. Connect social accounts from their login (not yours).
      </p>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-8 shrink-0 rounded-full border-amber-500/40"
        onClick={() => clearManagedWorkspace()}
      >
        <X className="mr-1 h-3.5 w-3.5" /> Back to mine
      </Button>
    </div>
  );
}
