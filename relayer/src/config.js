/**
 * Base <> Stacks USDC Bridge Relayer - Configuration
 */

import 'dotenv/config';

// Network configuration
export const NETWORK = process.env.NETWORK || 'testnet';
export const IS_MAINNET = NETWORK === 'mainnet';

const DEFAULT_BASE_RPC_URL = IS_MAINNET ? 'https://mainnet.base.org' : 'https://sepolia.base.org';
const DEFAULT_STACKS_API_URL = IS_MAINNET ? 'https://api.hiro.so' : 'https://api.testnet.hiro.so';

// Base (EVM) Configuration
export const BASE_CONFIG = {
    rpcUrl: process.env.BASE_RPC_URL || DEFAULT_BASE_RPC_URL,
    chainId: IS_MAINNET ? 8453 : 84532, // Base Mainnet : Base Sepolia
    bridgeAddress: process.env.BRIDGE_BASE_ADDRESS,
};

export const STACKS_CONFIG = {
    apiUrl: process.env.STACKS_API_URL || DEFAULT_STACKS_API_URL,
    contractAddress: process.env.STACKS_CONTRACT_ADDRESS,
    contractName: process.env.STACKS_CONTRACT_NAME || 'wrapped-usdc',
};

// Signer Configuration
export const SIGNER_CONFIG = {
    index: parseInt(process.env.SIGNER_INDEX || '1'),
    evmPrivateKey: process.env.SIGNER_PRIVATE_KEY,
    stacksPrivateKey: process.env.STACKS_PRIVATE_KEY,
};

// Rate limiting thresholds (must match contract)
export const LIMITS = {
    maxPerTx: 10_000n * 1_000_000n,      // 10,000 USDC
    hourlyLimit: 50_000n * 1_000_000n,    // 50,000 USDC
    dailyLimit: 200_000n * 1_000_000n,   // 200,000 USDC
};

// Timelock thresholds (must match contract)
export const TIMELOCK = {
    smallThreshold: 1_000n * 1_000_000n,   // 1,000 USDC
    mediumThreshold: 10_000n * 1_000_000n, // 10,000 USDC
    smallDelay: 0,
    mediumDelay: 10 * 60, // 10 minutes
    largeDelay: 60 * 60,  // 1 hour
};

// Polling intervals
export const POLLING = {
    baseEvents: 5_000,    // 5 seconds
    stacksEvents: 10_000, // 10 seconds
    pendingTx: 30_000,    // 30 seconds
};

// BridgeBase ABI (relevant events and functions)
export const BRIDGE_BASE_ABI = [
    // Events
    {
        type: 'event',
        name: 'Deposit',
        inputs: [
            { name: 'from', type: 'address', indexed: true },
            { name: 'amount', type: 'uint256', indexed: false },
            { name: 'stacksAddress', type: 'string', indexed: false },
            { name: 'timestamp', type: 'uint256', indexed: false },
        ],
    },
    {
        type: 'event',
        name: 'ReleaseQueued',
        inputs: [
            { name: 'releaseId', type: 'uint256', indexed: true },
            { name: 'receiver', type: 'address', indexed: true },
            { name: 'amount', type: 'uint256', indexed: false },
            { name: 'executeAfter', type: 'uint256', indexed: false },
        ],
    },
    {
        type: 'event',
        name: 'ReleaseApproved',
        inputs: [
            { name: 'releaseId', type: 'uint256', indexed: true },
            { name: 'signer', type: 'address', indexed: true },
            { name: 'approvalCount', type: 'uint256', indexed: false },
        ],
    },
    {
        type: 'event',
        name: 'ReleaseExecuted',
        inputs: [
            { name: 'releaseId', type: 'uint256', indexed: true },
            { name: 'receiver', type: 'address', indexed: true },
            { name: 'amount', type: 'uint256', indexed: false },
        ],
    },
    {
        type: 'event',
        name: 'EmergencyWithdraw',
        inputs: [
            { name: 'to', type: 'address', indexed: true },
            { name: 'amount', type: 'uint256', indexed: false },
            { name: 'by', type: 'address', indexed: true },
        ],
    },
    // Functions
    {
        type: 'function',
        name: 'queueRelease',
        inputs: [
            { name: 'receiver', type: 'address' },
            { name: 'amount', type: 'uint256' },
        ],
        outputs: [{ name: 'releaseId', type: 'uint256' }],
        stateMutability: 'nonpayable',
    },
    {
        type: 'function',
        name: 'approveRelease',
        inputs: [{ name: 'releaseId', type: 'uint256' }],
        outputs: [],
        stateMutability: 'nonpayable',
    },
    {
        type: 'function',
        name: 'executeRelease',
        inputs: [{ name: 'releaseId', type: 'uint256' }],
        outputs: [],
        stateMutability: 'nonpayable',
    },
    {
        type: 'function',
        name: 'getReleaseInfo',
        inputs: [{ name: 'releaseId', type: 'uint256' }],
        outputs: [
            { name: 'receiver', type: 'address' },
            { name: 'amount', type: 'uint256' },
            { name: 'executeAfter', type: 'uint256' },
            { name: 'approvalCount', type: 'uint256' },
            { name: 'executed', type: 'bool' },
            { name: 'cancelled', type: 'bool' },
        ],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'isSigner',
        inputs: [{ name: '', type: 'address' }],
        outputs: [{ name: '', type: 'bool' }],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'getPendingDeposit',
        inputs: [{ name: 'stacksAddress', type: 'string' }],
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
    },
];

// Validate configuration
export function validateConfig() {
    const errors = [];

    if (!BASE_CONFIG.bridgeAddress) {
        errors.push('BRIDGE_BASE_ADDRESS is required');
    }
    if (!STACKS_CONFIG.contractAddress) {
        errors.push('STACKS_CONTRACT_ADDRESS is required');
    }
    if (!SIGNER_CONFIG.evmPrivateKey) {
        errors.push('SIGNER_PRIVATE_KEY is required');
    }
    if (!SIGNER_CONFIG.stacksPrivateKey) {
        errors.push('STACKS_PRIVATE_KEY is required');
    }

    if (errors.length > 0) {
        console.error('❌ Configuration errors:');
        errors.forEach(e => console.error(`   - ${e}`));
        process.exit(1);
    }

    console.log('✅ Configuration validated');
}
