/**
 * Approve and Execute a pending mint on v2 contract (1-sig)
 * Run: node scripts/approve-execute-v2.js <mint-id>
 */

import {
    makeContractCall,
    broadcastTransaction,
    AnchorMode,
    PostConditionMode,
    uintCV,
} from '@stacks/transactions';
import { generateWallet } from '@stacks/wallet-sdk';
import { network, requireContract, stacksExplorerAddressUrl, stacksExplorerTxUrl } from './stacks-env.js';

// V2 Contract - only needs 1 signature!
const { contractAddress: CONTRACT_ADDRESS, contractName: CONTRACT_NAME } = requireContract(
    'wrapped-usdc-v2',
    'ST1ZGGS886YCZHMFXJR1EK61ZP34FNWNSX28M1PMM'
);

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
    console.log(`   View: ${stacksExplorerTxUrl(response.txid)}`);
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
    console.log(`   View: ${stacksExplorerTxUrl(response.txid)}`);
    return response.txid;
}

async function main() {
    console.log('═'.repeat(60));
    console.log('🔐 Approve & Execute Mint (v2 - 1 signature)');
    console.log('═'.repeat(60));
    console.log(`   Mint ID: ${mintId}`);
    console.log(`   Contract: ${CONTRACT_NAME}`);

    const privateKey = await getPrivateKey();

    // Step 1: Approve (only 1 needed for v2!)
    const approval = await approveMint(privateKey, mintId);
    if (!approval) return;

    // Wait for approval to confirm
    console.log('\n⏳ Waiting 15 seconds for approval to confirm...');
    await new Promise(r => setTimeout(r, 15000));

    // Step 2: Execute the mint
    const execution = await executeMint(privateKey, mintId);

    if (execution) {
        console.log('\n═'.repeat(60));
        console.log('✅ COMPLETE! xUSDC minted to recipient.');
        console.log(`   Check wallet: ${stacksExplorerAddressUrl(CONTRACT_ADDRESS)}`);
        console.log('═'.repeat(60));
    }
}

main().catch(console.error);
