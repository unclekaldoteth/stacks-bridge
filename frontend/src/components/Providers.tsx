'use client';

import { WagmiConfig } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { wagmiConfig } from '@/lib/wagmi';
import { WalletProvider } from '@/context/WalletContext';
import { OnchainKitProvider } from '@coinbase/onchainkit';
import { base, baseSepolia } from 'wagmi/chains';

const queryClient = new QueryClient();
const onchainKitApiKey = process.env.NEXT_PUBLIC_ONCHAINKIT_API_KEY || undefined;
const onchainKitRpcUrl =
    process.env.NEXT_PUBLIC_ONCHAINKIT_RPC_URL ||
    process.env.NEXT_PUBLIC_BASE_RPC_URL ||
    undefined;
const onchainKitSchemaId =
    (process.env.NEXT_PUBLIC_ONCHAINKIT_SCHEMA_ID || undefined) as `0x${string}` | undefined;

// Determine chain based on environment
const isMainnet = process.env.NEXT_PUBLIC_NETWORK === 'mainnet';
const chain = isMainnet ? base : baseSepolia;

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <WagmiConfig config={wagmiConfig}>
            <QueryClientProvider client={queryClient}>
                <OnchainKitProvider
                    apiKey={onchainKitApiKey}
                    chain={chain}
                    rpcUrl={onchainKitRpcUrl}
                    schemaId={onchainKitSchemaId}
                >
                    <WalletProvider>
                        {children}
                    </WalletProvider>
                </OnchainKitProvider>
            </QueryClientProvider>
        </WagmiConfig>
    );
}
