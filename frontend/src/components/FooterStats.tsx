'use client';

import { useMemo } from 'react';
import { formatUnits } from 'viem';
import { useGasPrice } from 'wagmi';
import { config } from '@/lib/config';
import { usePrices } from '@/hooks/usePrices';

export function FooterStats() {
    const { data: gasPrice } = useGasPrice();
    const { ethUsd, stxUsd } = usePrices();

    const avgFee = useMemo(() => {
        if (!gasPrice) return null;

        // Base L2 fee calculation
        const baseGasUsed = config.gasEstimates.baseLock;
        const baseFeesWei = baseGasUsed * gasPrice;
        const baseFeeEth = Number(formatUnits(baseFeesWei, 18));
        const baseFeeUsd = baseFeeEth * ethUsd;

        // Stacks fee
        const stacksFeeStx = Number(config.gasEstimates.stacksMint) / 1_000_000;
        const stacksFeeUsd = stacksFeeStx * stxUsd;

        // Total
        const totalFeeUsd = baseFeeUsd + stacksFeeUsd;

        // Format based on size
        if (totalFeeUsd < 0.01) {
            return '<$0.01';
        } else if (totalFeeUsd < 1) {
            return `$${totalFeeUsd.toFixed(2)}`;
        } else {
            return `$${totalFeeUsd.toFixed(2)}`;
        }
    }, [gasPrice, ethUsd, stxUsd]);

    return (
        <div className="mt-16 grid grid-cols-3 gap-12 text-center opacity-50 hover:opacity-100 transition-opacity">
            <div>
                <p className="text-2xl font-bold text-white">~2s</p>
                <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold mt-1">Finality</p>
            </div>
            <div>
                <p className="text-2xl font-bold text-white">
                    {avgFee ?? (
                        <span className="inline-block w-12 h-6 bg-gray-700 rounded animate-pulse" />
                    )}
                </p>
                <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold mt-1">Avg Fee</p>
            </div>
            <div>
                <p className="text-2xl font-bold text-white">2/3</p>
                <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold mt-1">Secure</p>
            </div>
        </div>
    );
}
