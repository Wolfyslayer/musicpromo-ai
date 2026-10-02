import "react-native-url-polyfill/auto";
import * as Crypto from "expo-crypto";
import { Platform } from "react-native";

if (typeof globalThis.crypto?.randomUUID !== "function") {
  globalThis.crypto = {
    ...(globalThis.crypto || {}),
    randomUUID: () => Crypto.randomUUID(),
  };
}

// react-native-gifted-charts reads Platform.constants.reactNativeVersion at import time,
// which react-native-web doesn't define.
if (Platform.OS === "web" && !Platform.constants?.reactNativeVersion) {
  Platform.constants = {
    ...(Platform.constants || {}),
    reactNativeVersion: { major: 0, minor: 86, patch: 0 },
  };
}
