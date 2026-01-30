'use client';

import { useEffect } from 'react';
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

interface ProvidersProps {
    children: React.ReactNode;
    initialState?: State;
}

// Global AppKit state
const appKitGlobal = globalThis as typeof globalThis & {
    __appKitInitialized?: boolean;
    __appKitModal?: ReturnType<typeof createAppKit>;
};

// Export function to open modal from anywhere
export function openAppKitModal() {
    if (appKitGlobal.__appKitModal) {
        appKitGlobal.__appKitModal.open();
    } else {
        console.warn('AppKit not initialized yet');
    }
}

export function Providers({ children, initialState }: ProvidersProps) {
    useEffect(() => {
        // Initialize AppKit on client-side only
        if (!projectId) {
            console.warn('⚠️ Missing NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID');
        } else if (!appKitGlobal.__appKitInitialized) {
            try {
                const modal = createAppKit({
                    adapters: [wagmiAdapter],
                    networks,
                    projectId,
                    metadata,
                    features: {
                        analytics: true,
                    },
                });
                appKitGlobal.__appKitInitialized = true;
                appKitGlobal.__appKitModal = modal;
                console.log('✅ AppKit initialized with projectId:', projectId.slice(0, 8) + '...');
            } catch (error) {
                console.error('❌ Failed to initialize AppKit:', error);
            }
        }
    }, []);

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
