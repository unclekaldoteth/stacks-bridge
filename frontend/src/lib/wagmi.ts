'use client';

import { createConfig, http } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';
import { injected, walletConnect } from 'wagmi/connectors';

// WalletConnect Project ID (get from https://cloud.walletconnect.com)
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'demo';

export const wagmiConfig = createConfig({
    chains: [baseSepolia],
    connectors: [
        injected(),
        walletConnect({ projectId }),
    ],
    transports: {
        [baseSepolia.id]: http(process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://sepolia.base.org'),
    },
});
