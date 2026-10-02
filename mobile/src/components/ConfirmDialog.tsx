import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';

export default function ConfirmDialog({ open, onOpenChange, title = 'Are you sure?', description, confirmLabel = 'Confirm', onConfirm, destructive }: { open: boolean; onOpenChange: (o: boolean) => void; title?: string; description?: string; confirmLabel?: string; onConfirm: () => void; destructive?: boolean }) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="outline" onPress={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant={destructive ? 'destructive' : 'default'}
            onPress={() => {
              onOpenChange(false);
              onConfirm?.();
            }}>
            {confirmLabel}
          </Button>
        </>
      }
    />
  );
}
