'use client';

import { useState, useEffect } from 'react';
import { useAccount, useDisconnect } from 'wagmi';
import { openAppKitModal } from './Providers';

interface ConnectButtonProps {
    className?: string;
    connectedClassName?: string;
}

/**
 * A wallet connect button that safely handles SSR and AppKit initialization.
 */
export function ConnectButton({
    className = "bg-white text-black px-4 py-2 rounded-full text-sm font-bold hover:bg-gray-200 transition-colors",
    connectedClassName = "text-[#888] hover:text-white px-4 py-2 font-medium text-sm transition-colors"
}: ConnectButtonProps) {
    const { address, isConnected } = useAccount();
    const { disconnect } = useDisconnect();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Show loading state during SSR/hydration
    if (!mounted) {
        return (
            <button className={`${className} opacity-50`} disabled>
                Connect Wallet
            </button>
        );
    }

    if (isConnected && address) {
        return (
            <button onClick={() => disconnect()} className={connectedClassName}>
                {address.slice(0, 6)}...{address.slice(-4)}
            </button>
        );
    }

    return (
        <button onClick={openAppKitModal} className={className}>
            Connect Wallet
        </button>
    );
}
