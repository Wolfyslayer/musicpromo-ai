import { QueryClient } from "@tanstack/react-query";

/** RN-tuned React Query — refetch on reconnect, not window focus. */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      staleTime: 30_000,
    },
    mutations: {
      retry: 0,
    },
  },
});
