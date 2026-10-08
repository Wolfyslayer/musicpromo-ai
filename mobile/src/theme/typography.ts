import { TextStyle } from "react-native";

/** System UI fonts — matches web SF Pro / system stack, native-friendly. */
export const typography = {
  display: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "700",
    letterSpacing: -0.4,
  } satisfies TextStyle,
  title: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "700",
    letterSpacing: -0.3,
  } satisfies TextStyle,
  heading: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "600",
  } satisfies TextStyle,
  body: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "400",
  } satisfies TextStyle,
  bodyStrong: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "600",
  } satisfies TextStyle,
  caption: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "400",
  } satisfies TextStyle,
  label: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "500",
  } satisfies TextStyle,
} as const;
