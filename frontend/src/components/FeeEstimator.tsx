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
    totalFeeNum: number;   // For calculations
    l1Fee: string;         // USD (real-time L1 comparison)
    l1FeeNum: number;      // For calculations
    savingsVsL1: string;   // USD
    savingsPercent: number; // %
    isCheaper: boolean;
}

export function FeeEstimator() {
    const { data: gasPrice } = useGasPrice();
    const {
        ethUsd,
        l1GasGwei,
        l1BridgeFeeUsd,
        stacksFeeUsd,
        l1GasSource,
    } = usePrices();

    const estimate = useMemo<FeeEstimate | null>(() => {
        if (!gasPrice) return null;

        // Base L2 fee calculation (real-time gas * real-time ETH price)
        const baseGasUsed = config.gasEstimates.baseLock;
        const baseFeesWei = baseGasUsed * gasPrice;
        const baseFeeEth = Number(formatUnits(baseFeesWei, 18));
        const baseFeeUsd = baseFeeEth * ethUsd;

        // Stacks fee from Hiro API (real-time)
        const stacksFeeUsdValue = stacksFeeUsd;

        // Total
        const totalFeeUsd = baseFeeUsd + stacksFeeUsdValue;

        // Savings vs real-time L1 fee
        const savingsUsd = l1BridgeFeeUsd - totalFeeUsd;
        const savingsPercent = l1BridgeFeeUsd > 0
            ? Math.round((Math.abs(savingsUsd) / l1BridgeFeeUsd) * 100)
            : 0;
        const isCheaper = savingsUsd >= 0;

        return {
            baseFee: baseFeeUsd.toFixed(4),
            stacksFee: stacksFeeUsdValue.toFixed(4),
            totalFee: totalFeeUsd.toFixed(2),
            totalFeeNum: totalFeeUsd,
            l1Fee: l1BridgeFeeUsd.toFixed(2),
            l1FeeNum: l1BridgeFeeUsd,
            savingsVsL1: Math.abs(savingsUsd).toFixed(2),
            savingsPercent: Math.max(0, savingsPercent),
            isCheaper,
        };
    }, [gasPrice, ethUsd, stacksFeeUsd, l1BridgeFeeUsd]);


    if (!estimate) {
        return (
            <div className="animate-pulse bg-gray-800 rounded-lg p-4">
                <div className="h-4 bg-gray-700 rounded w-1/2 mb-2"></div>
                <div className="h-4 bg-gray-700 rounded w-3/4"></div>
            </div>
        );
    }

    // Calculate bar widths for visual comparison
    const maxFee = Math.max(estimate.l1FeeNum, estimate.totalFeeNum, 0.01);
    const l2BarWidth = Math.round((estimate.totalFeeNum / maxFee) * 100);
    const l1BarWidth = Math.round((estimate.l1FeeNum / maxFee) * 100);

    return (
        <div className="bg-gradient-to-br from-green-900/30 to-emerald-900/30 border border-green-500/30 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-green-400">
                    💰 Fee Breakdown
                </h3>
                <div className="flex gap-1 flex-wrap justify-end">
                    <span className="text-[10px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded">
                        Live
                    </span>
                    {l1GasSource === 'etherscan' && (
                        <span className="text-[10px] bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded">
                            L1: {l1GasGwei < 1 ? l1GasGwei.toFixed(2) : l1GasGwei.toFixed(0)} Gwei
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

            {/* Visual comparison bars */}
            <div className="mt-4 space-y-2">
                <div className="flex items-center gap-2 text-xs">
                    <span className="w-16 text-gray-400">Base L2</span>
                    <div className="flex-1 bg-gray-700/50 rounded-full h-3 overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-green-500 to-emerald-400 rounded-full transition-all duration-500"
                            style={{ width: `${l2BarWidth}%` }}
                        />
                    </div>
                    <span className="w-16 text-right text-green-400 font-medium">${estimate.totalFee}</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                    <span className="w-16 text-gray-400">ETH L1</span>
                    <div className="flex-1 bg-gray-700/50 rounded-full h-3 overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-red-500 to-orange-400 rounded-full transition-all duration-500"
                            style={{ width: `${l1BarWidth}%` }}
                        />
                    </div>
                    <span className="w-16 text-right text-red-400 font-medium">${estimate.l1Fee}</span>
                </div>
            </div>

            {/* Savings highlight */}
            <div className={`mt-4 rounded-lg p-3 text-center ${estimate.isCheaper ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                <p className={`text-lg font-bold ${estimate.isCheaper ? 'text-green-400' : 'text-red-400'}`}>
                    {estimate.isCheaper
                        ? `🎉 Save $${estimate.savingsVsL1} (${estimate.savingsPercent}% cheaper!)`
                        : `⚠️ Costs $${estimate.savingsVsL1} more (${estimate.savingsPercent}% higher)`}
                </p>
                {l1GasSource === 'fallback' && (
                    <p className="text-xs text-gray-400 mt-1">L1 fee based on ~30 Gwei estimate</p>
                )}
            </div>
        </div>
    );
}
