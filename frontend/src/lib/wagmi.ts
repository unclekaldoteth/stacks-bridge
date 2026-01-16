'use client';

import { createBaseAccountSDK } from '@base-org/account';
import { createConfig, http } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';
import { custom, injected, walletConnect } from 'wagmi/connectors';

// WalletConnect Project ID (get from https://cloud.walletconnect.com)
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'demo';
const baseAccountAppName = process.env.NEXT_PUBLIC_BASE_ACCOUNT_APP_NAME || 'Stacks Bridge';

const baseAccountSDK = createBaseAccountSDK({
    appName: baseAccountAppName,
});

const baseAccountConnector = custom({
    id: 'base-account',
    name: 'Base Account',
    getProvider: () => baseAccountSDK.getProvider(),
    shimDisconnect: true,
});

export const wagmiConfig = createConfig({
    chains: [baseSepolia],
    connectors: [
        baseAccountConnector,
        injected(),
        walletConnect({ projectId }),
    ],
    transports: {
        [baseSepolia.id]: http(process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://sepolia.base.org'),
    },
});
