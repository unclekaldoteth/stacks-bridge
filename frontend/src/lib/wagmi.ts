'use client';

import { cookieStorage, createStorage } from 'wagmi';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { base, baseSepolia, type AppKitNetwork } from '@reown/appkit/networks';

// WalletConnect Project ID (get from https://cloud.reown.com)
export const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '';

// Determine which chain to use based on environment
const isMainnet = process.env.NEXT_PUBLIC_NETWORK === 'mainnet';

// App metadata for WalletConnect
export const metadata = {
    name: 'Base⇄Stacks Bridge',
    description: 'Bridge USDC between Base and Stacks',
    url: 'https://stacks-bridge.vercel.app',
    icons: ['https://stacks-bridge.vercel.app/icon.png'],
};

// Networks configuration - typed as AppKitNetwork array
export const networks: [AppKitNetwork, ...AppKitNetwork[]] = isMainnet ? [base] : [baseSepolia];

// Create Wagmi Adapter with Reown AppKit
export const wagmiAdapter = new WagmiAdapter({
    storage: createStorage({
        storage: cookieStorage,
    }),
    ssr: true,
    projectId,
    networks,
});

// Export wagmi config for use with WagmiProvider
export const wagmiConfig = wagmiAdapter.wagmiConfig;
