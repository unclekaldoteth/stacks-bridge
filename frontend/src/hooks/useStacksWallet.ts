'use client';

import { useWallet } from '@/context/WalletContext';

export interface StacksWallet {
    address: string | null;
    isConnected: boolean;
    connect: () => void;
    disconnect: () => void;
    isLoading: boolean;
}

/**
 * Hook for Stacks wallet connection with WalletConnect support.
 * This is a wrapper around the WalletContext for backwards compatibility.
 */
export function useStacksWallet(): StacksWallet {
    const { isConnected, address, isLoading, connectWallet, disconnect } = useWallet();

    return {
        address,
        isConnected,
        connect: connectWallet,
        disconnect,
        isLoading,
    };
}
