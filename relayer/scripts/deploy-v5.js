/**
 * Deploy wrapped-usdc-v5 contract to Stacks Testnet
 * Run: node scripts/deploy-v5.js
 */

import "dotenv/config";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
    AnchorMode,
    PostConditionMode,
    TransactionVersion,
    broadcastTransaction,
    getAddressFromPrivateKey,
    makeContractDeploy,
} from "@stacks/transactions";
import { StacksTestnet } from "@stacks/network";
import { generateWallet } from "@stacks/wallet-sdk";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STACKS_API_URL = process.env.STACKS_API_URL || "https://api.testnet.hiro.so";
const STACKS_CORE_API_URL = process.env.STACKS_CORE_API_URL || "https://api.testnet.hiro.so";

const network = new StacksTestnet();
network.coreApiUrl = STACKS_CORE_API_URL;
network.apiUrl = STACKS_API_URL;

async function main() {
    const key = process.env.STACKS_PRIVATE_KEY;
    if (!key) {
        console.error("❌ STACKS_PRIVATE_KEY not set in .env");
        process.exit(1);
    }

    let privateKey;
    let senderAddress;

    if (key.includes(" ")) {
        const wallet = await generateWallet({
            secretKey: key,
            password: "",
        });
        const account = wallet.accounts[0];
        privateKey = account.stxPrivateKey;
        senderAddress = getAddressFromPrivateKey(privateKey, TransactionVersion.Testnet);
    } else {
        privateKey = key;
        senderAddress = getAddressFromPrivateKey(privateKey, TransactionVersion.Testnet);
    }

    // Read the contract source
    const contractPath = path.join(__dirname, '../../stacks/contracts/wrapped-usdc-v5.clar');
    const codeBody = fs.readFileSync(contractPath, 'utf8');
    const contractName = 'wrapped-usdc-v5';

    console.log("═".repeat(60));
    console.log(`🚀 Deploying ${contractName} to Stacks Testnet`);
    console.log("═".repeat(60));
    console.log(`   Sender: ${senderAddress}`);
    console.log(`   Contract: ${senderAddress}.${contractName}`);
    console.log(`   Code size: ${codeBody.length} bytes`);

    const txOptions = {
        contractName,
        codeBody,
        senderKey: privateKey,
        network,
        anchorMode: AnchorMode.Any,
        postConditionMode: PostConditionMode.Allow,
        fee: 500000n, // 0.5 STX fee
        clarityVersion: 4,
    };

    console.log("\n🔄 Broadcasting deployment...");

    try {
        const transaction = await makeContractDeploy(txOptions);
        const response = await broadcastTransaction(transaction, network);

        if (response.error) {
            console.error("❌ Failed:", response.error);
            if (response.reason) {
                console.error("   Reason:", response.reason);
            }
            process.exit(1);
        }

        console.log("\n✅ Contract deployment broadcast!");
        console.log(`   TX ID: ${response.txid}`);
        console.log(`   Contract: ${senderAddress}.${contractName}`);
        console.log("\n⏳ Wait for confirmation, then run: node scripts/initialize-signers-v4.js");
    } catch (error) {
        console.error("❌ Error:", error.message);
        process.exit(1);
    }
}

main();
