import { KeyboardAvoidingView, Platform, ScrollView } from "react-native";

export function KeyboardAware({ children }: { children: React.ReactNode }) {
  return (
    <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1 }}>
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
