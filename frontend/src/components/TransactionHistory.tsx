'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { config } from '@/lib/config';

interface BridgeTransaction {
    id: string;
    type: 'deposit' | 'withdraw';
    amount: string;
    status: 'pending' | 'completed' | 'failed';
    txHash: string;
    timestamp: number;
    explorerUrl: string;
}

interface DepositEvent {
    transaction_hash: string;
    block_timestamp: string;
    decoded_input?: {
        parameters?: Array<{ name: string; value: string }>;
    };
}

const baseBridgeAddress = config.contracts.base.bridge;
const baseExplorerUrl = config.chains.base.explorer;

function formatAmount(value: string): string {
    const num = Number.parseInt(value, 10) / 1e6;
    return Number.isFinite(num) ? num.toFixed(2) : '0.00';
}

function formatTime(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export function TransactionHistory() {
    const { address, isConnected } = useAccount();
    const [transactions, setTransactions] = useState<BridgeTransaction[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchTransactions = useCallback(async (userAddress: string) => {
        setLoading(true);
        setError(null);

        try {
            // Fetch deposit events from Base contract
            const response = await fetch(
                `https://base-sepolia.blockscout.com/api/v2/addresses/${baseBridgeAddress}/transactions?filter=from%7C${userAddress}`
            );

            if (!response.ok) {
                throw new Error('Failed to fetch transactions');
            }

            const data = await response.json();
            const items = data.items || [];

            // Filter for lock transactions (deposits)
            const deposits: BridgeTransaction[] = items
                .filter((tx: { method: string }) => tx.method === 'lock')
                .slice(0, 10)
                .map((tx: DepositEvent) => ({
                    id: tx.transaction_hash,
                    type: 'deposit' as const,
                    amount: formatAmount(tx.decoded_input?.parameters?.[0]?.value || '0'),
                    status: 'completed' as const,
                    txHash: tx.transaction_hash,
                    timestamp: new Date(tx.block_timestamp).getTime(),
                    explorerUrl: `${baseExplorerUrl}/tx/${tx.transaction_hash}`,
                }));

            setTransactions(deposits);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!isConnected || !address) {
            setTransactions([]);
            return;
        }

        fetchTransactions(address);
    }, [address, isConnected, fetchTransactions]);

    if (!isConnected) {
        return null;
    }

    return (
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 mt-6">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-lg">Recent Transactions</h3>
                <button
                    onClick={() => address && fetchTransactions(address)}
                    disabled={loading}
                    className="text-sm text-blue-400 hover:text-blue-300 disabled:opacity-50"
                >
                    {loading ? 'Loading...' : 'Refresh'}
                </button>
            </div>

            {error && (
                <div className="text-red-400 text-sm mb-4 p-3 bg-red-900/20 rounded-lg">
                    {error}
                </div>
            )}

            {transactions.length === 0 && !loading && !error && (
                <div className="text-gray-500 text-center py-8">
                    <p>No bridge transactions yet</p>
                    <p className="text-sm mt-1">Your deposit and withdraw history will appear here</p>
                </div>
            )}

            {loading && transactions.length === 0 && (
                <div className="text-gray-400 text-center py-8">
                    <div className="animate-pulse">Loading transactions...</div>
                </div>
            )}

            <div className="space-y-3">
                {transactions.map((tx) => (
                    <div
                        key={tx.id}
                        className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-colors"
                    >
                        <div className="flex items-center gap-3">
                            <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center ${tx.type === 'deposit'
                                        ? 'bg-blue-600/20 text-blue-400'
                                        : 'bg-orange-600/20 text-orange-400'
                                    }`}
                            >
                                {tx.type === 'deposit' ? '↑' : '↓'}
                            </div>
                            <div>
                                <p className="font-medium">
                                    {tx.type === 'deposit' ? 'Deposit' : 'Withdraw'}
                                </p>
                                <p className="text-sm text-gray-500">{formatTime(tx.timestamp)}</p>
                            </div>
                        </div>

                        <div className="text-right">
                            <p className="font-semibold">{tx.amount} USDC</p>
                            <a
                                href={tx.explorerUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-blue-400 hover:text-blue-300"
                            >
                                View TX →
                            </a>
                        </div>
                    </div>
                ))}
            </div>

            {transactions.length > 0 && (
                <div className="mt-4 text-center">
                    <a
                        href={`${baseExplorerUrl}/address/${address}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-gray-400 hover:text-white"
                    >
                        View all on BaseScan →
                    </a>
                </div>
            )}
        </div>
    );
}
