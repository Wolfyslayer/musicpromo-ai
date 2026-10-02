import { Modal, Pressable, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';

export default function ConfirmDialog({
  open,
  onOpenChange,
  title = 'Are you sure?',
  description,
  confirmLabel = 'Confirm',
  onConfirm,
  destructive,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  onConfirm: () => void;
  destructive?: boolean;
}) {
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => onOpenChange(false)}>
      <View className="flex-1 items-center justify-center bg-black/50 px-6">
        <View className="w-full max-w-md rounded-2xl border border-border bg-card p-5">
          <Text className="text-lg font-semibold text-foreground">{title}</Text>
          {description ? (
            typeof description === 'string' ? (
              <Text className="mt-2 text-sm text-muted-foreground">{description}</Text>
            ) : (
              <View className="mt-2">{description}</View>
            )
          ) : null}
          <View className="mt-5 flex-row justify-end gap-2">
            <Button variant="ghost" label="Cancel" onPress={() => onOpenChange(false)} />
            <Button
              variant={destructive ? 'destructive' : 'default'}
              label={confirmLabel}
              onPress={() => {
                onConfirm();
                onOpenChange(false);
              }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}
