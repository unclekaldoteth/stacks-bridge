/**
 * Just execute a pending mint (approval already done)
 * Run: node scripts/execute-only.js <mint-id>
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
const CONTRACT_ADDRESS = 'ST1ZGGS886YCZHMFXJR1EK61ZP34FNWNSX28M1PMM';
const CONTRACT_NAME = 'wrapped-usdc-v3';
const mintId = parseInt(process.argv[2]) || 0;

async function main() {
    const mnemonic = process.env.STACKS_PRIVATE_KEY;
    const wallet = await generateWallet({ secretKey: mnemonic, password: '' });
    const privateKey = wallet.accounts[0].stxPrivateKey;

    console.log(`🚀 Executing mint #${mintId}...`);

    const txOptions = {
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: 'execute-mint',
        functionArgs: [uintCV(mintId)],
        senderKey: privateKey,
        network,
        anchorMode: AnchorMode.Any,
        postConditionMode: PostConditionMode.Allow,
        fee: 20000n,
    };

    const transaction = await makeContractCall(txOptions);
    const response = await broadcastTransaction(transaction, network);

    if (response.error) {
        console.error('❌ Failed:', response.error);
        console.error('   Reason:', JSON.stringify(response.reason_data));
        return;
    }

    console.log(`✅ TX ID: ${response.txid}`);
    console.log(`   View: https://explorer.hiro.so/txid/${response.txid}?chain=testnet`);
}

main().catch(console.error);
