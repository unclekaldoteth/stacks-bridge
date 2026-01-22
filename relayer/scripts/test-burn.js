/**
 * Test Burn Script - Stacks → Base Sepolia
 * 
 * Burns xUSDC on Stacks to trigger USDC release on Base.
 * Run: node scripts/test-burn.js
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
    stringAsciiCV,
} from "@stacks/transactions";
import { StacksTestnet } from "@stacks/network";
import { generateWallet } from "@stacks/wallet-sdk";

const STACKS_API_URL = process.env.STACKS_API_URL || "https://api.testnet.hiro.so";
const network = new StacksTestnet();
network.coreApiUrl = STACKS_API_URL;
network.apiUrl = STACKS_API_URL;

const CONTRACT_ADDRESS = process.env.STACKS_CONTRACT_ADDRESS;
const CONTRACT_NAME = process.env.STACKS_CONTRACT_NAME || "wrapped-usdc-v5";

// Base address to receive USDC (must be 42 characters with 0x)
const BASE_RECIPIENT = process.env.SIGNER_1_ADDRESS || "0x776beEaDe7115Bd870C1344Fec02eF31758C319E";

async function main() {
    const burnAmount = process.argv[2] || "5000000"; // Default: 5 xUSDC (half of balance)

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

    console.log("═".repeat(60));
    console.log("🔥 Test Burn - Stacks → Base Sepolia");
    console.log("═".repeat(60));
    console.log(`   Contract: ${CONTRACT_ADDRESS}.${CONTRACT_NAME}`);
    console.log(`   Sender: ${senderAddress}`);
    console.log(`   Burn Amount: ${parseInt(burnAmount) / 1e6} xUSDC`);
    console.log(`   To Base: ${BASE_RECIPIENT}`);

    // Check balance first
    const balanceUrl = `${STACKS_API_URL}/v2/contracts/call-read/${CONTRACT_ADDRESS}/${CONTRACT_NAME}/get-balance`;
    const balanceResponse = await fetch(balanceUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            sender: CONTRACT_ADDRESS,
            arguments: [`0x051a${senderAddress.slice(2)}`], // principal hex encoding
        }),
    });

    console.log("\n📊 Checking xUSDC balance...");

    const txOptions = {
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: "burn",
        functionArgs: [
            uintCV(parseInt(burnAmount)),
            stringAsciiCV(BASE_RECIPIENT),
        ],
        senderKey: privateKey,
        network,
        anchorMode: AnchorMode.Any,
        postConditionMode: PostConditionMode.Allow,
        fee: 50000n,
    };

    console.log("\n🔄 Broadcasting burn transaction...");

    try {
        const transaction = await makeContractCall(txOptions);
        const response = await broadcastTransaction(transaction, network);

        if (response.error) {
            console.error("❌ Failed:", response.error);
            if (response.reason) console.error("   Reason:", response.reason);
            process.exit(1);
        }

        console.log("\n✅ Burn transaction broadcast!");
        console.log(`   TX ID: ${response.txid}`);
        console.log(`   View: https://explorer.hiro.so/txid/0x${response.txid}?chain=testnet`);
        console.log("\n📡 Relayer should detect burn event and queue release on Base.");
        console.log("   Check relayer logs for: \"🔥 New Burn Detected\"");
    } catch (error) {
        console.error("❌ Error:", error.message);
        process.exit(1);
    }
}

main().catch(console.error);
