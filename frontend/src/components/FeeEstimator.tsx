'use client';

import { useMemo } from 'react';
import { formatUnits } from 'viem';
import { useGasPrice } from 'wagmi';
import { config } from '@/lib/config';
import { usePrices } from '@/hooks/usePrices';

interface FeeEstimate {
    baseFee: string;       // USD
    stacksFee: string;     // USD
    totalFee: string;      // USD
    l1Fee: string;         // USD (real-time L1 comparison)
    savingsVsL1: string;   // USD
    savingsPercent: number; // %
}

export function FeeEstimator() {
    const { data: gasPrice } = useGasPrice();
    const { ethUsd, stxUsd, l1BridgeFeeUsd, ethSource, stxSource, l1GasSource } = usePrices();

    const estimate = useMemo<FeeEstimate | null>(() => {
        if (!gasPrice) return null;

        // Base L2 fee calculation (real-time gas * real-time ETH price)
        const baseGasUsed = config.gasEstimates.baseLock;
        const baseFeesWei = baseGasUsed * gasPrice;
        const baseFeeEth = Number(formatUnits(baseFeesWei, 18));
        const baseFeeUsd = baseFeeEth * ethUsd;

        // Stacks fee (real-time STX price)
        const stacksFeeStx = Number(config.gasEstimates.stacksMint) / 1_000_000;
        const stacksFeeUsd = stacksFeeStx * stxUsd;

        // Total
        const totalFeeUsd = baseFeeUsd + stacksFeeUsd;

        // Savings vs real-time L1 fee
        const savingsUsd = l1BridgeFeeUsd - totalFeeUsd;
        const savingsPercent = l1BridgeFeeUsd > 0
            ? Math.round((savingsUsd / l1BridgeFeeUsd) * 100)
            : 0;

        return {
            baseFee: baseFeeUsd.toFixed(4),
            stacksFee: stacksFeeUsd.toFixed(4),
            totalFee: totalFeeUsd.toFixed(2),
            l1Fee: l1BridgeFeeUsd.toFixed(2),
            savingsVsL1: savingsUsd.toFixed(2),
            savingsPercent: Math.max(0, savingsPercent),
        };
    }, [gasPrice, ethUsd, stxUsd, l1BridgeFeeUsd]);

    if (!estimate) {
        return (
            <div className="animate-pulse bg-gray-800 rounded-lg p-4">
                <div className="h-4 bg-gray-700 rounded w-1/2 mb-2"></div>
                <div className="h-4 bg-gray-700 rounded w-3/4"></div>
            </div>
        );
    }

    return (
        <div className="bg-gradient-to-br from-green-900/30 to-emerald-900/30 border border-green-500/30 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-green-400">
                    💰 Fee Breakdown
                </h3>
                <div className="flex gap-1">
                    {ethSource === 'chainlink' && (
                        <span className="text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded">
                            Chainlink
                        </span>
                    )}
                    {stxSource === 'coinbase' && (
                        <span className="text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded">
                            Coinbase
                        </span>
                    )}
                    {l1GasSource === 'etherscan' && (
                        <span className="text-[10px] bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded">
                            Etherscan
                        </span>
                    )}
                </div>
            </div>

            <div className="space-y-2 text-sm">
                <div className="flex justify-between text-gray-300">
                    <span>Base L2 Lock</span>
                    <span>${estimate.baseFee}</span>
                </div>
                <div className="flex justify-between text-gray-300">
                    <span>Stacks Mint</span>
                    <span>${estimate.stacksFee}</span>
                </div>
                <div className="border-t border-green-500/30 pt-2 mt-2">
                    <div className="flex justify-between font-bold text-white">
                        <span>Total Fee</span>
                        <span className="text-green-400">~${estimate.totalFee}</span>
                    </div>
                </div>
            </div>

            {/* Savings highlight - now with real-time L1 fee */}
            <div className="mt-4 bg-green-500/20 rounded-lg p-3 text-center">
                <p className="text-xs text-green-300">
                    vs ETH L1 Route (~${estimate.l1Fee})
                    {l1GasSource === 'fallback' && (
                        <span className="text-gray-400 ml-1">(approx)</span>
                    )}
                </p>
                <p className="text-lg font-bold text-green-400">
                    Save ${estimate.savingsVsL1} ({estimate.savingsPercent}% cheaper!)
                </p>
            </div>
        </div>
    );
}
