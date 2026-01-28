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
                `https://base-sepolia.blockscout.com/api/v2/addresses/${baseBridgeAddress}/transactions?limit=100`
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
                <div className="bg-gradient-to-br from-green-900/30 to-green-900/10 border border-green-800/30 rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-green-400">
                        {loading ? '...' : formatVolume(stats.totalVolume)}
                    </p>
                    <p className="text-xs text-gray-500">Total Volume</p>
                </div>

                {/* Unique Users */}
                <div className="bg-gradient-to-br from-blue-900/30 to-blue-900/10 border border-blue-800/30 rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-blue-400">
                        {loading ? '...' : stats.uniqueUsers}
                    </p>
                    <p className="text-xs text-gray-500">Unique Users</p>
                </div>

                {/* Avg Time */}
                <div className="bg-gradient-to-br from-orange-900/30 to-orange-900/10 border border-orange-800/30 rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-orange-400">
                        {stats.avgTransactionTime}
                    </p>
                    <p className="text-xs text-gray-500">Avg Time</p>
                </div>

                {/* Relayer Status */}
                <div className="bg-gradient-to-br from-purple-900/30 to-purple-900/10 border border-purple-800/30 rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold flex items-center justify-center gap-2">
                        <span
                            className={`w-2 h-2 rounded-full ${stats.relayerStatus === 'online'
                                    ? 'bg-green-400 animate-pulse'
                                    : stats.relayerStatus === 'offline'
                                        ? 'bg-red-400'
                                        : 'bg-yellow-400'
                                }`}
                        />
                        <span className={
                            stats.relayerStatus === 'online'
                                ? 'text-green-400'
                                : stats.relayerStatus === 'offline'
                                    ? 'text-red-400'
                                    : 'text-yellow-400'
                        }>
                            {stats.relayerStatus === 'online' ? 'Online' :
                                stats.relayerStatus === 'offline' ? 'Offline' : 'Unknown'}
                        </span>
                    </p>
                    <p className="text-xs text-gray-500">Relayer</p>
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
