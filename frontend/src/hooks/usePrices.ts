'use client';

import { useState, useEffect, useCallback } from 'react';
import { useReadContract, useBlockNumber } from 'wagmi';
import { base } from 'wagmi/chains';
import { formatUnits } from 'viem';

// Chainlink ETH/USD Price Feed on Base Mainnet
const CHAINLINK_ETH_USD_BASE = '0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70';

// Chainlink Aggregator V3 ABI (minimal)
const CHAINLINK_ABI = [
    {
        type: 'function',
        name: 'latestRoundData',
        inputs: [],
        outputs: [
            { name: 'roundId', type: 'uint80' },
            { name: 'answer', type: 'int256' },
            { name: 'startedAt', type: 'uint256' },
            { name: 'updatedAt', type: 'uint256' },
            { name: 'answeredInRound', type: 'uint80' },
        ],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'decimals',
        inputs: [],
        outputs: [{ name: '', type: 'uint8' }],
        stateMutability: 'view',
    },
] as const;

// Coinbase API endpoint for STX price
const COINBASE_STX_URL = 'https://api.coinbase.com/v2/prices/STX-USD/spot';

// Etherscan Gas Oracle API (optional API key to reduce rate limits)
const ETHERSCAN_API_KEY = process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY || '';
const ETHERSCAN_GAS_URL = `https://api.etherscan.io/api?module=gastracker&action=gasoracle${ETHERSCAN_API_KEY ? `&apikey=${ETHERSCAN_API_KEY}` : ''}`;

// Fallback prices if APIs fail
const FALLBACK_ETH_USD = 2400;
const FALLBACK_STX_USD = 0.80;
const FALLBACK_L1_GAS_GWEI = 30; // Typical L1 gas price

// Cache duration
const STX_CACHE_MS = 5 * 60 * 1000; // 5 minutes
const L1_GAS_CACHE_MS = 60 * 1000; // 1 minute

// Typical L1 bridge transaction gas usage
const L1_BRIDGE_GAS_USED = 150000n; // ~150k gas for L1 bridge tx

interface PriceData {
    ethUsd: number;
    stxUsd: number;
    l1GasGwei: number;
    l1BridgeFeeUsd: number;
    ethSource: 'chainlink' | 'fallback';
    stxSource: 'coinbase' | 'fallback';
    l1GasSource: 'etherscan' | 'fallback';
    lastUpdated: Date;
}

// Module-level caches
let stxPriceCache: { price: number; timestamp: number; source: 'coinbase' } | null = null;
let l1GasCache: { gasGwei: number; timestamp: number; source: 'etherscan' } | null = null;

async function fetchStxPrice(): Promise<{ price: number; source: 'coinbase' | 'fallback' }> {
    if (stxPriceCache && Date.now() - stxPriceCache.timestamp < STX_CACHE_MS) {
        return { price: stxPriceCache.price, source: stxPriceCache.source };
    }

    try {
        const response = await fetch(COINBASE_STX_URL);
        if (!response.ok) throw new Error('Coinbase API error');

        const data = await response.json();
        const price = parseFloat(data.data?.amount);

        if (Number.isFinite(price) && price > 0) {
            stxPriceCache = { price, timestamp: Date.now(), source: 'coinbase' };
            return { price, source: 'coinbase' };
        }
        throw new Error('Invalid price data');
    } catch (error) {
        console.warn('Failed to fetch STX price from Coinbase:', error);
        return { price: stxPriceCache?.price ?? FALLBACK_STX_USD, source: 'fallback' };
    }
}

async function fetchL1GasPrice(): Promise<{ gasGwei: number; source: 'etherscan' | 'fallback' }> {
    if (l1GasCache && Date.now() - l1GasCache.timestamp < L1_GAS_CACHE_MS) {
        return { gasGwei: l1GasCache.gasGwei, source: l1GasCache.source };
    }

    try {
        const response = await fetch(ETHERSCAN_GAS_URL);
        if (!response.ok) throw new Error('Etherscan API error');

        const data = await response.json();
        // Use ProposeGasPrice (standard speed)
        const gasGwei = parseFloat(data.result?.ProposeGasPrice);

        if (Number.isFinite(gasGwei) && gasGwei > 0) {
            l1GasCache = { gasGwei, timestamp: Date.now(), source: 'etherscan' };
            return { gasGwei, source: 'etherscan' };
        }
        throw new Error('Invalid gas data');
    } catch (error) {
        console.warn('Failed to fetch L1 gas from Etherscan:', error);
        return { gasGwei: l1GasCache?.gasGwei ?? FALLBACK_L1_GAS_GWEI, source: 'fallback' };
    }
}

export function usePrices(): PriceData {
    const isMainnet = process.env.NEXT_PUBLIC_NETWORK === 'mainnet';
    const [stxPrice, setStxPrice] = useState<number>(FALLBACK_STX_USD);
    const [stxSource, setStxSource] = useState<'coinbase' | 'fallback'>('fallback');
    const [l1GasGwei, setL1GasGwei] = useState<number>(FALLBACK_L1_GAS_GWEI);
    const [l1GasSource, setL1GasSource] = useState<'etherscan' | 'fallback'>('fallback');
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

    // Chainlink ETH/USD on Base
    const { data: ethPriceData, refetch: refetchEth } = useReadContract({
        address: CHAINLINK_ETH_USD_BASE,
        abi: CHAINLINK_ABI,
        functionName: 'latestRoundData',
        chainId: isMainnet ? base.id : undefined,
        query: { enabled: isMainnet },
    });

    const { data: blockNumber } = useBlockNumber({
        chainId: isMainnet ? base.id : undefined,
        watch: isMainnet,
        query: { enabled: isMainnet },
    });

    useEffect(() => {
        if (!isMainnet || blockNumber === undefined) return;
        refetchEth();
    }, [blockNumber, isMainnet, refetchEth]);

    // Calculate ETH price from Chainlink (8 decimals)
    const ethAnswer = ethPriceData?.[1];
    const ethUsd = isMainnet && typeof ethAnswer === 'bigint' && ethAnswer > 0n
        ? Number(formatUnits(ethAnswer, 8))
        : FALLBACK_ETH_USD;
    const ethSource: 'chainlink' | 'fallback' =
        isMainnet && typeof ethAnswer === 'bigint' && ethAnswer > 0n ? 'chainlink' : 'fallback';

    // Fetch STX price from Coinbase
    const fetchStx = useCallback(async () => {
        const result = await fetchStxPrice();
        setStxPrice(result.price);
        setStxSource(result.source);
        setLastUpdated(new Date());
    }, []);

    // Fetch L1 gas price from Etherscan
    const fetchL1Gas = useCallback(async () => {
        const result = await fetchL1GasPrice();
        setL1GasGwei(result.gasGwei);
        setL1GasSource(result.source);
        setLastUpdated(new Date());
    }, []);

    useEffect(() => {
        fetchStx();
        fetchL1Gas();

        // Refresh prices periodically
        const stxInterval = setInterval(fetchStx, STX_CACHE_MS);
        const l1GasInterval = setInterval(fetchL1Gas, L1_GAS_CACHE_MS);

        return () => {
            clearInterval(stxInterval);
            clearInterval(l1GasInterval);
        };
    }, [fetchStx, fetchL1Gas]);

    // Calculate L1 bridge fee in USD
    // L1 fee = gas_used * gas_price_gwei * 1e-9 * eth_price_usd
    const l1BridgeFeeUsd = Number(L1_BRIDGE_GAS_USED) * l1GasGwei * 1e-9 * ethUsd;

    return {
        ethUsd,
        stxUsd: stxPrice,
        l1GasGwei,
        l1BridgeFeeUsd,
        ethSource,
        stxSource,
        l1GasSource,
        lastUpdated,
    };
}
