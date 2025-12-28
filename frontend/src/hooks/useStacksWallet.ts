'use client';

import { useState, useCallback, useEffect } from 'react';

export interface StacksWallet {
    address: string | null;
    isConnected: boolean;
    connect: () => void;
    disconnect: () => void;
    isLoading: boolean;
}

export function useStacksWallet(): StacksWallet {
    const [address, setAddress] = useState<string | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [stacksModule, setStacksModule] = useState<any>(null);

    // Dynamically import @stacks/connect on client side only
    useEffect(() => {
        const loadStacks = async () => {
            try {
                const module = await import('@stacks/connect');
                setStacksModule(module);

                const appConfig = new module.AppConfig(['store_write', 'publish_data']);
                const userSession = new module.UserSession({ appConfig });

                if (userSession.isUserSignedIn()) {
                    const userData = userSession.loadUserData();
                    const testnetAddress = userData.profile?.stxAddress?.testnet;
                    if (testnetAddress) {
                        setAddress(testnetAddress);
                        setIsConnected(true);
                    }
                }
            } catch (error) {
                console.error('Failed to load Stacks module:', error);
            } finally {
                setIsLoading(false);
            }
        };

        loadStacks();
    }, []);

    const connect = useCallback(async () => {
        if (!stacksModule) return;

        const appConfig = new stacksModule.AppConfig(['store_write', 'publish_data']);
        const userSession = new stacksModule.UserSession({ appConfig });

        stacksModule.showConnect({
            appDetails: {
                name: 'Base <> Stacks Bridge',
                icon: 'https://stacks.co/favicon.ico',
            },
            onFinish: () => {
                const userData = userSession.loadUserData();
                const testnetAddress = userData.profile?.stxAddress?.testnet;
                setAddress(testnetAddress || null);
                setIsConnected(true);
            },
            userSession,
        });
    }, [stacksModule]);

    const disconnect = useCallback(async () => {
        if (!stacksModule) return;

        const appConfig = new stacksModule.AppConfig(['store_write', 'publish_data']);
        const userSession = new stacksModule.UserSession({ appConfig });

        userSession.signUserOut();
        setAddress(null);
        setIsConnected(false);
    }, [stacksModule]);

    return {
        address,
        isConnected,
        connect,
        disconnect,
        isLoading,
    };
}
