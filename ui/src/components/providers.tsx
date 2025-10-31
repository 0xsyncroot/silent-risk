'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { PrivyProvider } from '@privy-io/react-auth';
import { privyConfig, getPrivyAppId } from '@/lib/privy';
import { config } from '@/lib/wagmi';
import { NotificationProvider } from '@/contexts/NotificationContext';

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PrivyProvider
      appId={getPrivyAppId()}
      config={privyConfig}
    >
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={config}>
          <NotificationProvider>
            {children}
          </NotificationProvider>
        </WagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  );
}
