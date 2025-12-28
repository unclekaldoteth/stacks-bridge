/**
 * Deploy wrapped-usdc-v2 contract to testnet
 * Run: node scripts/deploy-v2.js
 */

import 'dotenv/config';
import {
    makeContractDeploy,
    broadcastTransaction,
    AnchorMode,
    PostConditionMode,
} from '@stacks/transactions';
import { StacksTestnet } from '@stacks/network';
import { generateWallet } from '@stacks/wallet-sdk';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const network = new StacksTestnet();

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

    // Read contract code
    const contractPath = join(__dirname, '../../stacks/contracts/wrapped-usdc-v2.clar');
    const codeBody = readFileSync(contractPath, 'utf-8');

    console.log(`📄 Contract size: ${codeBody.length} bytes`);
    console.log(`📍 Contract name: wrapped-usdc-v2`);

    // Deploy contract
    const txOptions = {
        contractName: 'wrapped-usdc-v2',
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
    console.log(`   View: https://explorer.hiro.so/txid/${response.txid}?chain=testnet`);
    console.log(`\n📍 Contract Address: ST1ZGGS886YCZHMFXJR1EK61ZP34FNWNSX28M1PMM.wrapped-usdc-v2`);
    console.log('\n⏳ Wait for confirmation, then run initialize-signers-v2.js');
}

main().catch(console.error);
