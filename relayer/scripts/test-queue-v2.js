/**
 * Manual test of queue-mint on wrapped-usdc-v2
 * Run: node scripts/test-queue-v2.js
 */

import {
    makeContractCall,
    broadcastTransaction,
    AnchorMode,
    PostConditionMode,
    principalCV,
    uintCV,
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
        console.error('❌ STACKS_PRIVATE_KEY not set');
        process.exit(1);
    }

    console.log('═'.repeat(60));
    console.log('🧪 Testing queue-mint on wrapped-usdc-v2');
    console.log('═'.repeat(60));

    const wallet = await generateWallet({ secretKey: mnemonic, password: '' });
    const account = wallet.accounts[0];
    const privateKey = account.stxPrivateKey;
    const senderAddress = getStxAddress({ account, transactionVersion: txVersion });

    console.log(`\n📍 Sender: ${senderAddress}`);
    console.log(`📍 Contract: ${CONTRACT_ADDRESS}.${CONTRACT_NAME}`);

    // Queue mint
    const amount = 1000000n; // 1 USDC (6 decimals)
    const recipient = 'ST1ZGGS886YCZHMFXJR1EK61ZP34FNWNSX28M1PMM';

    console.log(`\n🔐 Queuing mint:`);
    console.log(`   Recipient: ${recipient}`);
    console.log(`   Amount: ${amount} (1 USDC)`);

    const txOptions = {
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: 'queue-mint',
        functionArgs: [
            principalCV(recipient),
            uintCV(amount),
        ],
        senderKey: privateKey,
        network,
        anchorMode: AnchorMode.Any,
        postConditionMode: PostConditionMode.Allow,
        fee: 20000n,
    };

    try {
        const transaction = await makeContractCall(txOptions);
        const response = await broadcastTransaction(transaction, network);

        if (response.error) {
            console.error('\n❌ Queue-mint failed:', response.error);
            if (response.reason) {
                console.error('   Reason:', response.reason);
            }
            if (response.reason_data) {
                console.error('   Reason Data:', JSON.stringify(response.reason_data));
            }
            return;
        }

        console.log(`\n✅ Queue-mint broadcast!`);
        console.log(`   TX ID: ${response.txid}`);
    console.log(`   View: ${stacksExplorerTxUrl(response.txid)}`);
    } catch (e) {
        console.error('\n❌ Error:', e.message);
    }
}

main().catch(console.error);
