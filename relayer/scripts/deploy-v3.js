/**
 * Deploy wrapped-usdc-v3 and initialize signers with correct testnet address
 * Run: node scripts/deploy-v3.js
 */

import {
    makeContractDeploy,
    makeContractCall,
    broadcastTransaction,
    AnchorMode,
    PostConditionMode,
    principalCV,
} from '@stacks/transactions';
import { generateWallet, getStxAddress } from '@stacks/wallet-sdk';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { network, stacksExplorerTxUrl, txVersion } from './stacks-env.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const contractName = 'wrapped-usdc-v3';

async function main() {
    const mnemonic = process.env.STACKS_PRIVATE_KEY;
    if (!mnemonic) {
        console.error('❌ STACKS_PRIVATE_KEY (mnemonic) not set in .env');
        process.exit(1);
    }

    console.log('═'.repeat(60));
    console.log('🚀 Deploying wrapped-usdc-v3 (1-signature required)');
    console.log('═'.repeat(60));

    // Get private key from mnemonic
    const wallet = await generateWallet({
        secretKey: mnemonic,
        password: '',
    });
    const privateKey = wallet.accounts[0].stxPrivateKey;
    const deployerAddress = getStxAddress({ account: wallet.accounts[0], transactionVersion: txVersion });

    // Read contract code
    const contractPath = join(__dirname, '../../stacks/contracts/wrapped-usdc-v3.clar');
    const codeBody = readFileSync(contractPath, 'utf-8');

    console.log(`📄 Contract size: ${codeBody.length} bytes`);
    console.log(`📍 Contract name: ${contractName}`);

    // Step 1: Deploy contract
    const deployOptions = {
        contractName,
        codeBody,
        senderKey: privateKey,
        network,
        anchorMode: AnchorMode.Any,
        postConditionMode: PostConditionMode.Allow,
        fee: 1500000n, // 1.5 STX
    };

    console.log('\n🔄 Step 1: Broadcasting deployment...');

    const deployTx = await makeContractDeploy(deployOptions);
    const deployResponse = await broadcastTransaction(deployTx, network);

    if (deployResponse.error) {
        console.error('❌ Deployment failed:', deployResponse.error);
        if (deployResponse.reason_data) {
            console.error('   Reason:', JSON.stringify(deployResponse.reason_data));
        }
        process.exit(1);
    }

    console.log(`✅ Deployment broadcast!`);
    console.log(`   TX ID: ${deployResponse.txid}`);
    console.log(`   View: ${stacksExplorerTxUrl(deployResponse.txid)}`);

    // Wait for deployment to be mined
    console.log('\n⏳ Waiting 90 seconds for deployment to confirm...');
    await new Promise(r => setTimeout(r, 90000));

    // Step 2: Initialize signers with the deployer address
    console.log('\n🔄 Step 2: Initializing signers...');
    console.log(`   Signer address: ${deployerAddress}`);

    const initOptions = {
        contractAddress: deployerAddress,
        contractName,
        functionName: 'initialize-signers',
        functionArgs: [
            principalCV(deployerAddress),
            principalCV(deployerAddress),
            principalCV(deployerAddress),
        ],
        senderKey: privateKey,
        network,
        anchorMode: AnchorMode.Any,
        postConditionMode: PostConditionMode.Allow,
        fee: 30000n,
    };

    const initTx = await makeContractCall(initOptions);
    const initResponse = await broadcastTransaction(initTx, network);

    if (initResponse.error) {
        console.error('❌ Init signers failed:', initResponse.error);
        if (initResponse.reason_data) {
            console.error('   Reason:', JSON.stringify(initResponse.reason_data));
        }
        process.exit(1);
    }

    console.log(`✅ Init signers broadcast!`);
    console.log(`   TX ID: ${initResponse.txid}`);
    console.log(`   View: ${stacksExplorerTxUrl(initResponse.txid)}`);

    console.log('\n' + '═'.repeat(60));
    console.log('✅ V3 DEPLOYMENT COMPLETE');
    console.log('═'.repeat(60));
    console.log(`\n📍 Contract: ${deployerAddress}.${contractName}`);
    console.log('\n⏳ Wait for init-signers to confirm, then:');
    console.log('   1. Update relayer .env STACKS_CONTRACT_NAME=wrapped-usdc-v3');
    console.log('   2. Restart relayer');
    console.log('   3. Make a deposit');
}

main().catch(console.error);
