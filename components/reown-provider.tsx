"use client";

import { wagmiAdapter } from "@/lib/reown";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { useEffect } from "react";

const queryClient = new QueryClient();

export function ReownProvider({ children }: { children: React.ReactNode }) {
  // Initialize AppKit lazily on the client only
  useEffect(() => {
    import("@/lib/reown").then(({ getModal }) => getModal());
  }, []);

  return (
    <WagmiProvider config={wagmiAdapter.wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
