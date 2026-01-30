import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, createWalletClient, http, type Hash, isAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base, baseSepolia } from 'viem/chains';

// Environment configuration
const WEBHOOK_AUTH_TOKEN = process.env.WEBHOOK_AUTH_TOKEN || '';
const SIGNER_PRIVATE_KEY = process.env.SIGNER_PRIVATE_KEY || '';
const BRIDGE_ADDRESS = process.env.BRIDGE_BASE_ADDRESS as `0x${string}` | undefined;
const STACKS_CONTRACT_ID = process.env.STACKS_CONTRACT_ID || '';
const IS_MAINNET = process.env.NEXT_PUBLIC_NETWORK === 'mainnet';

const chain = IS_MAINNET ? base : baseSepolia;
const rpcUrl = IS_MAINNET
    ? (process.env.NEXT_PUBLIC_BASE_MAINNET_RPC_URL || 'https://mainnet.base.org')
    : (process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org');

// BridgeBase ABI (minimal for queueRelease)
const BRIDGE_ABI = [
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
] as const;

// Create clients
const publicClient = createPublicClient({
    chain,
    transport: http(rpcUrl),
});

let bridgeCodeCheck: Promise<boolean> | null = null;

function getWalletClient() {
    const privateKey = normalizePrivateKey(SIGNER_PRIVATE_KEY);
    if (!privateKey) return null;
    const account = privateKeyToAccount(privateKey);
    return createWalletClient({
        account,
        chain,
        transport: http(rpcUrl),
    });
}

interface ClarityValue {
    type: string;
    value: string | number | Record<string, ClarityValue>;
}

interface BurnData {
    event?: string;
    sender?: string;
    amount?: string | number;
    'base-address'?: string;
}

/**
 * Parse Clarity value from Chainhook event
 */
function parseClarityValue(value: ClarityValue): BurnData | string | number | null {
    if (!value) return null;

    // Handle tuple type
    if (value.type === 'tuple' && typeof value.value === 'object') {
        const result: Record<string, unknown> = {};
        for (const [key, val] of Object.entries(value.value)) {
            result[key] = parseClarityValue(val);
        }
        return result as BurnData;
    }

    // Handle primitive types
    if (value.type === 'string_ascii' || value.type === 'string_utf8') {
        return value.value as string;
    }
    if (value.type === 'uint') {
        return value.value as string;
    }
    if (value.type === 'principal') {
        return value.value as string;
    }

    return typeof value.value === 'object' ? null : value.value;
}

/**
 * Queue a release on Base
 */
async function queueRelease(receiver: string, amount: bigint): Promise<Hash | null> {
    const walletClient = getWalletClient();
    if (!walletClient || !BRIDGE_ADDRESS) {
        console.error('Missing wallet client or bridge address');
        return null;
    }

    const hasBridgeCode = await ensureBridgeContract();
    if (!hasBridgeCode) {
        console.error('Bridge contract not found on network');
        return null;
    }

    console.log(`📤 Queueing release: ${receiver} for ${Number(amount) / 1e6} USDC`);

    const hash = await walletClient.writeContract({
        address: BRIDGE_ADDRESS,
        abi: BRIDGE_ABI,
        functionName: 'queueRelease',
        args: [receiver as `0x${string}`, amount],
    });

    console.log(`✅ Release queued: ${hash}`);
    return hash;
}

/**
 * Process a burn transaction from Chainhook
 */
interface TransactionEvent {
    type: string;
    data?: {
        value?: ClarityValue;
        contract_identifier?: string;
        contract_id?: string;
    };
}

interface Transaction {
    transaction_identifier?: { hash: string };
    contract_call?: { contract_id?: string; contract_identifier?: string };
    metadata?: {
        kind?: { type: string };
        receipt?: {
            events?: TransactionEvent[];
        };
    };
}

async function processBurnTransaction(tx: Transaction): Promise<Hash | null> {
    // Look for burn events in contract calls
    if (tx.metadata?.kind?.type !== 'ContractCall') return null;

    const events = tx.metadata?.receipt?.events || [];

    for (const event of events) {
        if (event.type !== 'SmartContractEvent') continue;

        const eventContractId = extractContractId(tx, event);
        if (STACKS_CONTRACT_ID && eventContractId && eventContractId !== STACKS_CONTRACT_ID) {
            continue;
        }

        // Check if it's a burn event from our contract
        const eventData = event.data?.value;
        if (!eventData) continue;

        // Parse the burn event data
        const burnData = parseClarityValue(eventData);
        if (typeof burnData !== 'object' || burnData?.event !== 'burn') continue;

        console.log('\n🔥 Burn event from Chainhook:');
        console.log(`   Sender: ${burnData.sender}`);
        console.log(`   Amount: ${Number(burnData.amount) / 1e6} USDC`);
        console.log(`   To Base: ${burnData['base-address']}`);
        console.log(`   TX: ${tx.transaction_identifier?.hash}`);

        const baseAddress = burnData['base-address'];
        const amount = burnData.amount;

        const receiver = normalizeBaseAddress(baseAddress);
        const parsedAmount = parseAmount(amount);

        if (receiver && parsedAmount) {
            return await queueRelease(receiver, parsedAmount);
        }
    }

    return null;
}

interface Block {
    transactions?: Transaction[];
}

interface ChainhookPayload {
    apply?: Block[];
    rollback?: Block[];
}

/**
 * POST /api/chainhook/burn
 * Receives Chainhook webhook events for burn transactions
 */
export async function POST(request: NextRequest) {
    const configErrors = getConfigErrors();
    if (configErrors.length > 0) {
        console.error(`❌ Missing/invalid config: ${configErrors.join(', ')}`);
        return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    // Verify authorization
    const authHeader = request.headers.get('authorization');
    if (!WEBHOOK_AUTH_TOKEN || authHeader !== `Bearer ${WEBHOOK_AUTH_TOKEN}`) {
        console.log('⚠️ Unauthorized webhook request');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('\n📨 Chainhook event received');

    try {
        const body = await request.json() as ChainhookPayload;
        const { apply, rollback } = body;
        const results: Hash[] = [];

        // Handle applied transactions (new burns)
        if (apply && Array.isArray(apply)) {
            for (const block of apply) {
                for (const tx of block.transactions || []) {
                    const hash = await processBurnTransaction(tx);
                    if (hash) results.push(hash);
                }
            }
        }

        // Handle rollbacks (reorgs - rare on Stacks)
        if (rollback && Array.isArray(rollback)) {
            console.log(`⚠️ Rollback detected for ${rollback.length} blocks`);
            // In production, you'd want to cancel pending releases
        }

        return NextResponse.json({
            status: 'processed',
            releasesQueued: results.length,
            hashes: results,
        });
    } catch (error) {
        console.error('❌ Error processing webhook:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}

/**
 * GET /api/chainhook/burn
 * Health check endpoint
 */
export async function GET() {
    const configErrors = getConfigErrors();
    return NextResponse.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        network: IS_MAINNET ? 'mainnet' : 'testnet',
        bridgeAddress: BRIDGE_ADDRESS || 'not configured',
        configStatus: configErrors.length === 0 ? 'ready' : 'missing',
        configErrors,
    });
}

function normalizePrivateKey(value: string): `0x${string}` | null {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const normalized = trimmed.startsWith('0x') ? trimmed : `0x${trimmed}`;
    return /^0x[0-9a-fA-F]{64}$/.test(normalized) ? (normalized as `0x${string}`) : null;
}

function normalizeBaseAddress(value: unknown): `0x${string}` | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return isAddress(trimmed) ? (trimmed as `0x${string}`) : null;
}

function parseAmount(value: unknown): bigint | null {
    if (value === null || value === undefined) return null;
    try {
        const amount = typeof value === 'bigint' ? value : BigInt(value as string | number);
        return amount > 0n ? amount : null;
    } catch {
        return null;
    }
}

function extractContractId(tx: Transaction, event: TransactionEvent): string | null {
    const fromEvent =
        event.data?.contract_identifier ||
        event.data?.contract_id;
    if (fromEvent) return fromEvent;
    return tx.contract_call?.contract_identifier || tx.contract_call?.contract_id || null;
}

function getConfigErrors(): string[] {
    const errors: string[] = [];
    if (!WEBHOOK_AUTH_TOKEN) errors.push('WEBHOOK_AUTH_TOKEN');
    if (!normalizePrivateKey(SIGNER_PRIVATE_KEY)) errors.push('SIGNER_PRIVATE_KEY');
    if (!BRIDGE_ADDRESS || !isAddress(BRIDGE_ADDRESS)) errors.push('BRIDGE_BASE_ADDRESS');
    return errors;
}

async function ensureBridgeContract(): Promise<boolean> {
    if (!BRIDGE_ADDRESS || !isAddress(BRIDGE_ADDRESS)) {
        return false;
    }

    if (!bridgeCodeCheck) {
        bridgeCodeCheck = publicClient
            .getBytecode({ address: BRIDGE_ADDRESS })
            .then((code) => Boolean(code && code !== '0x'))
            .catch((error) => {
                console.error('Failed to verify bridge contract code:', error);
                return false;
            });
    }

    return bridgeCodeCheck;
}
