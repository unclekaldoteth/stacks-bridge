/**
 * List signers for wrapped-usdc contract on Stacks
 * Run: NETWORK=mainnet node scripts/list-stacks-signers.js
 */

import "dotenv/config";
import { callReadOnlyFunction, cvToJSON, uintCV } from "@stacks/transactions";
import { StacksMainnet, StacksTestnet } from "@stacks/network";

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

async function readOnly(functionName, functionArgs = []) {
    if (!CONTRACT_ADDRESS) {
        throw new Error("STACKS_CONTRACT_ADDRESS not set");
    }

    return callReadOnlyFunction({
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName,
        functionArgs,
        network,
        senderAddress: CONTRACT_ADDRESS,
    });
}

function unwrapOptionalPrincipal(json) {
    if (json?.type === "some") return json.value;
    return null;
}

async function main() {
    if (!CONTRACT_ADDRESS) {
        console.error("❌ STACKS_CONTRACT_ADDRESS not set in .env");
        process.exit(1);
    }

    const countCv = await readOnly("get-signer-count");
    const countJson = cvToJSON(countCv);
    const count = Number(countJson.value || 0);

    console.log("═".repeat(60));
    console.log("🔎 Stacks Signers");
    console.log("═".repeat(60));
    console.log(`   Network: ${NETWORK}`);
    console.log(`   Contract: ${CONTRACT_ADDRESS}.${CONTRACT_NAME}`);
    console.log(`   Signer Count: ${count}`);
    console.log("\n   Signers:");

    for (let index = 0; index < count; index += 1) {
        const signerCv = await readOnly("get-signer", [uintCV(index)]);
        const signerJson = cvToJSON(signerCv);
        const signer = unwrapOptionalPrincipal(signerJson);
        if (signer) {
            console.log(`   - [${index}] ${signer}`);
        } else {
            console.log(`   - [${index}] <none>`);
        }
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
