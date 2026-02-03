/**
 * Chainhook Webhook Server
 * Receives real-time events from Hiro Chainhook for burn events
 */

import 'dotenv/config';
import express from 'express';
import { initWalletClient, publicClient, queueRelease } from './base-listener.js';
import { BASE_CONFIG, validateConfig } from './config.js';
import { flushState, isBurnProcessed, markBurnProcessed } from './state.js';

const app = express();
app.use(express.json());

const DEFAULT_PORT = 3000;
const PORT = Number.parseInt(process.env.WEBHOOK_PORT || `${DEFAULT_PORT}`, 10);
const MAX_PORT_TRIES = Number.parseInt(process.env.WEBHOOK_PORT_TRIES || "5", 10);
const WEBHOOK_AUTH_TOKEN = process.env.WEBHOOK_AUTH_TOKEN || '';

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * Chainhook webhook endpoint for burn events
 * POST /chainhook/burn
 */
app.post('/chainhook/burn', async (req, res) => {
    // Verify authorization
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${WEBHOOK_AUTH_TOKEN}`) {
        console.log('⚠️ Unauthorized webhook request');
        return res.status(401).json({ error: 'Unauthorized' });
    }

    console.log('\n📨 Chainhook event received');

    try {
        const { apply, rollback } = req.body;

        // Handle applied transactions (new burns)
        if (apply && Array.isArray(apply)) {
            for (const block of apply) {
                for (const tx of block.transactions || []) {
                    await processBurnTransaction(tx);
                }
            }
        }

        // Handle rollbacks (reorgs - rare on Stacks)
        if (rollback && Array.isArray(rollback)) {
            console.log(`⚠️ Rollback detected for ${rollback.length} blocks`);
            // In production, you'd want to cancel pending releases
        }

        res.json({ status: 'processed' });
    } catch (error) {
        console.error('❌ Error processing webhook:', error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Process a burn transaction from Chainhook
 */
async function processBurnTransaction(tx) {
    // Look for burn events in contract calls
    if (tx.metadata?.kind?.type !== 'ContractCall') return;

    const events = tx.metadata?.receipt?.events || [];
    const txHash = tx.transaction_identifier?.hash;

    for (const event of events) {
        if (event.type !== 'SmartContractEvent') continue;

        // Check if it's a burn event from our contract
        const eventData = event.data?.value;
        if (!eventData) continue;

        // Parse the burn event data
        // Format: {event: "burn", sender: principal, amount: uint, base-address: string}
        let burnData;
        try {
            burnData = parseClarityValue(eventData);
        } catch (parseError) {
            continue;
        }

        if (burnData?.event !== 'burn') continue;
        if (txHash && isBurnProcessed(txHash)) {
            console.log(`   ⏭️ Already processed burn ${txHash.slice(0, 10)}...`);
            continue;
        }

        console.log('\n🔥 Burn event from Chainhook:');
        console.log(`   Sender: ${burnData.sender}`);
        console.log(`   Amount: ${Number(burnData.amount) / 1e6} USDC`);
        console.log(`   To Base: ${burnData['base-address']}`);
        console.log(`   TX: ${txHash}`);

        // Queue release on Base
        try {
            await queueRelease(burnData['base-address'], BigInt(burnData.amount));
            if (txHash) {
                markBurnProcessed(txHash, { txId: txHash });
            }
        } catch (error) {
            console.error('❌ Failed to queue release from burn:', error.message);
            throw error;
        }
    }
}

/**
 * Parse Clarity value from Chainhook event
 */
function parseClarityValue(value) {
    if (!value) return null;

    // Handle tuple type
    if (value.type === 'tuple' && value.value) {
        const result = {};
        for (const [key, val] of Object.entries(value.value)) {
            result[key] = parseClarityValue(val);
        }
        return result;
    }

    // Handle primitive types
    if (value.type === 'string_ascii' || value.type === 'string_utf8') {
        return value.value;
    }
    if (value.type === 'uint') {
        return value.value;
    }
    if (value.type === 'principal') {
        return value.value;
    }

    return value.value || value;
}

// Start server
async function main() {
    console.log('═'.repeat(60));
    console.log('🪝 Chainhook Webhook Server');
    console.log('═'.repeat(60));

    // Validate config
    validateConfig();
    if (!WEBHOOK_AUTH_TOKEN) {
        throw new Error('WEBHOOK_AUTH_TOKEN is required for the webhook server');
    }

    // Initialize Base wallet for releases
    const signerAddress = initWalletClient();
    console.log(`🔑 Base Signer: ${signerAddress}`);
    console.log(`🔗 Base RPC: ${BASE_CONFIG.rpcUrl}`);
    console.log(`🏗 Bridge: ${BASE_CONFIG.bridgeAddress}`);

    const bytecode = await publicClient.getBytecode({ address: BASE_CONFIG.bridgeAddress });
    if (!bytecode || bytecode === '0x') {
        throw new Error(
            `No contract code found at BRIDGE_BASE_ADDRESS=${BASE_CONFIG.bridgeAddress}. ` +
            `Did you redeploy and update relayer/.env?`
        );
    }

    const { port } = await startServer(PORT, MAX_PORT_TRIES);
    const portNote = port !== PORT ? ` (requested ${PORT})` : "";

    console.log(`\n🚀 Webhook server running on port ${port}${portNote}`);
    console.log(`📍 Endpoint: POST /chainhook/burn`);
    console.log(`🔐 Auth: Bearer ${WEBHOOK_AUTH_TOKEN.slice(0, 10)}...`);
    if (port !== PORT) {
        console.log(`🔧 Update WEBHOOK_PORT/WEBHOOK_URL for the simulator if needed`);
    }
    console.log('\nWaiting for Chainhook events...\n');
}

function startServer(port, remainingAttempts) {
    return new Promise((resolve, reject) => {
        const server = app.listen(port, () => resolve({ server, port }));
        server.on('error', (error) => {
            if (error.code === 'EADDRINUSE' && remainingAttempts > 0) {
                const nextPort = port + 1;
                console.warn(`⚠️ Port ${port} in use, trying ${nextPort}...`);
                server.close(() => {
                    startServer(nextPort, remainingAttempts - 1).then(resolve).catch(reject);
                });
                return;
            }
            reject(error);
        });
    });
}

main().catch((error) => {
    console.error(error);
    flushState();
    process.exit(1);
});
