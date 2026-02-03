/**
 * Base Chain Listener - Monitors Deposit events and pending releases
 */

import { createPublicClient, createWalletClient, http, keccak256, toHex } from 'viem';
import { baseSepolia, base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { BASE_CONFIG, BRIDGE_BASE_ABI, SIGNER_CONFIG, IS_MAINNET } from './config.js';
import { isDepositProcessed, markDepositProcessed } from './state.js';

// Create clients
const chain = IS_MAINNET ? base : baseSepolia;

export const publicClient = createPublicClient({
    chain,
    transport: http(BASE_CONFIG.rpcUrl),
});

let walletClient = null;

export function initWalletClient() {
    if (!SIGNER_CONFIG.evmPrivateKey) {
        throw new Error('SIGNER_PRIVATE_KEY not configured');
    }

    // Normalize private key - ensure it has 0x prefix
    let privateKey = SIGNER_CONFIG.evmPrivateKey.trim();
    if (!privateKey.startsWith('0x')) {
        privateKey = `0x${privateKey}`;
    }

    const account = privateKeyToAccount(privateKey);

    walletClient = createWalletClient({
        account,
        chain,
        transport: http(BASE_CONFIG.rpcUrl),
    });

    console.log(`🔑 Base Signer: ${account.address}`);
    return account.address;
}

// Track in-flight events to avoid duplicate processing within a poll window
const processingDeposits = new Set();

/**
 * Watch for Deposit events with auto-reconnect
 */
export function watchDeposits(onDeposit) {
    console.log('👀 Watching for Base Deposit events...');

    let unwatch = null;
    let isReconnecting = false;

    function startWatching() {
        unwatch = publicClient.watchContractEvent({
            address: BASE_CONFIG.bridgeAddress,
            abi: BRIDGE_BASE_ABI,
            eventName: 'Deposit',
            onLogs: (logs) => {
                for (const log of logs) {
                    const eventId = `${log.transactionHash}-${log.logIndex}`;

                    if (isDepositProcessed(eventId) || processingDeposits.has(eventId)) continue;
                    processingDeposits.add(eventId);

                    const { from, amount, stacksAddress, timestamp } = log.args;

                    console.log('\n📥 New Deposit Detected:');
                    console.log(`   From: ${from}`);
                    console.log(`   Amount: ${Number(amount) / 1e6} USDC`);
                    console.log(`   To Stacks: ${stacksAddress}`);
                    console.log(`   TX: ${log.transactionHash}`);

                    Promise.resolve(onDeposit({
                        from,
                        amount,
                        stacksAddress,
                        timestamp,
                        txHash: log.transactionHash,
                        blockNumber: log.blockNumber,
                    }))
                        .then(() => {
                            markDepositProcessed(eventId, {
                                txHash: log.transactionHash,
                                blockNumber: Number(log.blockNumber || 0),
                                logIndex: log.logIndex,
                            });
                        })
                        .catch((error) => {
                            console.error(
                                `   ❌ Failed to handle deposit ${log.transactionHash.slice(0, 10)}...`,
                                error.message
                            );
                        })
                        .finally(() => {
                            processingDeposits.delete(eventId);
                        });
                }
            },
            onError: (error) => {
                // Filter expired or connection issue - recreate
                if (error.message?.includes('filter not found') ||
                    error.message?.includes('filter_not_found') ||
                    error.message?.includes('-32000')) {
                    if (!isReconnecting) {
                        isReconnecting = true;
                        console.log('🔄 Filter expired, recreating...');
                        if (unwatch) unwatch();
                        setTimeout(() => {
                            isReconnecting = false;
                            startWatching();
                        }, 1000);
                    }
                } else {
                    console.error('❌ Error watching deposits:', error.message);
                }
            },
        });
    }

    startWatching();

    return () => {
        if (unwatch) unwatch();
    };
}

/**
 * Queue a release on Base (for burns on Stacks)
 */
export async function queueRelease(receiver, amount) {
    if (!walletClient) {
        throw new Error('Wallet client not initialized');
    }

    console.log(`\n🔐 Queuing release on Base:`);
    console.log(`   Receiver: ${receiver}`);
    console.log(`   Amount: ${Number(amount) / 1e6} USDC`);

    try {
        const hash = await walletClient.writeContract({
            address: BASE_CONFIG.bridgeAddress,
            abi: BRIDGE_BASE_ABI,
            functionName: 'queueRelease',
            args: [receiver, amount],
        });

        console.log(`   TX Hash: ${hash}`);

        // Wait for confirmation
        const receipt = await publicClient.waitForTransactionReceipt({ hash });

        // Extract releaseId from ReleaseQueued event
        // Topic = keccak256("ReleaseQueued(uint256,address,uint256,uint256)")
        const RELEASE_QUEUED_TOPIC = keccak256(toHex('ReleaseQueued(uint256,address,uint256,uint256)'));
        const releaseQueuedLog = receipt.logs.find(log => {
            return log.topics[0] === RELEASE_QUEUED_TOPIC;
        });

        console.log(`   ✅ Release queued in block ${receipt.blockNumber}`);

        return { hash, receipt };
    } catch (error) {
        console.error(`   ❌ Failed to queue release:`, error.message);
        throw error;
    }
}

/**
 * Approve a pending release
 */
export async function approveRelease(releaseId) {
    if (!walletClient) {
        throw new Error('Wallet client not initialized');
    }

    console.log(`\n✍️ Approving release #${releaseId}...`);

    try {
        const hash = await walletClient.writeContract({
            address: BASE_CONFIG.bridgeAddress,
            abi: BRIDGE_BASE_ABI,
            functionName: 'approveRelease',
            args: [releaseId],
        });

        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        console.log(`   ✅ Approved in block ${receipt.blockNumber}`);

        return { hash, receipt };
    } catch (error) {
        console.error(`   ❌ Failed to approve:`, error.message);
        throw error;
    }
}

/**
 * Execute a release after timelock
 */
export async function executeRelease(releaseId) {
    if (!walletClient) {
        throw new Error('Wallet client not initialized');
    }

    console.log(`\n🚀 Executing release #${releaseId}...`);

    try {
        const hash = await walletClient.writeContract({
            address: BASE_CONFIG.bridgeAddress,
            abi: BRIDGE_BASE_ABI,
            functionName: 'executeRelease',
            args: [releaseId],
        });

        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        console.log(`   ✅ Executed in block ${receipt.blockNumber}`);

        return { hash, receipt };
    } catch (error) {
        console.error(`   ❌ Failed to execute:`, error.message);
        throw error;
    }
}

/**
 * Get release info
 */
export async function getReleaseInfo(releaseId) {
    const result = await publicClient.readContract({
        address: BASE_CONFIG.bridgeAddress,
        abi: BRIDGE_BASE_ABI,
        functionName: 'getReleaseInfo',
        args: [releaseId],
    });

    return {
        receiver: result[0],
        amount: result[1],
        executeAfter: result[2],
        approvalCount: result[3],
        executed: result[4],
        cancelled: result[5],
    };
}

/**
 * Check if address is signer
 */
export async function checkIsSigner(address) {
    return await publicClient.readContract({
        address: BASE_CONFIG.bridgeAddress,
        abi: BRIDGE_BASE_ABI,
        functionName: 'isSigner',
        args: [address],
    });
}
