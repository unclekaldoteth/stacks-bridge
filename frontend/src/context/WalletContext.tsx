'use client';

import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { parseUnits } from 'viem';
import { WALLETCONNECT_PROJECT_ID, NETWORK } from '@/config';
import { config } from '@/lib/config';

interface BurnResult {
    txId: string;
    status: 'pending' | 'success' | 'error';
    message?: string;
}

interface WalletContextType {
    isConnected: boolean;
    address: string | null;
    isLoading: boolean;
    isBurning: boolean;
    burnResult: BurnResult | null;
    connectWallet: () => Promise<void>;
    disconnect: () => void;
    burnTokens: (amount: string, baseAddress: string) => Promise<void>;
    clearBurnResult: () => void;
}

const WalletContext = createContext<WalletContextType | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
    const [isConnected, setIsConnected] = useState(false);
    const [address, setAddress] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isBurning, setIsBurning] = useState(false);
    const [burnResult, setBurnResult] = useState<BurnResult | null>(null);
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
    }, []);

    // Check for existing session on mount
    useEffect(() => {
        if (!isClient) return;

        const checkSession = async () => {
            try {
                const { getLocalStorage } = await import('@stacks/connect');
                const userData = getLocalStorage();
                if (userData?.addresses?.stx?.[0]?.address) {
                    setIsConnected(true);
                    setAddress(userData.addresses.stx[0].address);
                }
            } catch (err) {
                console.error('Failed to check session:', err);
            }
        };
        checkSession();
    }, [isClient]);

    const connectWallet = useCallback(async () => {
        if (!isClient || typeof window === 'undefined') return;

        setIsLoading(true);
        try {
            const { connect, getLocalStorage } = await import('@stacks/connect');

            await connect({
                walletConnectProjectId: WALLETCONNECT_PROJECT_ID,
                network: NETWORK === 'mainnet' ? 'mainnet' : 'testnet',
            });

            const userData = getLocalStorage();
            if (userData?.addresses?.stx?.[0]?.address) {
                setIsConnected(true);
                setAddress(userData.addresses.stx[0].address);
            }
        } catch (err) {
            console.error('Failed to connect wallet:', err);
        } finally {
            setIsLoading(false);
        }
    }, [isClient]);

    const disconnect = useCallback(async () => {
        try {
            const { disconnect: stacksDisconnect } = await import('@stacks/connect');
            await stacksDisconnect();
            setIsConnected(false);
            setAddress(null);
            setBurnResult(null);
            setIsBurning(false);
        } catch (err) {
            console.error('Failed to disconnect:', err);
        }
    }, []);

    const burnTokens = useCallback(async (amount: string, baseAddress: string) => {
        if (!isClient || typeof window === 'undefined' || !isConnected) return;

        const trimmedAddress = baseAddress.trim();
        if (!/^0x[a-fA-F0-9]{40}$/.test(trimmedAddress)) {
            setBurnResult({
                txId: '',
                status: 'error',
                message: 'Invalid Base address format',
            });
            return;
        }

        let microAmount: bigint;
        try {
            microAmount = parseUnits(amount.trim(), 6);
        } catch {
            setBurnResult({
                txId: '',
                status: 'error',
                message: 'Invalid amount',
            });
            return;
        }

        if (microAmount <= 0n) {
            setBurnResult({
                txId: '',
                status: 'error',
                message: 'Amount must be greater than 0',
            });
            return;
        }

        setIsBurning(true);
        setBurnResult(null);

        try {
            const { openContractCall } = await import('@stacks/connect');
            const { uintCV, stringAsciiCV, PostConditionMode, AnchorMode } = await import('@stacks/transactions');

            // Parse contract address and name
            const [contractAddress, contractName] = config.contracts.stacks.wrappedUsdc.split('.');

            await openContractCall({
                contractAddress,
                contractName,
                functionName: 'burn',
                functionArgs: [
                    uintCV(microAmount),
                    stringAsciiCV(trimmedAddress),
                ],
                postConditionMode: PostConditionMode.Allow,
                anchorMode: AnchorMode.Any,
                network: NETWORK === 'mainnet' ? 'mainnet' : 'testnet',
                onFinish: (data) => {
                    console.log('Burn transaction submitted:', data.txId);
                    setBurnResult({
                        txId: data.txId,
                        status: 'pending',
                    });
                    setIsBurning(false);
                },
                onCancel: () => {
                    console.log('Burn transaction cancelled');
                    setIsBurning(false);
                },
            });
        } catch (err) {
            console.error('Failed to burn tokens:', err);
            setBurnResult({
                txId: '',
                status: 'error',
                message: err instanceof Error ? err.message : 'Failed to burn tokens',
            });
            setIsBurning(false);
        }
    }, [isClient, isConnected]);

    const clearBurnResult = useCallback(() => {
        setBurnResult(null);
    }, []);

    return (
        <WalletContext.Provider value={{
            isConnected,
            address,
            isLoading,
            isBurning,
            burnResult,
            connectWallet,
            disconnect,
            burnTokens,
            clearBurnResult,
        }}>
            {children}
        </WalletContext.Provider>
    );
}

export function useWallet() {
    const context = useContext(WalletContext);
    if (!context) {
        throw new Error('useWallet must be used within a WalletProvider');
    }
    return context;
}
