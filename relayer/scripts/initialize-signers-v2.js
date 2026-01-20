/**
 * Initialize signers for wrapped-usdc-v2 contract
 * Run: node scripts/initialize-signers-v2.js
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

const { contractAddress: CONTRACT_ADDRESS, contractName: CONTRACT_NAME } = requireContract(
    'wrapped-usdc-v2',
    'ST1ZGGS886YCZHMFXJR1EK61ZP34FNWNSX28M1PMM'
);

async function main() {
    const mnemonic = process.env.STACKS_PRIVATE_KEY;
    if (!mnemonic) {
        console.error('❌ STACKS_PRIVATE_KEY (mnemonic) not set in .env');
        process.exit(1);
    }

    console.log('═'.repeat(60));
    console.log('🔐 Initializing Signers for wrapped-usdc-v2');
    console.log('═'.repeat(60));

    // Get private key and address from mnemonic
    const wallet = await generateWallet({
        secretKey: mnemonic,
        password: '',
    });
    const privateKey = wallet.accounts[0].stxPrivateKey;
    const signerAddress = getStxAddress({ account: wallet.accounts[0], transactionVersion: txVersion });

    console.log(`   Signer: ${signerAddress}`);
    console.log(`   Using same address for all 3 signers (testing)`);

    // Initialize signers with same address (just for testing - 1-sig required anyway)
    const txOptions = {
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: 'initialize-signers',
        functionArgs: [
            principalCV(signerAddress),
            principalCV(signerAddress),
            principalCV(signerAddress),
        ],
        senderKey: privateKey,
        network,
        anchorMode: AnchorMode.Any,
        postConditionMode: PostConditionMode.Allow,
        fee: 20000n,
    };

    console.log('\n🔄 Broadcasting initialize-signers...');

    const transaction = await makeContractCall(txOptions);
    const response = await broadcastTransaction(transaction, network);

    if (response.error) {
        console.error('❌ Failed:', response.error);
        if (response.reason_data) {
            console.error('   Reason:', JSON.stringify(response.reason_data));
        }
        process.exit(1);
    }

    console.log('\n✅ Signers initialization broadcast!');
    console.log(`   TX ID: ${response.txid}`);
    console.log(`   View: ${stacksExplorerTxUrl(response.txid)}`);
    console.log('\n⏳ Wait for confirmation, then update relayer config to use v2');
}

main().catch(console.error);
