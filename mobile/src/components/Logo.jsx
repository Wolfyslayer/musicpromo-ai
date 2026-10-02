import { View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Sparkles } from "lucide-react-native";
import { BRAND_GRADIENT } from "@/lib/theme";
import { Text } from "@/components/ui/text";

export default function Logo({ size = 28, withWord = true }) {
  return (
    <View className="flex-row items-center gap-2.5">
      <LinearGradient
        colors={BRAND_GRADIENT}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ width: size, height: size, borderRadius: size * 0.36, alignItems: "center", justifyContent: "center" }}
      >
        <Sparkles size={size * 0.5} color="#fff" strokeWidth={2.5} />
      </LinearGradient>
      {withWord ? (
        <Text className="font-heading text-base tracking-tight">
          MusicPromo<Text className="font-heading text-base text-accent"> AI</Text>
        </Text>
      ) : null}
    </View>
  );
}
