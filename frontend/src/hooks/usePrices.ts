'use client';

import { useState, useEffect, useCallback } from 'react';

// API endpoints
const COINBASE_STX_URL = 'https://api.coinbase.com/v2/prices/STX-USD/spot';
const COINGECKO_ETH_URL = 'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd';

// Etherscan API v2 (same key works for all chains including Base)
const ETHERSCAN_API_KEY = process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY || '';

// Basescan ETH price (chainid=8453) - requires API key
const BASESCAN_ETH_PRICE_URL = ETHERSCAN_API_KEY
    ? `https://api.etherscan.io/v2/api?chainid=8453&module=stats&action=ethprice&apikey=${ETHERSCAN_API_KEY}`
    : '';

// Etherscan L1 gas (chainid=1) - works with or without key
const ETHERSCAN_GAS_URL = `https://api.etherscan.io/v2/api?chainid=1&module=gastracker&action=gasoracle${ETHERSCAN_API_KEY ? `&apikey=${ETHERSCAN_API_KEY}` : ''}`;

// Fallback prices if APIs fail
const FALLBACK_ETH_USD = 2400;
const FALLBACK_STX_USD = 0.80;
const FALLBACK_L1_GAS_GWEI = 1; // Current low-gas environment (~0.5-2 Gwei typical)

// Cache duration
const ETH_CACHE_MS = 60 * 1000; // 1 minute
const STX_CACHE_MS = 5 * 60 * 1000; // 5 minutes
const L1_GAS_CACHE_MS = 60 * 1000; // 1 minute

// Typical L1 bridge transaction gas usage
const L1_BRIDGE_GAS_USED = 150000n; // ~150k gas for L1 bridge tx

type EthSource = 'basescan' | 'coingecko' | 'fallback';

interface PriceData {
    ethUsd: number;
    stxUsd: number;
    l1GasGwei: number;
    l1BridgeFeeUsd: number;
    ethSource: EthSource;
    stxSource: 'coinbase' | 'fallback';
    l1GasSource: 'etherscan' | 'fallback';
    lastUpdated: Date;
}

// Module-level caches
let ethPriceCache: { price: number; timestamp: number; source: EthSource } | null = null;
let stxPriceCache: { price: number; timestamp: number; source: 'coinbase' } | null = null;
let l1GasCache: { gasGwei: number; timestamp: number; source: 'etherscan' } | null = null;

// Try Basescan first (if API key exists), fallback to CoinGecko
async function fetchEthPrice(): Promise<{ price: number; source: EthSource }> {
    if (ethPriceCache && Date.now() - ethPriceCache.timestamp < ETH_CACHE_MS) {
        return { price: ethPriceCache.price, source: ethPriceCache.source };
    }

    // Try Basescan first if API key is available
    if (BASESCAN_ETH_PRICE_URL) {
        try {
            const response = await fetch(BASESCAN_ETH_PRICE_URL);
            if (response.ok) {
                const data = await response.json();
                if (data.status === '1' && data.message === 'OK') {
                    const price = parseFloat(data.result?.ethusd);
                    if (Number.isFinite(price) && price > 0) {
                        ethPriceCache = { price, timestamp: Date.now(), source: 'basescan' };
                        console.log('✅ ETH price from Basescan:', price.toFixed(2), 'USD');
                        return { price, source: 'basescan' };
                    }
                }
            }
            console.warn('Basescan API failed, trying CoinGecko...');
        } catch (error) {
            console.warn('Basescan fetch error:', error);
        }
    }

    // Fallback to CoinGecko (always works without API key)
    try {
        const response = await fetch(COINGECKO_ETH_URL);
        if (!response.ok) {
            throw new Error(`CoinGecko API error: ${response.status}`);
        }

        const data = await response.json();
        const price = data?.ethereum?.usd;

        if (Number.isFinite(price) && price > 0) {
            ethPriceCache = { price, timestamp: Date.now(), source: 'coingecko' };
            console.log('✅ ETH price from CoinGecko:', price.toFixed(2), 'USD');
            return { price, source: 'coingecko' };
        }
        throw new Error('Invalid ETH price data: ' + JSON.stringify(data));
    } catch (error) {
        console.warn('Failed to fetch ETH price from CoinGecko:', error);
        return { price: ethPriceCache?.price ?? FALLBACK_ETH_USD, source: 'fallback' };
    }
}

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
        if (!response.ok) {
            console.warn('Etherscan API response not ok:', response.status);
            throw new Error(`Etherscan API error: ${response.status}`);
        }

        const data = await response.json();
        console.log('Etherscan gas data:', data);

        // Check for API error response
        if (data.status !== '1' || data.message !== 'OK') {
            throw new Error(`Etherscan API error: ${data.message || 'Unknown error'}`);
        }

        // Use ProposeGasPrice (standard speed) - can be decimal like "0.496840168"
        const gasGwei = parseFloat(data.result?.ProposeGasPrice);

        if (Number.isFinite(gasGwei) && gasGwei > 0) {
            l1GasCache = { gasGwei, timestamp: Date.now(), source: 'etherscan' };
            console.log('✅ L1 gas updated:', gasGwei.toFixed(2), 'Gwei');
            return { gasGwei, source: 'etherscan' };
        }
        throw new Error('Invalid gas data: ' + JSON.stringify(data.result));
    } catch (error) {
        console.warn('Failed to fetch L1 gas from Etherscan:', error);
        return { gasGwei: l1GasCache?.gasGwei ?? FALLBACK_L1_GAS_GWEI, source: 'fallback' };
    }
}

export function usePrices(): PriceData {
    const [ethUsd, setEthUsd] = useState<number>(FALLBACK_ETH_USD);
    const [ethSource, setEthSource] = useState<EthSource>('fallback');
    const [stxPrice, setStxPrice] = useState<number>(FALLBACK_STX_USD);
    const [stxSource, setStxSource] = useState<'coinbase' | 'fallback'>('fallback');
    const [l1GasGwei, setL1GasGwei] = useState<number>(FALLBACK_L1_GAS_GWEI);
    const [l1GasSource, setL1GasSource] = useState<'etherscan' | 'fallback'>('fallback');
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

    // Fetch ETH price (Basescan if API key, else CoinGecko)
    const fetchEth = useCallback(async () => {
        const result = await fetchEthPrice();
        setEthUsd(result.price);
        setEthSource(result.source);
        setLastUpdated(new Date());
    }, []);

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
        fetchEth();
        fetchStx();
        fetchL1Gas();

        // Refresh prices periodically
        const ethInterval = setInterval(fetchEth, ETH_CACHE_MS);
        const stxInterval = setInterval(fetchStx, STX_CACHE_MS);
        const l1GasInterval = setInterval(fetchL1Gas, L1_GAS_CACHE_MS);

        return () => {
            clearInterval(ethInterval);
            clearInterval(stxInterval);
            clearInterval(l1GasInterval);
        };
    }, [fetchEth, fetchStx, fetchL1Gas]);

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
