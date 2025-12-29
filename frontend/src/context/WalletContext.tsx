'use client';

import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { WALLETCONNECT_PROJECT_ID, NETWORK } from '@/config';

interface WalletContextType {
    isConnected: boolean;
    address: string | null;
    isLoading: boolean;
    connectWallet: () => Promise<void>;
    disconnect: () => void;
}

const WalletContext = createContext<WalletContextType | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
    const [isConnected, setIsConnected] = useState(false);
    const [address, setAddress] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
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

            // Key configuration for WalletConnect to work:
            // - walletConnectProjectId: Required for WalletConnect option
            // - network: Required to avoid 'network in undefined' error
            await connect({
                walletConnectProjectId: WALLETCONNECT_PROJECT_ID,
                network: NETWORK === 'mainnet' ? 'mainnet' : 'testnet',
            });

            // Get address from localStorage after connection
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
        } catch (err) {
            console.error('Failed to disconnect:', err);
        }
    }, []);

    return (
        <WalletContext.Provider value={{ isConnected, address, isLoading, connectWallet, disconnect }}>
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
