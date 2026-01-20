/**
 * Initialize Signers on Stacks Contract
 * Run: node scripts/initialize-signers.js
 */

import {
    makeContractCall,
    broadcastTransaction,
    AnchorMode,
    PostConditionMode,
    principalCV,
} from '@stacks/transactions';
import { generateWallet, getStxAddress } from '@stacks/wallet-sdk';
import { network, requireContract, stacksExplorerTxUrl, txVersion } from './stacks-env.js';

// Contract details
const { contractAddress: CONTRACT_ADDRESS, contractName: CONTRACT_NAME } = requireContract(
    'wrapped-usdc',
    'ST1ZGGS886YCZHMFXJR1EK61ZP34FNWNSX28M1PMM'
);

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
        const address = getStxAddress({ account, transactionVersion: txVersion });
        const signer1 = process.env.STACKS_SIGNER_1 || address;
        const signer2 = process.env.STACKS_SIGNER_2 || address;
        const signer3 = process.env.STACKS_SIGNER_3 || address;

        console.log(`   Derived address: ${address}`);
        console.log(`\n🔐 Initializing Stacks Signers...`);
        console.log(`   Contract: ${CONTRACT_ADDRESS}.${CONTRACT_NAME}`);
        console.log(`   Signer 1: ${signer1}`);
        console.log(`   Signer 2: ${signer2}`);
        console.log(`   Signer 3: ${signer3}`);

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
        console.log(`   View: ${stacksExplorerTxUrl(broadcastResponse.txid)}`);
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error.stack);
    }
}

initializeSigners();
