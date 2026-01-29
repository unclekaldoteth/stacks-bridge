/**
 * Initialize Signers on Stacks Mainnet Contract
 * Run: node scripts/initialize-signers-mainnet.js
 */

import {
    makeContractCall,
    broadcastTransaction,
    AnchorMode,
    PostConditionMode,
    principalCV,
} from '@stacks/transactions';
import { generateWallet, getStxAddress } from '@stacks/wallet-sdk';
import { TransactionVersion } from '@stacks/transactions';
import { StacksMainnet } from '@stacks/network';

// MAINNET contract details
const CONTRACT_ADDRESS = 'SP1MTYHV6K2FNH3QNF4P5QXS9VJ3XZ0GBB5T1SJPK';
const CONTRACT_NAME = 'wrapped-usdc-v5';

async function initializeSigners() {
    const mnemonic = process.env.STACKS_PRIVATE_KEY;

    if (!mnemonic) {
        console.error('❌ STACKS_PRIVATE_KEY (mnemonic) not set');
        console.log('   Usage: STACKS_PRIVATE_KEY="your mnemonic here" node scripts/initialize-signers-mainnet.js');
        process.exit(1);
    }

    // Get signer addresses from env or derive from mnemonic
    const signer1 = process.env.STACKS_SIGNER_1;
    const signer2 = process.env.STACKS_SIGNER_2;
    const signer3 = process.env.STACKS_SIGNER_3;

    if (!signer1 || !signer2 || !signer3) {
        console.error('❌ Missing signer addresses');
        console.log('   Set STACKS_SIGNER_1, STACKS_SIGNER_2, STACKS_SIGNER_3 in environment');
        process.exit(1);
    }

    console.log('🔐 Initializing Signers on MAINNET...');
    console.log('='.repeat(60));
    console.log(`   Contract: ${CONTRACT_ADDRESS}.${CONTRACT_NAME}`);
    console.log(`   Signer 1: ${signer1}`);
    console.log(`   Signer 2: ${signer2}`);
    console.log(`   Signer 3: ${signer3}`);
    console.log('='.repeat(60));

    try {
        // Derive wallet from mnemonic
        const wallet = await generateWallet({
            secretKey: mnemonic,
            password: '',
        });

        const account = wallet.accounts[0];
        const privateKey = account.stxPrivateKey;
        const address = getStxAddress({ account, transactionVersion: TransactionVersion.Mainnet });

        console.log(`\n📋 Sender (contract owner): ${address}`);

        // Setup mainnet network
        const network = new StacksMainnet();
        network.apiUrl = 'https://api.hiro.so';

        const txOptions = {
            contractAddress: CONTRACT_ADDRESS,
            contractName: CONTRACT_NAME,
            functionName: 'initialize-signers',
            functionArgs: [
                principalCV(signer1),
                principalCV(signer2),
                principalCV(signer3),
            ],
            senderKey: privateKey,
            network,
            anchorMode: AnchorMode.Any,
            postConditionMode: PostConditionMode.Allow,
            fee: 50000n, // 0.05 STX
        };

        const transaction = await makeContractCall(txOptions);
        console.log('\n📤 Broadcasting to MAINNET...');

        const broadcastResponse = await broadcastTransaction(transaction, network);

        if (broadcastResponse.error) {
            console.error('❌ Broadcast failed:', broadcastResponse.error);
            console.error('   Reason:', broadcastResponse.reason);
            if (broadcastResponse.reason_data) {
                console.error('   Data:', JSON.stringify(broadcastResponse.reason_data));
            }
            return;
        }

        console.log('\n✅ Transaction broadcast to MAINNET!');
        console.log(`   TX ID: ${broadcastResponse.txid}`);
        console.log(`   View: https://explorer.hiro.so/txid/${broadcastResponse.txid}`);
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error.stack);
    }
}

initializeSigners();
