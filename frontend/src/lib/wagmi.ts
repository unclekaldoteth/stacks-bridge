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
        [baseSepolia.id]: http('https://base-sepolia.g.alchemy.com/v2/poHXZbv0T2Q6sgplkdhqf'),
    },
});
