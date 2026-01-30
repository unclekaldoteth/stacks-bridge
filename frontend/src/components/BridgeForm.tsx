'use client';

import { useState, useEffect } from 'react';
import { useAccount, useConnect, useDisconnect, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { useStacksWallet } from '@/hooks/useStacksWallet';
import { FeeEstimator } from './FeeEstimator';
import { config, USDC_ABI, BRIDGE_ABI } from '@/lib/config';

type Direction = 'deposit' | 'withdraw';

const BASE_ICON = (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="16" cy="16" r="16" fill="#0052FF" />
        <rect x="8" y="14" width="16" height="4" rx="2" fill="white" />
    </svg>
);

const STACKS_ICON = (
    <svg width="32" height="32" viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="80" cy="80" r="80" fill="#5546FF" />
        <path d="M112.5,122L95.3,95H120V84.8H39v10.2h24.7L46.5,122h12.8l20.2-31.7L99.7,122H112.5z M120,74.9V64.7H95.8
	l17-26.7H99.9L79.5,70.2L59.1,38H46.2l17,26.7H39V75L120,74.9L120,74.9z" fill="white" />
    </svg>
);

export function BridgeForm() {
    const [direction, setDirection] = useState<Direction>('deposit');
    const [amount, setAmount] = useState('');
    const [destinationAddress, setDestinationAddress] = useState('');
    const [step, setStep] = useState<'input' | 'approve' | 'bridge' | 'pending' | 'success'>('input');
    const [mounted, setMounted] = useState(false);
    const [stacksBalance, setStacksBalance] = useState<bigint>(0n);

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

    // Fetch EVM USDC Balance
    const { data: evmBalanceData } = useReadContract({
        address: config.contracts.base.usdc as `0x${string}`,
        abi: USDC_ABI,
        functionName: 'balanceOf',
        args: evmAddress ? [evmAddress] : undefined,
        query: { enabled: !!evmAddress && mounted }
    });
    const evmBalance = evmBalanceData ? BigInt(evmBalanceData.toString()) : 0n;

    // Fetch Stacks xUSDC Balance
    useEffect(() => {
        const fetchStacksBalance = async () => {
            if (!stacksAddress) return;
            try {
                // Use a direct fetch to the Stacks API for balance to avoid importing heavy libraries here if possible,
                // or dynamic import like in WalletContext. For consistency/ease, we can use the API directly or libraries.
                // Using Stacks API allows us to be lightweight.
                // SIP-010 get-balance: (get-balance owner)

                const [contractAddress, contractName] = config.contracts.stacks.wrappedUsdc.split('.');
                const url = `${config.chains.stacks.apiUrl}/v2/contracts/call-read/${contractAddress}/${contractName}/get-balance`;

                const { standardPrincipalCV } = await import('@stacks/transactions');
                const { cvToHex } = await import('@stacks/transactions');

                const args = [cvToHex(standardPrincipalCV(stacksAddress))];

                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        sender: stacksAddress,
                        arguments: args,
                    }),
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data.okay && data.result) {
                        // Result is a hex CV. We need to parse it. 
                        // It returns (ok u123) usually for SIP-010, which is a response CV containing a uint.
                        // Or just u123.
                        // Let's use libraries to parse response if possible, or simple regex for uint if needed.
                        // Better to use library to be safe.
                        const { hexToCV, cvToValue } = await import('@stacks/transactions');
                        const resultCV = hexToCV(data.result);
                        // SIP-010 get-balance returns (response uint uint)
                        // cvToValue on (ok u123) returns { type: 'ok', value: 123n } (or similar depends on version)
                        // Actually cvToValue simplifies it.
                        // Let's debug/assume standard response.
                        const val = cvToValue(resultCV);
                        // if val is object with value property (ResponseOk)
                        // @ts-ignore - cvToValue typing can be tricky
                        const balance = val?.value !== undefined ? BigInt(val.value) : (typeof val === 'bigint' ? val : 0n);
                        setStacksBalance(balance);
                    }
                }
            } catch (err) {
                console.error("Failed to fetch Stacks balance", err);
            }
        };

        if (stacksConnected && stacksAddress) {
            fetchStacksBalance();
            // Poll every 10s
            const interval = setInterval(fetchStacksBalance, 10000);
            return () => clearInterval(interval);
        } else {
            setStacksBalance(0n);
        }
    }, [stacksConnected, stacksAddress]);


    const { isLoading: isApproving, isSuccess: approveSuccess } = useWaitForTransactionReceipt({ hash: approveHash });
    const { isLoading: isLocking, isSuccess: lockSuccess } = useWaitForTransactionReceipt({ hash: lockHash });

    const parsedAmount = amount ? parseUnits(amount, 6) : 0n;

    // Derived state
    const isDeposit = direction === 'deposit';
    const currentBalance = isDeposit ? evmBalance : stacksBalance;
    const isInsufficientBalance = mounted && parsedAmount > currentBalance;

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

    // Set max amount handler
    const handleSetMax = () => {
        const bal = formatUnits(currentBalance, 6);
        setAmount(bal);
    };

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

        // Check insufficient balance
        if (isInsufficientBalance) {
            return (
                <button disabled className="w-full py-4 rounded-xl font-bold text-lg bg-[#222] text-red-500 border border-red-500/20 cursor-not-allowed transition-colors">
                    Insufficient Balance
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
                            className={`bg-transparent text-4xl w-full font-medium placeholder-gray-600 outline-none transition-colors ${isInsufficientBalance ? 'text-red-500' : 'text-white'
                                }`}
                        />
                    </div>
                    <div className="flex justify-between items-center mt-2">
                        <div className="flex items-center gap-2">
                            <span className={`text-sm font-medium transition-colors ${isInsufficientBalance ? 'text-red-400' : 'text-gray-500'
                                }`}>
                                Balance: {mounted ? (
                                    isDeposit
                                        ? (evmConnected ? `${formatUnits(evmBalance, 6)} USDC` : '-')
                                        : (stacksConnected ? `${formatUnits(stacksBalance, 6)} xUSDC` : '-')
                                ) : '-'}
                            </span>
                            {isInsufficientBalance && (
                                <span className="text-xs bg-red-500/10 text-red-500 px-2 py-0.5 rounded-full font-bold">
                                    Insufficient
                                </span>
                            )}
                        </div>
                        {mounted && ((isDeposit && evmConnected) || (!isDeposit && stacksConnected)) && (
                            <div className="flex items-center gap-1.5 bg-[#111] border border-[#222] rounded-lg p-1">
                                {[25, 50, 75, 100].map((percent) => (
                                    <button
                                        key={percent}
                                        onClick={() => {
                                            if (!currentBalance) return;
                                            const value = currentBalance * BigInt(percent) / 100n;
                                            // Handle case where we might have decimals slightly off by flooring/rounding,
                                            // but for USDC (6 decimals) integer math is fine.
                                            // If 100%, use exact balance to avoid any dust.
                                            if (percent === 100) {
                                                setAmount(formatUnits(currentBalance, 6));
                                            } else {
                                                setAmount(formatUnits(value, 6));
                                            }
                                        }}
                                        className="px-2 py-1 text-[10px] font-bold text-gray-500 hover:text-white hover:bg-[#222] rounded transition-all"
                                    >
                                        {percent === 100 ? 'MAX' : `${percent}%`}
                                    </button>
                                ))}
                            </div>
                        )}
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
