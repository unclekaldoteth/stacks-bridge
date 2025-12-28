/**
 * Stacks Chain Handler - Minting and burn event monitoring
 */

import {
    makeContractCall,
    broadcastTransaction,
    AnchorMode,
    PostConditionMode,
    uintCV,
    principalCV,
    stringAsciiCV,
    cvToJSON,
} from '@stacks/transactions';
import { StacksTestnet, StacksMainnet } from '@stacks/network';
import { generateWallet } from '@stacks/wallet-sdk';
import { STACKS_CONFIG, SIGNER_CONFIG, IS_MAINNET, POLLING } from './config.js';

// Network setup
const network = IS_MAINNET ? new StacksMainnet() : new StacksTestnet();

// Track processed events
const processedBurns = new Set();

// Cache for derived private key
let derivedPrivateKey = null;

/**
 * Derive private key from mnemonic (if mnemonic is provided)
 */
async function getStacksPrivateKey() {
    if (derivedPrivateKey) return derivedPrivateKey;

    const key = SIGNER_CONFIG.stacksPrivateKey;
    if (!key) throw new Error('STACKS_PRIVATE_KEY not configured');

    // Check if it's a mnemonic (has spaces) or hex key
    if (key.includes(' ')) {
        console.log('   🔑 Deriving key from mnemonic...');
        const wallet = await generateWallet({
            secretKey: key,
            password: '',
        });
        derivedPrivateKey = wallet.accounts[0].stxPrivateKey;
    } else {
        // Already a hex private key
        derivedPrivateKey = key;
    }

    return derivedPrivateKey;
}

/**
 * Queue a mint on Stacks (for deposits on Base)
 */
export async function queueMint(recipient, amount) {
    const privateKey = await getStacksPrivateKey();

    console.log(`\n🔐 Queuing mint on Stacks:`);
    console.log(`   Recipient: ${recipient}`);
    console.log(`   Amount: ${Number(amount) / 1e6} USDC`);

    try {
        const txOptions = {
            contractAddress: STACKS_CONFIG.contractAddress,
            contractName: STACKS_CONFIG.contractName,
            functionName: 'queue-mint',
            functionArgs: [
                principalCV(recipient),
                uintCV(amount),
            ],
            senderKey: privateKey,
            network,
            anchorMode: AnchorMode.Any,
            postConditionMode: PostConditionMode.Allow,
        };

        const transaction = await makeContractCall(txOptions);
        const broadcastResponse = await broadcastTransaction(transaction, network);

        if (broadcastResponse.error) {
            throw new Error(broadcastResponse.error);
        }

        console.log(`   TX ID: ${broadcastResponse.txid}`);
        console.log(`   ✅ Mint queued`);

        return broadcastResponse.txid;
    } catch (error) {
        console.error(`   ❌ Failed to queue mint:`, error.message);
        throw error;
    }
}

/**
 * Approve a pending mint
 */
export async function approveMint(mintId) {
    const privateKey = await getStacksPrivateKey();

    console.log(`\n✍️ Approving mint #${mintId} on Stacks...`);

    try {
        const txOptions = {
            contractAddress: STACKS_CONFIG.contractAddress,
            contractName: STACKS_CONFIG.contractName,
            functionName: 'approve-mint',
            functionArgs: [uintCV(mintId)],
            senderKey: privateKey,
            network,
            anchorMode: AnchorMode.Any,
            postConditionMode: PostConditionMode.Allow,
        };

        const transaction = await makeContractCall(txOptions);
        const broadcastResponse = await broadcastTransaction(transaction, network);

        if (broadcastResponse.error) {
            throw new Error(broadcastResponse.error);
        }

        console.log(`   TX ID: ${broadcastResponse.txid}`);
        console.log(`   ✅ Approved`);

        return broadcastResponse.txid;
    } catch (error) {
        console.error(`   ❌ Failed to approve:`, error.message);
        throw error;
    }
}

/**
 * Execute a pending mint after timelock
 */
export async function executeMint(mintId) {
    const privateKey = await getStacksPrivateKey();

    console.log(`\n🚀 Executing mint #${mintId} on Stacks...`);

    try {
        const txOptions = {
            contractAddress: STACKS_CONFIG.contractAddress,
            contractName: STACKS_CONFIG.contractName,
            functionName: 'execute-mint',
            functionArgs: [uintCV(mintId)],
            senderKey: privateKey,
            network,
            anchorMode: AnchorMode.Any,
            postConditionMode: PostConditionMode.Allow,
        };

        const transaction = await makeContractCall(txOptions);
        const broadcastResponse = await broadcastTransaction(transaction, network);

        if (broadcastResponse.error) {
            throw new Error(broadcastResponse.error);
        }

        console.log(`   TX ID: ${broadcastResponse.txid}`);
        console.log(`   ✅ Executed`);

        return broadcastResponse.txid;
    } catch (error) {
        console.error(`   ❌ Failed to execute:`, error.message);
        throw error;
    }
}

/**
 * Poll for burn events from Stacks API
 */
export async function pollBurnEvents(onBurn, lastProcessedBlock = 0) {
    try {
        // Fetch recent contract events from Hiro API
        const url = `${STACKS_CONFIG.apiUrl}/extended/v1/contract/${STACKS_CONFIG.contractAddress}.${STACKS_CONFIG.contractName}/events?limit=50`;

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();

        for (const event of data.results || []) {
            // Skip if already processed
            if (processedBurns.has(event.tx_id)) continue;

            // Check if it's a burn event
            if (event.contract_log?.value?.repr?.includes('"burn"')) {
                processedBurns.add(event.tx_id);

                // Parse the burn event data
                try {
                    const eventData = parseBurnEvent(event);
                    if (eventData) {
                        console.log('\n🔥 New Burn Detected on Stacks:');
                        console.log(`   Sender: ${eventData.sender}`);
                        console.log(`   Amount: ${eventData.amount / 1e6} USDC`);
                        console.log(`   To Base: ${eventData.baseAddress}`);
                        console.log(`   TX: ${event.tx_id}`);

                        onBurn(eventData);
                    }
                } catch (parseError) {
                    console.error('Failed to parse burn event:', parseError.message);
                }
            }
        }

        return data.results?.[0]?.block_height || lastProcessedBlock;
    } catch (error) {
        console.error('Error polling burn events:', error.message);
        return lastProcessedBlock;
    }
}

/**
 * Parse burn event from Stacks transaction
 */
function parseBurnEvent(event) {
    try {
        // The print statement creates a contract_log with the event data
        const logValue = event.contract_log?.value;
        if (!logValue) return null;

        // Parse the Clarity tuple from the log
        // Format: {event: "burn", sender: principal, amount: uint, base-address: string}
        const repr = logValue.repr || '';

        // Extract values using regex (simplified parsing)
        const senderMatch = repr.match(/sender\s*:\s*'?([A-Z0-9]+)/i);
        const amountMatch = repr.match(/amount\s*:\s*u(\d+)/);
        const baseAddressMatch = repr.match(/base-address\s*:\s*"?(0x[a-fA-F0-9]+)"?/);

        if (!senderMatch || !amountMatch || !baseAddressMatch) {
            return null;
        }

        return {
            sender: senderMatch[1],
            amount: BigInt(amountMatch[1]),
            baseAddress: baseAddressMatch[1],
            txId: event.tx_id,
            blockHeight: event.block_height,
        };
    } catch (error) {
        console.error('Parse error:', error);
        return null;
    }
}

/**
 * Get pending mint info
 */
export async function getPendingMint(mintId) {
    try {
        const url = `${STACKS_CONFIG.apiUrl}/v2/contracts/call-read/${STACKS_CONFIG.contractAddress}/${STACKS_CONFIG.contractName}/get-pending-mint`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sender: STACKS_CONFIG.contractAddress,
                arguments: [cvToJSON(uintCV(mintId)).hex],
            }),
        });

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();
        return data.result ? cvToJSON(data.result) : null;
    } catch (error) {
        console.error('Failed to get pending mint:', error.message);
        return null;
    }
}
