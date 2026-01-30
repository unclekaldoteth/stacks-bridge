'use client';

import { useState, useEffect } from 'react';
import { useAccount, useConnect, useDisconnect, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { useStacksWallet } from '@/hooks/useStacksWallet';
import { FeeEstimator } from './FeeEstimator';
import { config, USDC_ABI, BRIDGE_ABI } from '@/lib/config';

type Direction = 'deposit' | 'withdraw';

const BASE_ICON = (
    <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-xs">
        B
    </div>
);

const STACKS_ICON = (
    <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-white font-bold text-xs">
        Stx
    </div>
);

export function BridgeForm() {
    const [direction, setDirection] = useState<Direction>('deposit');
    const [amount, setAmount] = useState('');
    const [destinationAddress, setDestinationAddress] = useState('');
    const [step, setStep] = useState<'input' | 'approve' | 'bridge' | 'pending' | 'success'>('input');
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // EVM wallet (Base)
    const { address: evmAddress, isConnected: evmConnected } = useAccount();
    const { connect: connectEvm, connectors } = useConnect();
    const { disconnect: disconnectEvm } = useDisconnect();
    const baseAccountConnector = connectors.find((connector) => connector.id === 'base-account');
    const fallbackConnector = connectors.find((connector) => connector.id !== 'base-account');

    // Stacks wallet
    const {
        address: stacksAddress,
        isConnected: stacksConnected,
        connect: connectStacks,
        disconnect: disconnectStacks,
        isBurning,
        burnResult,
        burnTokens,
        clearBurnResult,
    } = useStacksWallet();

    // Contract interactions
    const { writeContract: approve, data: approveHash } = useWriteContract();
    const { writeContract: lock, data: lockHash } = useWriteContract();

    const { isLoading: isApproving, isSuccess: approveSuccess } = useWaitForTransactionReceipt({ hash: approveHash });
    const { isLoading: isLocking, isSuccess: lockSuccess } = useWaitForTransactionReceipt({ hash: lockHash });

    const parsedAmount = amount ? parseUnits(amount, 6) : 0n;

    // Auto-fill destination if wallets connected
    useEffect(() => {
        if (direction === 'deposit' && stacksConnected && stacksAddress) {
            setDestinationAddress(stacksAddress);
        } else if (direction === 'withdraw' && evmConnected && evmAddress) {
            setDestinationAddress(evmAddress);
        }
    }, [direction, stacksConnected, stacksAddress, evmConnected, evmAddress]);

    const handleSwap = () => {
        setDirection(prev => prev === 'deposit' ? 'withdraw' : 'deposit');
        setAmount('');
    };

    const handleApprove = async () => {
        if (!parsedAmount) return;
        setStep('approve');
        approve({
            address: config.contracts.base.usdc as `0x${string}`,
            abi: USDC_ABI,
            functionName: 'approve',
            args: [config.contracts.base.bridge as `0x${string}`, parsedAmount],
        });
    };

    const handleLock = async () => {
        if (!parsedAmount || !destinationAddress) return;
        setStep('bridge');
        lock({
            address: config.contracts.base.bridge as `0x${string}`,
            abi: BRIDGE_ABI,
            functionName: 'lock',
            args: [parsedAmount, destinationAddress],
        });
    };

    const isDeposit = direction === 'deposit';
    const fromNetwork = isDeposit ? 'Base' : 'Stacks';
    const toNetwork = isDeposit ? 'Stacks' : 'Base';
    const fromIcon = isDeposit ? BASE_ICON : STACKS_ICON;
    const toIcon = isDeposit ? STACKS_ICON : BASE_ICON;

    // Determine button text and action
    const getActionButton = () => {
        if (!mounted) return null;

        // 1. Check Source Wallet Connection
        const isSourceConnected = isDeposit ? evmConnected : stacksConnected;
        if (!isSourceConnected) {
            return (
                <button
                    onClick={() => {
                        if (isDeposit) {
                            const connector = baseAccountConnector || fallbackConnector;
                            if (connector) connectEvm({ connector });
                        } else {
                            connectStacks();
                        }
                    }}
                    className="w-full py-4 rounded-xl font-bold text-lg bg-[#375BD2] hover:bg-[#2F4CB3] text-white transition-colors shadow-lg shadow-blue-900/20"
                >
                    Connect {fromNetwork} Wallet
                </button>
            );
        }

        // 2. Check Destination Wallet Connection (Optional but recommended)
        /* 
           We don't block on destination connection because users might bridge to another address,
           but we already have the input field for that.
        */

        // 3. Action Buttons
        if (isDeposit) {
            if (isApproving) return <StatusButton text="Approving USDC..." loading />;
            if (isLocking) return <StatusButton text="Bridging..." loading />;
            if (approveSuccess && step === 'approve') {
                return (
                    <button onClick={handleLock} className="w-full py-4 rounded-xl font-bold text-lg bg-[#375BD2] hover:bg-[#2F4CB3] text-white transition-colors">
                        Confirm Deposit
                    </button>
                );
            }
            return (
                <button
                    onClick={handleApprove}
                    disabled={!amount || !destinationAddress}
                    className="w-full py-4 rounded-xl font-bold text-lg bg-[#375BD2] hover:bg-[#2F4CB3] disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors"
                >
                    {!amount ? 'Enter Amount' : 'Bridge Funds'}
                </button>
            );
        } else {
            // Withdraw Flow
            if (isBurning) return <StatusButton text="Confirm in Wallet..." loading />;
            return (
                <button
                    onClick={() => burnTokens(amount, destinationAddress)}
                    disabled={!amount || !destinationAddress}
                    className="w-full py-4 rounded-xl font-bold text-lg bg-[#375BD2] hover:bg-[#2F4CB3] disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors"
                >
                    {!amount ? 'Enter Amount' : 'Bridge Funds'}
                </button>
            );
        }
    };

    return (
        <div className="w-full max-w-[480px] mx-auto space-y-4">
            {/* Main Card */}
            <div className="bg-[#111111] border border-[#222] rounded-3xl p-2 relative overflow-visible shadow-2xl">

                {/* FROM SECTION */}
                <div className="bg-[#1A1A1A] rounded-[20px] p-5 hover:bg-[#1E1E1E] transition-colors group">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-gray-400 text-sm font-medium">From</span>
                        <div className="flex items-center gap-2 bg-black/20 px-3 py-1.5 rounded-full border border-white/5">
                            {fromIcon}
                            <span className="text-white font-semibold text-sm">{fromNetwork}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <input
                            type="number"
                            placeholder="0"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="bg-transparent text-4xl w-full font-medium text-white placeholder-gray-600 outline-none"
                        />
                    </div>
                    <div className="flex justify-between items-center mt-2">
                        <span className="text-gray-500 text-sm">Balance: {mounted && (isDeposit ? (evmConnected ? '0.00 USDC' : '-') : (stacksConnected ? '0.00 xUSDC' : '-'))}</span>
                        {mounted && isDeposit && evmConnected && <button className="text-[#375BD2] text-xs font-bold uppercase tracking-wide">Max</button>}
                    </div>
                </div>

                {/* SWAP BUTTON (Floating) */}
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
                    <button
                        onClick={handleSwap}
                        className="w-10 h-10 bg-[#111] border-4 border-[#111] rounded-xl flex items-center justify-center text-gray-400 hover:text-white hover:bg-[#222] transition-all"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12 5V19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M19 12L12 19L5 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </button>
                </div>

                <div className="h-1 bg-[#111]"></div>

                {/* TO SECTION */}
                <div className="bg-[#1A1A1A] rounded-[20px] p-5 hover:bg-[#1E1E1E] transition-colors">
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-gray-400 text-sm font-medium">To</span>
                        <div className="flex items-center gap-2 bg-black/20 px-3 py-1.5 rounded-full border border-white/5">
                            {toIcon}
                            <span className="text-white font-semibold text-sm">{toNetwork}</span>
                        </div>
                    </div>

                    {/* Destination Address Input */}
                    <div className="space-y-2">
                        <input
                            type="text"
                            placeholder={isDeposit ? "Stacks Address (SP...)" : "Base Address (0x...)"}
                            value={destinationAddress}
                            onChange={(e) => setDestinationAddress(e.target.value)}
                            className="w-full bg-black/20 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 border border-white/5 focus:border-[#375BD2] outline-none transition-colors"
                        />
                        {/* Receive Amount Estimate */}
                        <div className="flex justify-between px-1">
                            <span className="text-gray-500 text-sm">You receive</span>
                            <span className="text-white text-sm font-medium">
                                {amount ? `${amount} ${isDeposit ? 'xUSDC' : 'USDC'}` : '0'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* FEES SECTION (Folded inside card) */}
                <div className="px-5 pb-2 pt-4">
                    <FeeEstimator />
                </div>
            </div>

            {/* ACTION BUTTON */}
            <div>
                {getActionButton()}
            </div>

            {/* STATUS MESSAGES */}
            {lockSuccess && (
                <div className="bg-green-500/10 border border-green-500/20 text-green-400 p-4 rounded-xl text-center text-sm font-medium">
                    ✅ Deposit complete! xUSDC will be minted shortly.
                </div>
            )}
            {burnResult?.status === 'pending' && (
                <div className="bg-green-500/10 border border-green-500/20 text-green-400 p-4 rounded-xl text-center text-sm font-medium cursor-pointer" onClick={() => window.open(`https://explorer.hiro.so/txid/${burnResult.txId}?chain=mainnet`, '_blank')}>
                    ✅ Burn submitted! Click to view on Explorer.
                </div>
            )}
        </div>
    );
}

function StatusButton({ text, loading }: { text: string; loading?: boolean }) {
    return (
        <button disabled className="w-full py-4 rounded-xl font-bold text-lg bg-[#222] text-gray-300 flex items-center justify-center gap-3">
            {loading && <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>}
            {text}
        </button>
    );
}
