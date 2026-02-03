/**
 * Base <> Stacks USDC Bridge Relayer
 * 
 * This relayer:
 * 1. Watches Base for Deposit events → Queues mint on Stacks
 * 2. Polls Stacks for burn events → Queues release on Base
 * 3. Manages multi-sig approvals and timelock execution
 */

import { validateConfig, SIGNER_CONFIG, POLLING } from './config.js';
import { flushState, getStateInfo } from './state.js';
import {
    initWalletClient,
    watchDeposits,
    queueRelease,
    checkIsSigner
} from './base-listener.js';
import {
    queueMint,
    pollBurnEvents
} from './stacks-handler.js';

// Pending actions queue
const pendingMints = new Map(); // depositTxHash -> mintId
const pendingReleases = new Map(); // burnTxId -> releaseId

// State
let isRunning = false;

/**
 * Handle a new deposit on Base → Queue mint on Stacks
 */
async function handleDeposit(deposit) {
    const { from, amount, stacksAddress, txHash } = deposit;

    // Skip if already processed
    if (pendingMints.has(txHash)) {
        console.log(`   ⏭️ Already processed deposit ${txHash.slice(0, 10)}...`);
        return;
    }

    try {
        // Queue mint on Stacks
        const mintTxId = await queueMint(stacksAddress, amount);

        pendingMints.set(txHash, {
            mintTxId,
            recipient: stacksAddress,
            amount,
            queuedAt: Date.now(),
        });

        console.log(`   📍 Tracking mint for deposit ${txHash.slice(0, 10)}...`);
    } catch (error) {
        console.error(`   ❌ Failed to queue mint for deposit:`, error.message);
    }
}

/**
 * Handle a burn on Stacks → Queue release on Base
 */
async function handleBurn(burn) {
    const { baseAddress, amount, txId } = burn;

    // Skip if already processed
    if (pendingReleases.has(txId)) {
        console.log(`   ⏭️ Already processed burn ${txId.slice(0, 10)}...`);
        return;
    }

    try {
        // Queue release on Base
        const { hash } = await queueRelease(baseAddress, amount);

        pendingReleases.set(txId, {
            releaseTxHash: hash,
            receiver: baseAddress,
            amount,
            queuedAt: Date.now(),
        });

        console.log(`   📍 Tracking release for burn ${txId.slice(0, 10)}...`);
    } catch (error) {
        console.error(`   ❌ Failed to queue release for burn:`, error.message);
    }
}

/**
 * Poll Stacks for burn events
 */
async function pollStacksBurns() {
    try {
        await pollBurnEvents(handleBurn);
    } catch (error) {
        console.error('Error in Stacks polling:', error.message);
    }
}

/**
 * Main relayer loop
 */
async function main() {
    console.log('═'.repeat(60));
    console.log('🌉 Base <> Stacks USDC Bridge Relayer');
    console.log('═'.repeat(60));

    // Validate configuration
    validateConfig();

    // Initialize Base wallet
    const signerAddress = initWalletClient();

    // Verify signer is authorized
    const isSigner = await checkIsSigner(signerAddress);
    if (!isSigner) {
        console.error(`❌ Address ${signerAddress} is not an authorized signer`);
        process.exit(1);
    }
    console.log(`✅ Signer verified on Base contract`);

    console.log(`\n📊 Signer Index: ${SIGNER_CONFIG.index}`);
    console.log(`🔗 Watching for cross-chain events...\n`);
    const stateInfo = getStateInfo();
    console.log(`🧠 State file: ${stateInfo.path}`);

    isRunning = true;

    // Watch Base deposits
    const unwatchDeposits = watchDeposits(handleDeposit);

    // Poll Stacks burns
    const stacksPoller = setInterval(pollStacksBurns, POLLING.stacksEvents);

    // Graceful shutdown
    process.on('SIGINT', () => {
        console.log('\n\n🛑 Shutting down relayer...');
        isRunning = false;
        unwatchDeposits();
        clearInterval(stacksPoller);

        console.log('📊 Session Stats:');
        console.log(`   Deposits processed: ${pendingMints.size}`);
        console.log(`   Burns processed: ${pendingReleases.size}`);
        console.log('👋 Goodbye!');
        flushState();
        process.exit(0);
    });

    // Keep alive
    console.log('Relayer running. Press Ctrl+C to stop.\n');
}

// Run
main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
