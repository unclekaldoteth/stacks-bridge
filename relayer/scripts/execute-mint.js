/**
 * Execute pending mint on wrapped-usdc-v5
 * Run: node scripts/execute-mint.js [mint-id]
 */

import "dotenv/config";
import {
    AnchorMode,
    PostConditionMode,
    TransactionVersion,
    broadcastTransaction,
    getAddressFromPrivateKey,
    makeContractCall,
    uintCV,
} from "@stacks/transactions";
import { StacksTestnet } from "@stacks/network";
import { generateWallet } from "@stacks/wallet-sdk";

const STACKS_API_URL = process.env.STACKS_API_URL || "https://api.testnet.hiro.so";
const network = new StacksTestnet();
network.coreApiUrl = STACKS_API_URL;
network.apiUrl = STACKS_API_URL;

const CONTRACT_ADDRESS = process.env.STACKS_CONTRACT_ADDRESS;
const CONTRACT_NAME = process.env.STACKS_CONTRACT_NAME || "wrapped-usdc-v5";

async function main() {
    const mintId = process.argv[2] || "0";

    const key = process.env.STACKS_PRIVATE_KEY;
    if (!key) {
        console.error("❌ STACKS_PRIVATE_KEY not set");
        process.exit(1);
    }

    let privateKey;
    let senderAddress;

    if (key.includes(" ")) {
        const wallet = await generateWallet({ secretKey: key, password: "" });
        privateKey = wallet.accounts[0].stxPrivateKey;
        senderAddress = getAddressFromPrivateKey(privateKey, TransactionVersion.Testnet);
    } else {
        privateKey = key;
        senderAddress = getAddressFromPrivateKey(privateKey, TransactionVersion.Testnet);
    }

    console.log("═".repeat(50));
    console.log(`🚀 Executing Mint #${mintId}`);
    console.log("═".repeat(50));
    console.log(`   Contract: ${CONTRACT_ADDRESS}.${CONTRACT_NAME}`);
    console.log(`   Sender: ${senderAddress}`);

    const txOptions = {
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: "execute-mint",
        functionArgs: [uintCV(parseInt(mintId))],
        senderKey: privateKey,
        network,
        anchorMode: AnchorMode.Any,
        postConditionMode: PostConditionMode.Allow,
        fee: 50000n,
    };

    console.log("\n🔄 Broadcasting execute-mint...");

    const transaction = await makeContractCall(txOptions);
    const response = await broadcastTransaction(transaction, network);

    if (response.error) {
        console.error("❌ Failed:", response.error);
        if (response.reason) console.error("   Reason:", response.reason);
        process.exit(1);
    }

    console.log("\n✅ Execute-mint broadcast!");
    console.log(`   TX ID: ${response.txid}`);
    console.log("\n   Tokens will be minted to recipient after TX confirms.");
}

main().catch(console.error);
