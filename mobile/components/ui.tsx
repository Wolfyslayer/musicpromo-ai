import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { statusMeta } from "@/lib/constants";

export function Screen({ children }: { children: React.ReactNode }) {
  return (
    <SafeAreaView className="flex-1 bg-background" edges={["left", "right", "bottom"]}>
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function H1({ children }: { children: React.ReactNode }) {
  return <Text className="font-heading text-3xl text-foreground">{children}</Text>;
}

export function H2({ children }: { children: React.ReactNode }) {
  return <Text className="font-heading text-lg text-foreground">{children}</Text>;
}

export function P({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <Text className={`font-sans text-sm text-foreground ${className}`}>{children}</Text>;
}

export function Muted({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <Text className={`font-sans text-sm text-muted-foreground ${className}`}>{children}</Text>;
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <View className={`rounded-2xl border border-border bg-card p-4 ${className}`}>{children}</View>;
}

export function Button({
  label,
  onPress,
  disabled,
  loading,
  variant = "primary",
}: {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: "primary" | "outline" | "ghost" | "destructive";
}) {
  const shell =
    variant === "primary"
      ? "bg-primary"
      : variant === "destructive"
        ? "bg-destructive"
        : variant === "outline"
          ? "border border-border bg-card"
          : "bg-transparent";
  const text = variant === "primary" || variant === "destructive" ? "text-white" : "text-foreground";
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      className={`min-h-12 flex-row items-center justify-center rounded-full px-4 ${shell} ${disabled || loading ? "opacity-60" : ""}`}
    >
      {loading ? <ActivityIndicator color={variant === "outline" || variant === "ghost" ? "#a164f7" : "#fff"} /> : <Text className={`font-sans text-sm font-semibold ${text}`}>{label}</Text>}
    </Pressable>
  );
}

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType,
  autoCapitalize = "none",
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: TextInputProps["keyboardType"];
  autoCapitalize?: TextInputProps["autoCapitalize"];
  multiline?: boolean;
}) {
  return (
    <View className="gap-1.5">
      <Text className="font-sans text-xs text-muted-foreground">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#94a3b8"
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        multiline={multiline}
        className={`rounded-xl border border-border bg-background px-3 font-sans text-sm text-foreground ${multiline ? "min-h-28 py-3" : "h-12"}`}
      />
    </View>
  );
}

export function SelectField({
  label,
  value,
  options,
  onChange,
  placeholder = "Select",
}: {
  label: string;
  value: string;
  options: { label: string; value: string }[];
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);
  return (
    <View className="gap-1.5">
      <Text className="font-sans text-xs text-muted-foreground">{label}</Text>
      <Pressable onPress={() => setOpen(true)} className="h-12 justify-center rounded-xl border border-border bg-background px-3">
        <Text className={`font-sans text-sm ${selected ? "text-foreground" : "text-muted-foreground"}`}>
          {selected?.label || placeholder}
        </Text>
      </Pressable>
      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <Pressable className="flex-1 justify-end bg-black/40" onPress={() => setOpen(false)}>
          <Pressable className="max-h-[70%] rounded-t-3xl bg-card p-4" onPress={() => {}}>
            <Text className="mb-3 font-heading text-lg text-foreground">{label}</Text>
            <ScrollView>
              {options.map((option) => (
                <Pressable
                  key={option.value}
                  className="min-h-12 justify-center border-b border-border"
                  onPress={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                >
                  <Text className={`font-sans text-base ${option.value === value ? "text-primary" : "text-foreground"}`}>{option.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

export function Badge({ status }: { status?: string }) {
  const meta = statusMeta(status);
  return (
    <View className="self-start rounded-full bg-primary/15 px-2.5 py-1">
      <Text className="font-sans text-xs font-semibold text-primary">{meta.label}</Text>
    </View>
  );
}

export function Progress({ value }: { value: number }) {
  const width = Math.max(0, Math.min(100, value));
  return (
    <View className="h-2 overflow-hidden rounded-full bg-muted">
      <View className="h-2 rounded-full bg-primary" style={{ width: `${width}%` }} />
    </View>
  );
}

export function Empty({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <Card className="items-center gap-2 py-8">
      <Text className="font-heading text-lg text-foreground">{title}</Text>
      {description ? <Muted className="text-center">{description}</Muted> : null}
      {action}
    </Card>
  );
}

export function ErrorText({ children }: { children?: string }) {
  if (!children) return null;
  return <Text className="font-sans text-sm text-destructive">{children}</Text>;
}

export function Artwork({ uri, size = 72 }: { uri?: string | null; size?: number }) {
  if (!uri) {
    return <View className="items-center justify-center rounded-2xl bg-muted" style={{ width: size, height: size }} />;
  }
  return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: 16 }} />;
}

export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className={`rounded-full border px-3 py-2 ${selected ? "border-primary bg-primary/15" : "border-border"}`}
    >
      <Text className={`font-sans text-xs font-semibold ${selected ? "text-primary" : "text-muted-foreground"}`}>{label}</Text>
    </Pressable>
  );
}

export function Loading() {
  return (
    <View className="flex-1 items-center justify-center bg-background">
      <ActivityIndicator color="#a164f7" />
    </View>
  );
}
