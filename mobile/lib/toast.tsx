import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

type ToastItem = { id: number; title: string; description?: string };

const ToastContext = createContext<(item: Omit<ToastItem, 'id'>) => void>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const toast = useCallback((item: Omit<ToastItem, 'id'>) => {
    const id = Date.now();
    setItems((prev) => [...prev, { ...item, id }]);
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);

  const value = useMemo(() => toast, [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <View className="pointer-events-none absolute bottom-24 left-0 right-0 z-50 items-center gap-2 px-4">
        {items.map((t) => (
          <Pressable key={t.id} className="max-w-sm rounded-xl border border-border bg-card px-4 py-3 shadow-lg">
            <Text className="font-semibold text-foreground">{t.title}</Text>
            {t.description ? (
              <Text className="mt-1 text-sm text-muted-foreground">{t.description}</Text>
            ) : null}
          </Pressable>
        ))}
      </View>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const toast = useContext(ToastContext);
  return { toast: (opts: { title: string; description?: string }) => toast(opts) };
}
