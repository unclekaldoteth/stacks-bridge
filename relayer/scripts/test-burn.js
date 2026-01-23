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
    standardPrincipalCV,
    uintCV,
    cvToJSON,
    deserializeCV,
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
    const burnAmountInput = process.argv[2] || "5000000"; // Default: 5 xUSDC (half of balance)
    let burnAmount;
    try {
        burnAmount = BigInt(burnAmountInput);
    } catch (error) {
        console.error("❌ Invalid burn amount. Use integer xUSDC units (6 decimals).");
        process.exit(1);
    }

    const key = process.env.STACKS_PRIVATE_KEY;
    if (!key) {
        console.error("❌ STACKS_PRIVATE_KEY not set");
        process.exit(1);
    }

    if (!CONTRACT_ADDRESS) {
        console.error("❌ STACKS_CONTRACT_ADDRESS not set");
        process.exit(1);
    }

    if (!BASE_RECIPIENT.startsWith("0x") || BASE_RECIPIENT.length !== 42) {
        console.error("❌ Invalid BASE_RECIPIENT (expected 42-char 0x address)");
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
    console.log(`   Burn Amount: ${Number(burnAmount) / 1e6} xUSDC`);
    console.log(`   To Base: ${BASE_RECIPIENT}`);

    // Check balance first
    const balanceUrl = `${STACKS_API_URL}/v2/contracts/call-read/${CONTRACT_ADDRESS}/${CONTRACT_NAME}/get-balance`;
    const balanceResponse = await fetch(balanceUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            sender: CONTRACT_ADDRESS,
            arguments: [cvToJSON(standardPrincipalCV(senderAddress)).hex],
        }),
    });

    console.log("\n📊 Checking xUSDC balance...");

    if (!balanceResponse.ok) {
        console.error(`❌ Failed to fetch balance: ${balanceResponse.status}`);
        process.exit(1);
    }

    const balanceData = await balanceResponse.json();
    if (!balanceData.okay || !balanceData.result) {
        console.error("❌ Balance lookup failed");
        console.error("   Response:", JSON.stringify(balanceData, null, 2));
        process.exit(1);
    }

    const balanceHex = balanceData.result.startsWith("0x")
        ? balanceData.result.slice(2)
        : balanceData.result;
    const balanceCv = deserializeCV(Buffer.from(balanceHex, "hex"));
    const balanceJson = cvToJSON(balanceCv);
    const balance = BigInt(balanceJson.value);

    console.log(`   Balance: ${Number(balance) / 1e6} xUSDC`);
    if (balance < burnAmount) {
        console.error("❌ Insufficient xUSDC balance for burn");
        process.exit(1);
    }

    const txOptions = {
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: "burn",
        functionArgs: [
            uintCV(burnAmount),
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
