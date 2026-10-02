import { View } from "react-native";
import { Image } from "expo-image";
import { Image as ImageIcon } from "lucide-react-native";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";

export default function ArtworkImage({ src, className = "", rounded = "rounded-2xl" }) {
  if (!src) {
    return (
      <View className={cn("items-center justify-center bg-muted/60", rounded, className)}>
        <Icon as={ImageIcon} size={28} className="text-muted-foreground/50" />
      </View>
    );
  }
  return (
    <View className={cn("overflow-hidden bg-muted/60", rounded, className)}>
      <Image source={{ uri: src }} contentFit="cover" transition={150} style={{ width: "100%", height: "100%" }} />
    </View>
  );
}
