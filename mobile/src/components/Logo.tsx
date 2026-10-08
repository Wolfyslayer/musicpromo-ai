import { Image, StyleSheet, View } from "react-native";
import { Text } from "@/components/ui/Text";
import { useAppTheme } from "@/theme/ThemeProvider";

type Props = {
  size?: number;
  withWord?: boolean;
};

export function Logo({ size = 44, withWord = false }: Props) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.row} accessibilityRole="image" accessibilityLabel="MusicPromo AI">
      <Image
        source={require("../../assets/images/musicpromo-ai-icon.png")}
        style={{ width: size, height: size, borderRadius: 12 }}
        resizeMode="cover"
      />
      {withWord ? (
        <Text variant="heading">
          MusicPromo
          <Text variant="heading" color={colors.primary}>
            {" "}
            AI
          </Text>
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
});
