import { useState } from "react";
import { Pressable } from "react-native";
import * as Clipboard from "expo-clipboard";
import { Check, Copy } from "lucide-react-native";
import { cn } from "@/lib/utils";
import { Text } from "@/components/ui/text";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";

export default function CopyButton({ text, label, className = "" }) {
  const [done, setDone] = useState(false);
  const { toast } = useToast();
  const copy = async () => {
    try {
      await Clipboard.setStringAsync(text || "");
      setDone(true);
      setTimeout(() => setDone(false), 1500);
    } catch {
      toast({ variant: "destructive", title: "Copy failed" });
    }
  };
  const tone = done ? "text-chart-2" : "text-muted-foreground";
  return (
    <Pressable
      onPress={copy}
      className={cn("min-h-8 flex-row items-center gap-1.5 self-start rounded-full px-3 py-1.5", done ? "bg-chart-2/15" : "bg-muted", className)}
    >
      <Icon as={done ? Check : Copy} size={14} className={tone} />
      <Text className={cn("text-xs font-500", tone)}>{done ? "Copied" : label || "Copy"}</Text>
    </Pressable>
  );
}
