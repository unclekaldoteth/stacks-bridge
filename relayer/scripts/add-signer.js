/**
 * Add signer to wrapped-usdc-v5 contract
 * Run: NETWORK=mainnet node scripts/add-signer.js <newSignerPrincipal>
 */

import "dotenv/config";
import {
    AnchorMode,
    PostConditionMode,
    TransactionVersion,
    broadcastTransaction,
    getAddressFromPrivateKey,
    makeContractCall,
    principalCV,
} from "@stacks/transactions";
import { StacksMainnet, StacksTestnet } from "@stacks/network";
import { generateWallet, getStxAddress } from "@stacks/wallet-sdk";

const NETWORK = process.env.NETWORK || "testnet";
const IS_MAINNET = NETWORK === "mainnet";
const STACKS_API_URL =
    process.env.STACKS_API_URL || (IS_MAINNET ? "https://api.hiro.so" : "https://api.testnet.hiro.so");
const STACKS_CORE_API_URL =
    process.env.STACKS_CORE_API_URL ||
    process.env.STACKS_API_URL ||
    (IS_MAINNET ? "https://stacks-node-api.mainnet.stacks.co" : "https://stacks-node-api.testnet.stacks.co");

const network = IS_MAINNET ? new StacksMainnet() : new StacksTestnet();
network.coreApiUrl = STACKS_CORE_API_URL;
network.apiUrl = STACKS_API_URL;

const CONTRACT_ADDRESS = process.env.STACKS_CONTRACT_ADDRESS;
const CONTRACT_NAME = process.env.STACKS_CONTRACT_NAME || "wrapped-usdc-v5";

async function main() {
    if (!CONTRACT_ADDRESS) {
        console.error("❌ STACKS_CONTRACT_ADDRESS not set in .env");
        process.exit(1);
    }

    const newSigner = process.argv[2];
    if (!newSigner) {
        console.error("❌ New signer principal required.");
        console.log("   Usage: node scripts/add-signer.js <newSignerPrincipal>");
        process.exit(1);
    }

    const key = process.env.STACKS_PRIVATE_KEY;
    if (!key) {
        console.error("❌ STACKS_PRIVATE_KEY not set in .env");
        process.exit(1);
    }

    let privateKey;
    let signerAddress;

    if (key.includes(" ")) {
        const wallet = await generateWallet({
            secretKey: key,
            password: "",
        });
        const account = wallet.accounts[0];
        privateKey = account.stxPrivateKey;
        signerAddress = getStxAddress({
            account,
            transactionVersion: IS_MAINNET ? TransactionVersion.Mainnet : TransactionVersion.Testnet,
        });
    } else {
        privateKey = key;
        signerAddress = getAddressFromPrivateKey(
            privateKey,
            IS_MAINNET ? TransactionVersion.Mainnet : TransactionVersion.Testnet
        );
    }

    console.log("═".repeat(60));
    console.log(`🔐 Adding Signer to ${CONTRACT_NAME}`);
    console.log("═".repeat(60));
    console.log(`   Network: ${NETWORK}`);
    console.log(`   Contract: ${CONTRACT_ADDRESS}.${CONTRACT_NAME}`);
    console.log(`   Caller: ${signerAddress}`);
    console.log(`   Adding Signer: ${newSigner}`);

    const txOptions = {
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: "add-signer",
        functionArgs: [
            principalCV(newSigner),
        ],
        senderKey: privateKey,
        network,
        anchorMode: AnchorMode.Any,
        postConditionMode: PostConditionMode.Allow,
        fee: 20000n,
    };

    console.log("\n🔄 Broadcasting add-signer...");

    const transaction = await makeContractCall(txOptions);
    const response = await broadcastTransaction(transaction, network);

    if (response.error) {
        console.error("❌ Failed:", response.error);
        if (response.reason) {
            console.error("   Reason:", response.reason);
        }
        if (response.reason_data) {
            console.error("   Reason Data:", JSON.stringify(response.reason_data));
        }
        process.exit(1);
    }

    console.log("\n✅ Signer added!");
    console.log(`   TX ID: ${response.txid}`);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
