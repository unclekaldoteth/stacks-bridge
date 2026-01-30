'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider, type State } from 'wagmi';
import { createAppKit } from '@reown/appkit/react';
import { wagmiAdapter, projectId, metadata, networks } from '@/lib/wagmi';
import { WalletProvider } from '@/context/WalletContext';
import { OnchainKitProvider } from '@coinbase/onchainkit';
import { base, baseSepolia } from 'wagmi/chains';

const queryClient = new QueryClient();

// OnchainKit configuration
const onchainKitApiKey = process.env.NEXT_PUBLIC_ONCHAINKIT_API_KEY || undefined;
const onchainKitMainnetRpcUrl =
    process.env.NEXT_PUBLIC_ONCHAINKIT_MAINNET_RPC_URL ||
    process.env.NEXT_PUBLIC_ONCHAINKIT_RPC_URL ||
    process.env.NEXT_PUBLIC_BASE_MAINNET_RPC_URL ||
    process.env.NEXT_PUBLIC_BASE_RPC_URL ||
    undefined;
const onchainKitTestnetRpcUrl =
    process.env.NEXT_PUBLIC_ONCHAINKIT_SEPOLIA_RPC_URL ||
    process.env.NEXT_PUBLIC_ONCHAINKIT_RPC_URL ||
    process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL ||
    process.env.NEXT_PUBLIC_BASE_RPC_URL ||
    undefined;
const onchainKitSchemaId =
    (process.env.NEXT_PUBLIC_ONCHAINKIT_SCHEMA_ID || undefined) as `0x${string}` | undefined;

// Determine chain based on environment
const isMainnet = process.env.NEXT_PUBLIC_NETWORK === 'mainnet';
const chain = isMainnet ? base : baseSepolia;
const onchainKitRpcUrl = isMainnet ? onchainKitMainnetRpcUrl : onchainKitTestnetRpcUrl;

// Create Reown AppKit modal
if (projectId) {
    createAppKit({
        adapters: [wagmiAdapter],
        networks,
        projectId,
        metadata,
        features: {
            analytics: true,
        },
    });
}

interface ProvidersProps {
    children: React.ReactNode;
    initialState?: State;
}

export function Providers({ children, initialState }: ProvidersProps) {
    return (
        <WagmiProvider config={wagmiAdapter.wagmiConfig} initialState={initialState}>
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
        </WagmiProvider>
    );
}
