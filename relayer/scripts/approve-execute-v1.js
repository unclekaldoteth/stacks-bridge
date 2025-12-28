/**
 * Approve and Execute on V1 contract (2 signatures needed)
 * But v1 has same signer 3x, and signers already added
 * So we can use 1 approval since we initialized same address
 * 
 * Run: node scripts/approve-execute-v1.js <mint-id>
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

// V1 Contract - requires 2 approvals but we only have 1 unique signer
// Let's still try to approve since the initialization may have worked for 1 signer
const CONTRACT_ADDRESS = 'ST1ZGGS886YCZHMFXJR1EK61ZP34FNWNSX28M1PMM';
const CONTRACT_NAME = 'wrapped-usdc'; // V1

const mintId = parseInt(process.argv[2]) || 3;

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
    console.log(`\n✍️ Approving mint #${id} on ${CONTRACT_NAME}...`);

    const txOptions = {
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: 'approve-mint',
        functionArgs: [uintCV(id)],
        senderKey: privateKey,
        network,
        anchorMode: AnchorMode.Any,
        postConditionMode: PostConditionMode.Allow,
        fee: 20000n,
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

async function main() {
    console.log('═'.repeat(60));
    console.log(`🔐 Approve Mint on V1 (wrapped-usdc)`);
    console.log('═'.repeat(60));
    console.log(`   Mint ID: ${mintId}`);
    console.log(`   Contract: ${CONTRACT_NAME}`);
    console.log(`   Note: V1 requires 2 approvals but we only have 1 signer`);
    console.log(`         This will add 1 approval. Mint requires 2.`);

    const privateKey = await getPrivateKey();

    // Step 1: Approve
    const approval = await approveMint(privateKey, mintId);
    if (!approval) return;

    console.log('\n⚠️ V1 contract requires 2-of-3 approvals.');
    console.log('   Since you only have 1 unique signer address,');
    console.log('   the execute will fail with insufficient approvals.');
    console.log('\n   For future deposits, the relayer is now fixed to use V2!');
}

main().catch(console.error);
