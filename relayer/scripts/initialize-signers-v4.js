/**
 * Initialize signers for wrapped-usdc-v4 contract
 * Run: node scripts/initialize-signers-v4.js
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
const CONTRACT_NAME = process.env.STACKS_CONTRACT_NAME || "wrapped-usdc-v4";

function withTrailingSlash(url) {
    return url.endsWith("/") ? url : `${url}/`;
}

async function fetchOrThrow(url, label) {
    const response = await fetch(url);
    if (!response.ok) {
        const body = await response.text().catch(() => "");
        const detail = body ? `\n   Response: ${body}` : "";
        throw new Error(`${label} request failed (${response.status} ${response.statusText}).${detail}`);
    }
    return response;
}

async function assertContractExists() {
    const coreUrl = withTrailingSlash(STACKS_CORE_API_URL);
    const contractUrl = `${coreUrl}v2/contracts/source/${CONTRACT_ADDRESS}/${CONTRACT_NAME}`;

    try {
        await fetchOrThrow(`${coreUrl}v2/info`, "Stacks core");
    } catch (error) {
        console.error("❌ Unable to reach Stacks core node.");
        console.error(`   URL: ${STACKS_CORE_API_URL}`);
        console.error(`   Error: ${error.message}`);
        process.exit(1);
    }

    try {
        await fetchOrThrow(contractUrl, "Contract lookup");
    } catch (error) {
        console.error("❌ Contract not found or not yet deployed.");
        console.error(`   Contract: ${CONTRACT_ADDRESS}.${CONTRACT_NAME}`);
        console.error(`   Error: ${error.message}`);
        console.error(`   Check with: curl ${contractUrl}`);
        process.exit(1);
    }
}

async function main() {
    if (!CONTRACT_ADDRESS) {
        console.error("❌ STACKS_CONTRACT_ADDRESS not set in .env");
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
    console.log(`🔐 Initializing Signers for ${CONTRACT_NAME}`);
    console.log("═".repeat(60));
    console.log(`   Network: ${NETWORK}`);
    console.log(`   API: ${STACKS_API_URL}`);
    console.log(`   Core: ${STACKS_CORE_API_URL}`);
    console.log(`   Contract: ${CONTRACT_ADDRESS}.${CONTRACT_NAME}`);
    console.log(`   Signer: ${signerAddress}`);
    console.log("   Using same address for all 3 signers (testing)");

    await assertContractExists();

    const txOptions = {
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: "initialize-signers",
        functionArgs: [
            principalCV(signerAddress),
            principalCV(signerAddress),
            principalCV(signerAddress),
        ],
        senderKey: privateKey,
        network,
        anchorMode: AnchorMode.Any,
        postConditionMode: PostConditionMode.Allow,
        fee: 20000n,
    };

    console.log("\n🔄 Broadcasting initialize-signers...");

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

    console.log("\n✅ Signers initialization broadcast!");
    console.log(`   TX ID: ${response.txid}`);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
