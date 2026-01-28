'use client';

import { useState } from 'react';
import { useAccount, useConnect, useDisconnect, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits } from 'viem';
import { useStacksWallet } from '@/hooks/useStacksWallet';
import { FeeEstimator } from './FeeEstimator';
import { config, USDC_ABI, BRIDGE_ABI } from '@/lib/config';

type Direction = 'deposit' | 'withdraw';

export function BridgeForm() {
    const [direction, setDirection] = useState<Direction>('deposit');
    const [amount, setAmount] = useState('');
    const [destinationAddress, setDestinationAddress] = useState('');
    const [step, setStep] = useState<'input' | 'approve' | 'bridge' | 'pending' | 'success'>('input');

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

    const { isLoading: isApproving, isSuccess: approveSuccess } = useWaitForTransactionReceipt({
        hash: approveHash,
    });

    const { isLoading: isLocking, isSuccess: lockSuccess } = useWaitForTransactionReceipt({
        hash: lockHash,
    });

    const parsedAmount = amount ? parseUnits(amount, 6) : 0n;

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

    return (
        <div className="w-full max-w-md mx-auto">
            {/* Direction Toggle */}
            <div className="flex bg-gray-800 rounded-xl p-1 mb-6">
                <button
                    onClick={() => setDirection('deposit')}
                    className={`flex-1 py-3 rounded-lg font-semibold transition-all ${direction === 'deposit'
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-400 hover:text-white'
                        }`}
                >
                    Deposit
                </button>
                <button
                    onClick={() => setDirection('withdraw')}
                    className={`flex-1 py-3 rounded-lg font-semibold transition-all ${direction === 'withdraw'
                        ? 'bg-purple-600 text-white'
                        : 'text-gray-400 hover:text-white'
                        }`}
                >
                    Withdraw
                </button>
            </div>

            {/* Chain Cards */}
            <div className="space-y-4">
                {/* From Chain */}
                <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-sm text-gray-400">From</span>
                        <div className="flex items-center gap-2">
                            {direction === 'deposit' ? (
                                <>
                                    <div className="w-5 h-5 bg-blue-500 rounded-full"></div>
                                    <span className="font-semibold">Base</span>
                                </>
                            ) : (
                                <>
                                    <div className="w-5 h-5 bg-orange-500 rounded-full"></div>
                                    <span className="font-semibold">Stacks</span>
                                </>
                            )}
                        </div>
                    </div>

                    <input
                        type="number"
                        placeholder="0.00"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="w-full bg-transparent text-3xl font-bold text-white placeholder-gray-600 outline-none"
                    />

                    <div className="flex items-center justify-between mt-2">
                        <span className="text-sm text-gray-400">USDC</span>
                        <button className="text-sm text-blue-400 hover:text-blue-300">
                            Max
                        </button>
                    </div>
                </div>

                {/* Arrow */}
                <div className="flex justify-center -my-2 relative z-10">
                    <div className="bg-gray-900 border border-gray-700 rounded-lg p-2">
                        <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                        </svg>
                    </div>
                </div>

                {/* To Chain */}
                <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-sm text-gray-400">To</span>
                        <div className="flex items-center gap-2">
                            {direction === 'deposit' ? (
                                <>
                                    <div className="w-5 h-5 bg-orange-500 rounded-full"></div>
                                    <span className="font-semibold">Stacks</span>
                                </>
                            ) : (
                                <>
                                    <div className="w-5 h-5 bg-blue-500 rounded-full"></div>
                                    <span className="font-semibold">Base</span>
                                </>
                            )}
                        </div>
                    </div>

                    <input
                        type="text"
                        placeholder={direction === 'deposit' ? 'SP... (Stacks address)' : '0x... (Base address)'}
                        value={destinationAddress}
                        onChange={(e) => setDestinationAddress(e.target.value)}
                        className="w-full bg-transparent text-lg text-white placeholder-gray-600 outline-none"
                    />
                </div>
            </div>

            {/* Fee Estimator */}
            <div className="mt-4">
                <FeeEstimator />
            </div>

            {/* Wallet Connection */}
            <div className="mt-6 space-y-3">
                {direction === 'deposit' ? (
                    <>
                        {!evmConnected ? (
                            <div className="space-y-3">
                                {baseAccountConnector && (
                                    <button
                                        onClick={() => connectEvm({ connector: baseAccountConnector })}
                                        className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all"
                                    >
                                        Connect Base Account
                                    </button>
                                )}
                                {fallbackConnector && (
                                    <button
                                        onClick={() => connectEvm({ connector: fallbackConnector })}
                                        className="w-full py-4 bg-blue-600/20 hover:bg-blue-600/30 text-blue-200 font-bold rounded-xl transition-all"
                                    >
                                        Connect Base Wallet
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <div className="flex items-center justify-between text-sm text-gray-400 px-2">
                                    <span>Connected: {evmAddress?.slice(0, 6)}...{evmAddress?.slice(-4)}</span>
                                    <button onClick={() => disconnectEvm()} className="text-red-400 hover:text-red-300">
                                        Disconnect
                                    </button>
                                </div>

                                {step === 'input' && (
                                    <button
                                        onClick={handleApprove}
                                        disabled={!amount || !destinationAddress}
                                        className="w-full py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all"
                                    >
                                        {!amount ? 'Enter Amount' : !destinationAddress ? 'Enter Destination' : 'Approve & Bridge'}
                                    </button>
                                )}

                                {isApproving && (
                                    <div className="w-full py-4 bg-yellow-600/20 text-yellow-400 font-bold rounded-xl text-center">
                                        Approving USDC...
                                    </div>
                                )}

                                {approveSuccess && step === 'approve' && (
                                    <button
                                        onClick={handleLock}
                                        className="w-full py-4 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl transition-all"
                                    >
                                        Lock USDC & Bridge
                                    </button>
                                )}

                                {isLocking && (
                                    <div className="w-full py-4 bg-blue-600/20 text-blue-400 font-bold rounded-xl text-center">
                                        Locking USDC on Base...
                                    </div>
                                )}

                                {lockSuccess && (
                                    <div className="w-full py-4 bg-green-600/20 text-green-400 font-bold rounded-xl text-center">
                                        ✅ Deposit complete! xUSDC will be minted shortly.
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                ) : (
                    <>
                        {!stacksConnected ? (
                            <button
                                onClick={connectStacks}
                                className="w-full py-4 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl transition-all"
                            >
                                Connect Stacks Wallet
                            </button>
                        ) : (
                            <div className="space-y-3">
                                <div className="flex items-center justify-between text-sm text-gray-400 px-2">
                                    <span>Connected: {stacksAddress?.slice(0, 6)}...{stacksAddress?.slice(-4)}</span>
                                    <button onClick={disconnectStacks} className="text-red-400 hover:text-red-300">
                                        Disconnect
                                    </button>
                                </div>

                                {!burnResult && (
                                    <button
                                        onClick={() => burnTokens(amount, destinationAddress)}
                                        disabled={!amount || !destinationAddress || isBurning}
                                        className="w-full py-4 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all"
                                    >
                                        {isBurning
                                            ? 'Confirm in Wallet...'
                                            : !amount
                                                ? 'Enter Amount'
                                                : !destinationAddress
                                                    ? 'Enter Base Address'
                                                    : 'Burn & Withdraw'}
                                    </button>
                                )}

                                {isBurning && (
                                    <div className="w-full py-4 bg-orange-600/20 text-orange-400 font-bold rounded-xl text-center">
                                        ⏳ Waiting for wallet confirmation...
                                    </div>
                                )}

                                {burnResult?.status === 'pending' && (
                                    <div className="w-full p-4 bg-green-600/20 text-green-400 rounded-xl text-center">
                                        <p className="font-bold">✅ Burn transaction submitted!</p>
                                        <a
                                            href={`https://explorer.hiro.so/txid/${burnResult.txId}?chain=testnet`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-sm underline hover:text-green-300"
                                        >
                                            View on Explorer →
                                        </a>
                                        <p className="text-sm mt-2 text-gray-400">USDC will be released to {destinationAddress.slice(0, 6)}...{destinationAddress.slice(-4)} after confirmation.</p>
                                        <button
                                            onClick={clearBurnResult}
                                            className="mt-3 text-sm text-gray-400 hover:text-white"
                                        >
                                            Start New Withdrawal
                                        </button>
                                    </div>
                                )}

                                {burnResult?.status === 'error' && (
                                    <div className="w-full p-4 bg-red-600/20 text-red-400 rounded-xl text-center">
                                        <p className="font-bold">❌ Burn failed</p>
                                        <p className="text-sm">{burnResult.message || 'Please try again'}</p>
                                        <button
                                            onClick={clearBurnResult}
                                            className="mt-2 text-sm underline hover:text-red-300"
                                        >
                                            Try Again
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Info */}
            <div className="mt-6 text-center text-xs text-gray-500">
                <p>Minimum: 10 USDC • Max: 10,000 USDC per transaction</p>
                <p>Confirmation time: ~15 minutes</p>
            </div>
        </div>
    );
}
