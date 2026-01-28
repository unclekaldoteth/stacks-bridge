'use client';

import { useWallet } from '@/context/WalletContext';

export interface BurnResult {
    txId: string;
    status: 'pending' | 'success' | 'error';
    message?: string;
}

export interface StacksWallet {
    address: string | null;
    isConnected: boolean;
    connect: () => void;
    disconnect: () => void;
    isLoading: boolean;
    isBurning: boolean;
    burnResult: BurnResult | null;
    burnTokens: (amount: string, baseAddress: string) => Promise<void>;
    clearBurnResult: () => void;
}

/**
 * Hook for Stacks wallet connection with burn transaction support.
 */
export function useStacksWallet(): StacksWallet {
    const {
        isConnected,
        address,
        isLoading,
        isBurning,
        burnResult,
        connectWallet,
        disconnect,
        burnTokens,
        clearBurnResult,
    } = useWallet();

    return {
        address,
        isConnected,
        connect: connectWallet,
        disconnect,
        isLoading,
        isBurning,
        burnResult,
        burnTokens,
        clearBurnResult,
    };
}
