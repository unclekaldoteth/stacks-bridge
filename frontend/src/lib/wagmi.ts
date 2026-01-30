'use client';

import { createConfig, http } from 'wagmi';
import { base, baseSepolia } from 'wagmi/chains';
import { injected, walletConnect, coinbaseWallet } from 'wagmi/connectors';

// WalletConnect Project ID (get from https://cloud.walletconnect.com)
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '';

// Determine which chain to use based on environment
const isMainnet = process.env.NEXT_PUBLIC_NETWORK === 'mainnet';

// WalletConnect metadata for better UX
const metadata = {
    name: 'Base⇄Stacks Bridge',
    description: 'Bridge USDC between Base and Stacks',
    url: typeof window !== 'undefined' ? window.location.origin : 'https://bridge.example.com',
    icons: ['https://base.org/icons/favicons/favicon-32x32.png'],
};

// RPC URLs
const mainnetRpc = process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://mainnet.base.org';
const testnetRpc = process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://sepolia.base.org';

export const wagmiConfig = createConfig({
    chains: isMainnet ? [base] : [baseSepolia],
    connectors: [
        injected(),
        walletConnect({
            projectId,
            metadata,
            showQrModal: true,
        }),
        coinbaseWallet({
            appName: metadata.name,
        }),
    ],
    transports: {
        [base.id]: http(mainnetRpc),
        [baseSepolia.id]: http(testnetRpc),
    },
});

