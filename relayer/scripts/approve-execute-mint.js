/**
 * Approve and Execute a pending mint
 * Run: node scripts/approve-execute-mint.js <mint-id>
 */

import 'dotenv/config';
import {
    makeContractCall,
    broadcastTransaction,
    AnchorMode,
    PostConditionMode,
    uintCV,
} from '@stacks/transactions';
import { StacksTestnet } from '@stacks/network';
import { generateWallet } from '@stacks/wallet-sdk';

const network = new StacksTestnet();

// Contract details
const CONTRACT_ADDRESS = 'ST1ZGGS886YCZHMFXJR1EK61ZP34FNWNSX28M1PMM';
const CONTRACT_NAME = 'wrapped-usdc';

// Get mint ID from command line (default to 0 for first mint)
const mintId = parseInt(process.argv[2]) || 0;

async function getPrivateKey() {
    const mnemonic = process.env.STACKS_PRIVATE_KEY;
    if (!mnemonic) {
        console.error('❌ STACKS_PRIVATE_KEY not set in .env');
        process.exit(1);
    }

    const wallet = await generateWallet({
        secretKey: mnemonic,
        password: '',
    });

    return wallet.accounts[0].stxPrivateKey;
}

async function approveMint(privateKey, id) {
    console.log(`\n✍️ Approving mint #${id}...`);

    const txOptions = {
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: 'approve-mint',
        functionArgs: [uintCV(id)],
        senderKey: privateKey,
        network,
        anchorMode: AnchorMode.Any,
        postConditionMode: PostConditionMode.Allow,
        fee: 10000n,
    };

    const transaction = await makeContractCall(txOptions);
    const response = await broadcastTransaction(transaction, network);

    if (response.error) {
        console.error('❌ Approval failed:', response.error);
        if (response.reason_data) {
            console.error('   Reason:', JSON.stringify(response.reason_data));
        }
        return null;
    }

    console.log(`   TX ID: ${response.txid}`);
    console.log(`   View: https://explorer.hiro.so/txid/${response.txid}?chain=testnet`);
    return response.txid;
}

async function executeMint(privateKey, id) {
    console.log(`\n🚀 Executing mint #${id}...`);

    const txOptions = {
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: 'execute-mint',
        functionArgs: [uintCV(id)],
        senderKey: privateKey,
        network,
        anchorMode: AnchorMode.Any,
        postConditionMode: PostConditionMode.Allow,
        fee: 10000n,
    };

    const transaction = await makeContractCall(txOptions);
    const response = await broadcastTransaction(transaction, network);

    if (response.error) {
        console.error('❌ Execution failed:', response.error);
        if (response.reason_data) {
            console.error('   Reason:', JSON.stringify(response.reason_data));
        }
        return null;
    }

    console.log(`   TX ID: ${response.txid}`);
    console.log(`   ✅ Mint executed! xUSDC should now be in recipient wallet.`);
    console.log(`   View: https://explorer.hiro.so/txid/${response.txid}?chain=testnet`);
    return response.txid;
}

async function main() {
    console.log('═'.repeat(60));
    console.log('🔐 Approve & Execute Mint');
    console.log('═'.repeat(60));
    console.log(`   Mint ID: ${mintId}`);

    const privateKey = await getPrivateKey();

    // Step 1: First approval
    const approval1 = await approveMint(privateKey, mintId);
    if (!approval1) return;

    // Wait a moment for the first approval to process
    console.log('\n⏳ Waiting 5 seconds before second approval...');
    await new Promise(r => setTimeout(r, 5000));

    // Step 2: Second approval (we're using same signer for testing)
    // In production, this would be a different signer
    const approval2 = await approveMint(privateKey, mintId);

    // Wait for approvals to confirm
    console.log('\n⏳ Waiting 10 seconds for approvals to confirm...');
    await new Promise(r => setTimeout(r, 10000));

    // Step 3: Execute the mint
    const execution = await executeMint(privateKey, mintId);

    if (execution) {
        console.log('\n═'.repeat(60));
        console.log('✅ COMPLETE! xUSDC minted to recipient.');
        console.log('═'.repeat(60));
    }
}

main().catch(console.error);
