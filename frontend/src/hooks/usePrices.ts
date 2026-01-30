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

// Fallback prices if APIs fail
const FALLBACK_ETH_USD = 2400;
const FALLBACK_STX_USD = 0.80;

// Cache duration (5 minutes for STX, ETH updates on each block via Chainlink)
const STX_CACHE_MS = 5 * 60 * 1000;

interface PriceData {
    ethUsd: number;
    stxUsd: number;
    ethSource: 'chainlink' | 'fallback';
    stxSource: 'coinbase' | 'fallback';
    lastUpdated: Date;
}

// Module-level cache for STX price
let stxPriceCache: { price: number; timestamp: number } | null = null;

async function fetchStxPrice(): Promise<number> {
    // Check cache first
    if (stxPriceCache && Date.now() - stxPriceCache.timestamp < STX_CACHE_MS) {
        return stxPriceCache.price;
    }

    try {
        const response = await fetch(COINBASE_STX_URL);
        if (!response.ok) throw new Error('Coinbase API error');

        const data = await response.json();
        const price = parseFloat(data.data?.amount);

        if (Number.isFinite(price) && price > 0) {
            stxPriceCache = { price, timestamp: Date.now() };
            return price;
        }
        throw new Error('Invalid price data');
    } catch (error) {
        console.warn('Failed to fetch STX price from Coinbase:', error);
        return stxPriceCache?.price ?? FALLBACK_STX_USD;
    }
}

export function usePrices(): PriceData {
    const isMainnet = process.env.NEXT_PUBLIC_NETWORK === 'mainnet';
    const [stxPrice, setStxPrice] = useState<number>(FALLBACK_STX_USD);
    const [stxSource, setStxSource] = useState<'coinbase' | 'fallback'>('fallback');
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
        const price = await fetchStxPrice();
        setStxPrice(price);
        setStxSource(stxPriceCache ? 'coinbase' : 'fallback');
        setLastUpdated(new Date());
    }, []);

    useEffect(() => {
        fetchStx();

        // Refresh STX price every 5 minutes
        const interval = setInterval(fetchStx, STX_CACHE_MS);
        return () => clearInterval(interval);
    }, [fetchStx]);

    return {
        ethUsd,
        stxUsd: stxPrice,
        ethSource,
        stxSource,
        lastUpdated,
    };
}
