/**
 * Chainhook Webhook Server
 * Receives real-time events from Hiro Chainhook for burn events
 */

import 'dotenv/config';
import express from 'express';
import { queueRelease } from './base-listener.js';
import { initWalletClient } from './base-listener.js';
import { validateConfig, SIGNER_CONFIG } from './config.js';

const app = express();
app.use(express.json());

const PORT = process.env.WEBHOOK_PORT || 3000;
const WEBHOOK_AUTH_TOKEN = process.env.WEBHOOK_AUTH_TOKEN || 'bridge-secret-token';

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

    for (const event of events) {
        if (event.type !== 'SmartContractEvent') continue;

        // Check if it's a burn event from our contract
        const eventData = event.data?.value;
        if (!eventData) continue;

        // Parse the burn event data
        // Format: {event: "burn", sender: principal, amount: uint, base-address: string}
        try {
            const burnData = parseClarityValue(eventData);

            if (burnData?.event === 'burn') {
                console.log('\n🔥 Burn event from Chainhook:');
                console.log(`   Sender: ${burnData.sender}`);
                console.log(`   Amount: ${Number(burnData.amount) / 1e6} USDC`);
                console.log(`   To Base: ${burnData['base-address']}`);
                console.log(`   TX: ${tx.transaction_identifier?.hash}`);

                // Queue release on Base
                await queueRelease(burnData['base-address'], BigInt(burnData.amount));
            }
        } catch (parseError) {
            // Not a burn event we care about
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

    // Initialize Base wallet for releases
    const signerAddress = initWalletClient();
    console.log(`🔑 Base Signer: ${signerAddress}`);

    app.listen(PORT, () => {
        console.log(`\n🚀 Webhook server running on port ${PORT}`);
        console.log(`📍 Endpoint: POST /chainhook/burn`);
        console.log(`🔐 Auth: Bearer ${WEBHOOK_AUTH_TOKEN.slice(0, 10)}...`);
        console.log('\nWaiting for Chainhook events...\n');
    });
}

main().catch(console.error);
