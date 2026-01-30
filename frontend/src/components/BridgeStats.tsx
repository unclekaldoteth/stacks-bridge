'use client';

import { useState, useEffect, useCallback } from 'react';
import { config } from '@/lib/config';

interface BridgeStats {
    totalVolume: number;
    totalTransactions: number;
    uniqueUsers: number;
    avgTransactionTime: string;
    relayerStatus: 'online' | 'offline' | 'unknown';
}

const baseBridgeAddress = config.contracts.base.bridge;
const isMainnet = process.env.NEXT_PUBLIC_NETWORK === 'mainnet';
const blockscoutApi = isMainnet
    ? 'https://base.blockscout.com/api/v2'
    : 'https://base-sepolia.blockscout.com/api/v2';

export function BridgeStats() {
    const [stats, setStats] = useState<BridgeStats>({
        totalVolume: 0,
        totalTransactions: 0,
        uniqueUsers: 0,
        avgTransactionTime: '~15min',
        relayerStatus: 'unknown',
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchStats = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            // Fetch all transactions from bridge contract
            const response = await fetch(
                `${blockscoutApi}/addresses/${baseBridgeAddress}/transactions?limit=100`
            );

            if (!response.ok) {
                throw new Error('Failed to fetch bridge stats');
            }

            const data = await response.json();
            const items = data.items || [];

            // Filter for lock transactions (deposits)
            const deposits = items.filter((tx: { method: string }) => tx.method === 'lock');
            const releases = items.filter((tx: { method: string }) =>
                tx.method === 'executeRelease' || tx.method === 'queueRelease'
            );

            // Calculate total volume from decoded input
            let totalVolume = 0;
            const uniqueAddresses = new Set<string>();

            for (const tx of deposits) {
                const amountParam = tx.decoded_input?.parameters?.find(
                    (p: { name: string }) => p.name === 'amount'
                );
                if (amountParam?.value) {
                    totalVolume += Number.parseInt(amountParam.value, 10) / 1e6;
                }
                if (tx.from?.hash) {
                    uniqueAddresses.add(tx.from.hash.toLowerCase());
                }
            }

            // Check relayer health (look for recent executeRelease)
            const recentRelease = releases.find((tx: { block_timestamp: string }) => {
                const txTime = new Date(tx.block_timestamp).getTime();
                const hourAgo = Date.now() - 60 * 60 * 1000;
                return txTime > hourAgo;
            });

            setStats({
                totalVolume,
                totalTransactions: deposits.length + releases.length,
                uniqueUsers: uniqueAddresses.size,
                avgTransactionTime: '~15min',
                relayerStatus: recentRelease ? 'online' : releases.length > 0 ? 'online' : 'unknown',
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchStats();
        // Refresh every 30 seconds
        const interval = setInterval(fetchStats, 30000);
        return () => clearInterval(interval);
    }, [fetchStats]);

    const formatVolume = (vol: number): string => {
        if (vol >= 1000000) return `$${(vol / 1000000).toFixed(2)}M`;
        if (vol >= 1000) return `$${(vol / 1000).toFixed(1)}K`;
        return `$${vol.toFixed(2)}`;
    };

    return (
        <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-300">Bridge Analytics</h3>
                <button
                    onClick={fetchStats}
                    disabled={loading}
                    className="text-xs text-gray-500 hover:text-gray-300 disabled:opacity-50"
                >
                    {loading ? 'Updating...' : '↻ Refresh'}
                </button>
            </div>

            {error && (
                <div className="text-red-400 text-sm mb-4 p-3 bg-red-900/20 rounded-lg">
                    {error}
                </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {/* Total Volume */}
                <div className="bg-[#111] border border-[#222] rounded-xl p-4 text-center hover:border-green-900/50 transition-colors">
                    <p className="text-2xl font-bold text-white">
                        {loading ? '...' : formatVolume(stats.totalVolume)}
                    </p>
                    <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mt-1">Volume</p>
                </div>

                {/* Unique Users */}
                <div className="bg-[#111] border border-[#222] rounded-xl p-4 text-center hover:border-blue-900/50 transition-colors">
                    <p className="text-2xl font-bold text-white">
                        {loading ? '...' : stats.uniqueUsers}
                    </p>
                    <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mt-1">Users</p>
                </div>

                {/* Avg Time */}
                <div className="bg-[#111] border border-[#222] rounded-xl p-4 text-center hover:border-orange-900/50 transition-colors">
                    <p className="text-2xl font-bold text-white">
                        {stats.avgTransactionTime}
                    </p>
                    <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mt-1">Time</p>
                </div>

                {/* Relayer Status */}
                <div className="bg-[#111] border border-[#222] rounded-xl p-4 text-center hover:border-purple-900/50 transition-colors">
                    <div className="flex items-center justify-center h-8 gap-2">
                        <div className={`w-2 h-2 rounded-full ${stats.relayerStatus === 'online' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                        <span className="text-lg font-bold text-white">
                            {stats.relayerStatus === 'online' ? 'Online' : 'Offline'}
                        </span>
                    </div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mt-1">Relayer</p>
                </div>
            </div>

            {/* Transactions count footer */}
            <div className="mt-3 text-center">
                <p className="text-xs text-gray-600">
                    {stats.totalTransactions} total transactions processed
                </p>
            </div>
        </div>
    );
}
