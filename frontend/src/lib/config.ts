// Bridge Configuration
export const config = {
    // Network mode
    network: 'testnet' as const,

    // Contract addresses (deployed)
    contracts: {
        base: {
            bridge: '0x06c6Fd0afa92062FE76DE72DA5EC7a63Ba01F6FC',
            usdc: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', // Base Sepolia USDC
        },
        stacks: {
            wrappedUsdc: 'ST1ZGGS886YCZHMFXJR1EK61ZP34FNWNSX28M1PMM.wrapped-usdc-v2',
        },
    },

    // Chain configuration
    chains: {
        base: {
            id: 84532,
            name: 'Base Sepolia',
            rpcUrl: 'https://sepolia.base.org',
            explorer: 'https://sepolia.basescan.org',
        },
        stacks: {
            network: 'testnet',
            apiUrl: 'https://api.testnet.hiro.so',
            explorer: 'https://explorer.hiro.so/?chain=testnet',
        },
    },

    // Rate limits (must match contracts)
    limits: {
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
