import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { deleteRelease } from "@/services/data";

/**
 * Confirmed delete for a release (catalog row only — songs unlinked, campaigns kept).
 */
export default function ReleaseDeleteDialog({
  releaseId,
  releaseTitle,
  songsCount = 0,
  campaignsCount = 0,
  onDeleted,
  triggerVariant = "outline",
  triggerSize = "sm",
  triggerClassName = "rounded-full",
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const runDelete = async () => {
    setBusy(true);
    try {
      await deleteRelease(releaseId);
      setOpen(false);
      onDeleted?.();
    } catch (e) {
      onDeleted?.(e);
    } finally {
      setBusy(false);
    }
  };

  const title = releaseTitle?.trim() || "this release";

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button type="button" variant={triggerVariant} size={triggerSize} className={triggerClassName}>
          <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="rounded-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete release?</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2 text-sm leading-relaxed">
            <span className="block">
              <strong>{title}</strong> will be removed from your catalog.
            </span>
            {songsCount > 0 ? (
              <span className="block">
                {songsCount} song{songsCount === 1 ? "" : "s"} will be unlinked from this release (not deleted).
              </span>
            ) : null}
            {campaignsCount > 0 ? (
              <span className="block">
                {campaignsCount} campaign{campaignsCount === 1 ? "" : "s"} will stay in your library but won&apos;t be
                tied to this release anymore.
              </span>
            ) : null}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
          <AlertDialogCancel className="rounded-full" disabled={busy}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={busy}
            onClick={(e) => {
              e.preventDefault();
              runDelete();
            }}
          >
            {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
            Delete release
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
