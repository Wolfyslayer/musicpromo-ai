import { Modal, ScrollView, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';

export function Dialog({
  open,
  onOpenChange,
  children,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}) {
  const visible = open !== false;
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={() => onOpenChange?.(false)}>
      <View className="flex-1 justify-end bg-black/40">{children}</View>
    </Modal>
  );
}

export function DialogContent({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <ScrollView className="max-h-[85%] rounded-t-3xl bg-card p-5" contentContainerClassName="gap-4">
      {children}
    </ScrollView>
  );
}

export function DialogHeader({ children }: { children: React.ReactNode }) {
  return <View>{children}</View>;
}

export function DialogTitle({ children }: { children: React.ReactNode }) {
  return <Text className="text-lg font-semibold text-foreground">{children}</Text>;
}

export function DialogFooter({ children }: { children: React.ReactNode }) {
  return <View className="flex-row justify-end gap-2 pt-2">{children}</View>;
}
