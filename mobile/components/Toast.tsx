import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { Text, View } from "react-native";

type ToastMessage = { title: string; description?: string; variant?: "default" | "destructive" };

const ToastContext = createContext<{ toast: (message: ToastMessage) => void } | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState<ToastMessage | null>(null);

  const toast = useCallback((next: ToastMessage) => {
    setMessage(next);
    setTimeout(() => setMessage((current) => (current === next ? null : current)), 2800);
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {message ? (
        <View className="absolute bottom-8 left-4 right-4 rounded-2xl border border-border bg-card px-4 py-3" pointerEvents="none">
          <Text className={`font-sans text-sm font-semibold ${message.variant === "destructive" ? "text-destructive" : "text-foreground"}`}>
            {message.title}
          </Text>
          {message.description ? <Text className="mt-1 font-sans text-xs text-muted-foreground">{message.description}</Text> : null}
        </View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within a ToastProvider");
  return context;
}
