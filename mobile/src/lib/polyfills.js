import "react-native-url-polyfill/auto";
import * as Crypto from "expo-crypto";

if (typeof globalThis.crypto?.randomUUID !== "function") {
  globalThis.crypto = {
    ...(globalThis.crypto || {}),
    randomUUID: () => Crypto.randomUUID(),
  };
}
