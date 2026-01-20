/**
 * Deploy wrapped-usdc-v2 contract to testnet
 * Run: node scripts/deploy-v2.js
 */

import {
    makeContractDeploy,
    broadcastTransaction,
    AnchorMode,
    PostConditionMode,
} from '@stacks/transactions';
import { generateWallet, getStxAddress } from '@stacks/wallet-sdk';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { network, stacksExplorerTxUrl, txVersion } from './stacks-env.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const contractName = 'wrapped-usdc-v2';

async function main() {
    const mnemonic = process.env.STACKS_PRIVATE_KEY;
    if (!mnemonic) {
        console.error('❌ STACKS_PRIVATE_KEY (mnemonic) not set in .env');
        process.exit(1);
    }

    console.log('═'.repeat(60));
    console.log('🚀 Deploying wrapped-usdc-v2');
    console.log('═'.repeat(60));

    // Get private key from mnemonic
    const wallet = await generateWallet({
        secretKey: mnemonic,
        password: '',
    });
    const privateKey = wallet.accounts[0].stxPrivateKey;
    const deployerAddress = getStxAddress({ account: wallet.accounts[0], transactionVersion: txVersion });

    // Read contract code
    const contractPath = join(__dirname, '../../stacks/contracts/wrapped-usdc-v2.clar');
    const codeBody = readFileSync(contractPath, 'utf-8');

    console.log(`📄 Contract size: ${codeBody.length} bytes`);
    console.log(`📍 Contract name: ${contractName}`);

    // Deploy contract
    const txOptions = {
        contractName,
        codeBody,
        senderKey: privateKey,
        network,
        anchorMode: AnchorMode.Any,
        postConditionMode: PostConditionMode.Allow,
        fee: 1000000n, // 1 STX
    };

    console.log('\n🔄 Broadcasting deployment transaction...');

    const transaction = await makeContractDeploy(txOptions);
    const response = await broadcastTransaction(transaction, network);

    if (response.error) {
        console.error('❌ Deployment failed:', response.error);
        if (response.reason_data) {
            console.error('   Reason:', JSON.stringify(response.reason_data));
        }
        process.exit(1);
    }

    console.log('\n✅ Contract deployment broadcast!');
    console.log(`   TX ID: ${response.txid}`);
    console.log(`   View: ${stacksExplorerTxUrl(response.txid)}`);
    console.log(`\n📍 Contract Address: ${deployerAddress}.${contractName}`);
    console.log('\n⏳ Wait for confirmation, then run initialize-signers-v2.js');
}

main().catch(console.error);
