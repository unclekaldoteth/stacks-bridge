// Bridge Configuration
const isMainnet = process.env.NEXT_PUBLIC_NETWORK === 'mainnet';

export const config = {
    // Network mode (can be 'testnet' or 'mainnet')
    network: (process.env.NEXT_PUBLIC_NETWORK || 'testnet') as 'testnet' | 'mainnet',

    // Contract addresses (deployed)
    contracts: {
        base: {
            bridge: isMainnet
                ? '0x0EdF28403D027Be0917625C751c78236407dD4E0'  // Mainnet
                : '0xFCDF3e427e4a4CF3E573762693B9a1bBb35C504B', // Testnet
            usdc: isMainnet
                ? '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'  // Base Mainnet USDC
                : '0x036CbD53842c5426634e7929541eC2318f3dCF7e', // Base Sepolia USDC
        },
        stacks: {
            wrappedUsdc: isMainnet
                ? 'SP1MTYHV6K2FNH3QNF4P5QXS9VJ3XZ0GBB5T1SJPK.wrapped-usdc-v5' // Mainnet (pending)
                : 'ST1ZGGS886YCZHMFXJR1EK61ZP34FNWNSX28M1PMM.wrapped-usdc-v5', // Testnet
            // Official Circle USDCx
            usdcx: 'SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE.usdcx',
        },
    },

    // Chain configuration
    chains: {
        base: {
            id: isMainnet ? 8453 : 84532,
            name: isMainnet ? 'Base' : 'Base Sepolia',
            rpcUrl: isMainnet ? 'https://mainnet.base.org' : 'https://sepolia.base.org',
            explorer: isMainnet ? 'https://basescan.org' : 'https://sepolia.basescan.org',
        },
        stacks: {
            network: isMainnet ? 'mainnet' : 'testnet',
            apiUrl: isMainnet ? 'https://api.hiro.so' : 'https://api.testnet.hiro.so',
            explorer: isMainnet ? 'https://explorer.hiro.so' : 'https://explorer.hiro.so/?chain=testnet',
        },
    },

    // Rate limits (must match contracts)
    limits: {
        minDeposit: 10,        // 10 USDC minimum to prevent dust attacks
        maxPerTx: 10_000,      // USDC
        hourlyLimit: 50_000,   // USDC
        dailyLimit: 200_000,   // USDC
    },

    // Gas estimates for fee calculation
    gasEstimates: {
        // Base (EVM) - in gwei
        baseLock: 100_000n, // Estimated gas for lock()
        baseRelease: 80_000n,

        // Stacks - in microSTX
        stacksMint: 10_000n,
        stacksBurn: 8_000n,
    },
};

// USDC ABI (minimal for approve and transfer)
export const USDC_ABI = [
    {
        name: 'approve',
        type: 'function',
        inputs: [
            { name: 'spender', type: 'address' },
            { name: 'amount', type: 'uint256' },
        ],
        outputs: [{ type: 'bool' }],
        stateMutability: 'nonpayable',
    },
    {
        name: 'allowance',
        type: 'function',
        inputs: [
            { name: 'owner', type: 'address' },
            { name: 'spender', type: 'address' },
        ],
        outputs: [{ type: 'uint256' }],
        stateMutability: 'view',
    },
    {
        name: 'balanceOf',
        type: 'function',
        inputs: [{ name: 'account', type: 'address' }],
        outputs: [{ type: 'uint256' }],
        stateMutability: 'view',
    },
] as const;

// Bridge ABI (lock function)
export const BRIDGE_ABI = [
    {
        name: 'lock',
        type: 'function',
        inputs: [
            { name: 'amount', type: 'uint256' },
            { name: 'stacksAddress', type: 'string' },
        ],
        outputs: [],
        stateMutability: 'nonpayable',
    },
    {
        name: 'getLockedBalance',
        type: 'function',
        inputs: [],
        outputs: [{ type: 'uint256' }],
        stateMutability: 'view',
    },
] as const;
