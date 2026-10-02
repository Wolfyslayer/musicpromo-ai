import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View } from "react-native";
import { X } from "lucide-react-native";
import { cn } from "@/lib/utils";
import { Text } from "./text";
import { Icon } from "./icon";
import { Button } from "./button";

/**
 * Centered modal card. Replaces the Radix Dialog / AlertDialog.
 * `footer` renders below the scrollable body so actions stay visible.
 */
export function Dialog({ open, onOpenChange, title, description, children, footer, className }) {
  const close = () => onOpenChange?.(false);
  return (
    <Modal visible={Boolean(open)} transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1">
        <View className="flex-1 items-center justify-center px-4">
          <Pressable className="absolute inset-0 bg-black/60" onPress={close} accessibilityLabel="Close" />
          <View className={cn("max-h-[85%] w-full max-w-md overflow-hidden rounded-2xl border border-border bg-popover", className)}>
            {title || description ? (
              <View className="flex-row items-start gap-3 border-b border-border/60 px-5 pb-3 pt-5">
                <View className="flex-1 gap-1">
                  {title ? <Text className="font-heading text-lg">{title}</Text> : null}
                  {description ? <Text className="text-sm text-muted-foreground">{description}</Text> : null}
                </View>
                <Pressable onPress={close} hitSlop={10} accessibilityLabel="Close">
                  <Icon as={X} size={18} className="text-muted-foreground" />
                </Pressable>
              </View>
            ) : null}
            {children ? (
              <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="gap-4 p-5">
                {children}
              </ScrollView>
            ) : null}
            {footer ? <View className="flex-row justify-end gap-2 border-t border-border/60 p-4">{footer}</View> : null}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title = "Are you sure?",
  description,
  confirmLabel = "Confirm",
  onConfirm,
  destructive,
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="outline" onPress={() => onOpenChange?.(false)}>
            Cancel
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            onPress={() => {
              onOpenChange?.(false);
              onConfirm?.();
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    />
  );
}
