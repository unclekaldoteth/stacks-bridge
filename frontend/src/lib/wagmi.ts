'use client';

import { cookieStorage, createStorage } from 'wagmi';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { base, baseSepolia, type AppKitNetwork } from '@reown/appkit/networks';

// WalletConnect Project ID (get from https://cloud.reown.com)
export const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '';

// Determine which chain to use based on environment
const isMainnet = process.env.NEXT_PUBLIC_NETWORK === 'mainnet';

// App metadata for WalletConnect
const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (typeof window !== 'undefined' ? window.location.origin : 'https://stacks-bridge.vercel.app');
const appIconUrl = process.env.NEXT_PUBLIC_APP_ICON_URL || `${appUrl}/icon.png`;

export const metadata = {
    name: 'Base⇄Stacks Bridge',
    description: 'Bridge USDC between Base and Stacks',
    url: appUrl,
    icons: [appIconUrl],
};

// Networks configuration - typed as AppKitNetwork array
export const networks: [AppKitNetwork, ...AppKitNetwork[]] = isMainnet ? [base] : [baseSepolia];

const mainnetRpcUrl =
    process.env.NEXT_PUBLIC_BASE_MAINNET_RPC_URL ||
    process.env.NEXT_PUBLIC_BASE_RPC_URL ||
    undefined;
const sepoliaRpcUrl =
    process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL ||
    process.env.NEXT_PUBLIC_BASE_RPC_URL ||
    undefined;

const customRpcUrls: Record<string, { url: string }[]> = {
    ...(mainnetRpcUrl ? { [`eip155:${base.id}`]: [{ url: mainnetRpcUrl }] } : {}),
    ...(sepoliaRpcUrl ? { [`eip155:${baseSepolia.id}`]: [{ url: sepoliaRpcUrl }] } : {}),
};

// Create Wagmi Adapter with Reown AppKit
export const wagmiAdapter = new WagmiAdapter({
    storage: createStorage({
        storage: cookieStorage,
    }),
    ssr: true,
    projectId,
    networks,
    customRpcUrls: Object.keys(customRpcUrls).length ? customRpcUrls : undefined,
});

// Export wagmi config for use with WagmiProvider
export const wagmiConfig = wagmiAdapter.wagmiConfig;
