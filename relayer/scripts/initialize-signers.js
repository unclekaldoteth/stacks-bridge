/**
 * Initialize Signers on Stacks Contract
 * Run: node scripts/initialize-signers.js
 */

import 'dotenv/config';
import {
    makeContractCall,
    broadcastTransaction,
    AnchorMode,
    PostConditionMode,
    principalCV,
} from '@stacks/transactions';
import { StacksTestnet } from '@stacks/network';
import { generateWallet, getStxAddress } from '@stacks/wallet-sdk';

const network = new StacksTestnet();

// Contract details
const CONTRACT_ADDRESS = 'ST1ZGGS886YCZHMFXJR1EK61ZP34FNWNSX28M1PMM';
const CONTRACT_NAME = 'wrapped-usdc';

// Signers - using the deployer address
// For testing, using same address for all 3 signers
// In production, use 3 different secure wallets
const SIGNER_1 = 'ST1ZGGS886YCZHMFXJR1EK61ZP34FNWNSX28M1PMM';
const SIGNER_2 = 'ST1ZGGS886YCZHMFXJR1EK61ZP34FNWNSX28M1PMM';
const SIGNER_3 = 'ST1ZGGS886YCZHMFXJR1EK61ZP34FNWNSX28M1PMM';

async function initializeSigners() {
    const mnemonic = process.env.STACKS_PRIVATE_KEY;

    if (!mnemonic) {
        console.error('❌ STACKS_PRIVATE_KEY (mnemonic) not set in .env');
        process.exit(1);
    }

    console.log('🔐 Deriving private key from mnemonic...');

    try {
        // Derive wallet from mnemonic
        const wallet = await generateWallet({
            secretKey: mnemonic,
            password: '',
        });

        // Get the first account's private key
        const account = wallet.accounts[0];
        const privateKey = account.stxPrivateKey;
        const address = getStxAddress({ account, transactionVersion: 0x80 }); // 0x80 for testnet

        console.log(`   Derived address: ${address}`);
        console.log(`\n🔐 Initializing Stacks Signers...`);
        console.log(`   Contract: ${CONTRACT_ADDRESS}.${CONTRACT_NAME}`);
        console.log(`   Signer 1: ${SIGNER_1}`);
        console.log(`   Signer 2: ${SIGNER_2}`);
        console.log(`   Signer 3: ${SIGNER_3}`);

        const txOptions = {
            contractAddress: CONTRACT_ADDRESS,
            contractName: CONTRACT_NAME,
            functionName: 'initialize-signers',
            functionArgs: [
                principalCV(SIGNER_1),
                principalCV(SIGNER_2),
                principalCV(SIGNER_3),
            ],
            senderKey: privateKey,
            network,
            anchorMode: AnchorMode.Any,
            postConditionMode: PostConditionMode.Allow,
            fee: 10000n, // 0.01 STX
        };

        const transaction = await makeContractCall(txOptions);
        console.log('\n📤 Broadcasting transaction...');

        const broadcastResponse = await broadcastTransaction(transaction, network);

        if (broadcastResponse.error) {
            console.error('❌ Broadcast failed:', broadcastResponse.error);
            console.error('   Reason:', broadcastResponse.reason);
            if (broadcastResponse.reason_data) {
                console.error('   Data:', JSON.stringify(broadcastResponse.reason_data));
            }
            return;
        }

        console.log('✅ Transaction broadcast!');
        console.log(`   TX ID: ${broadcastResponse.txid}`);
        console.log(`   View: https://explorer.hiro.so/txid/${broadcastResponse.txid}?chain=testnet`);
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error.stack);
    }
}

initializeSigners();
