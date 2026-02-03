/**
 * List BridgeBase signers
 * Run: NETWORK=mainnet node scripts/list-base-signers.js
 */

import "dotenv/config";
import { createPublicClient, http } from 'viem';
import { base, baseSepolia } from 'viem/chains';

const NETWORK = process.env.NETWORK || "testnet";
const IS_MAINNET = NETWORK === "mainnet";
const BASE_RPC = process.env.BASE_RPC_URL || (IS_MAINNET ? "https://mainnet.base.org" : "https://sepolia.base.org");
const BRIDGE_ADDRESS = process.env.BRIDGE_BASE_ADDRESS;

const ABI = [
    { name: 'getSigners', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address[]' }] },
    { name: 'REQUIRED_SIGNATURES', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
];

async function main() {
    if (!BRIDGE_ADDRESS) {
        console.error("❌ BRIDGE_BASE_ADDRESS not set");
        process.exit(1);
    }

    const chain = IS_MAINNET ? base : baseSepolia;
    const publicClient = createPublicClient({
        chain,
        transport: http(BASE_RPC),
    });

    const signers = await publicClient.readContract({
        address: BRIDGE_ADDRESS,
        abi: ABI,
        functionName: 'getSigners',
    });

    const required = await publicClient.readContract({
        address: BRIDGE_ADDRESS,
        abi: ABI,
        functionName: 'REQUIRED_SIGNATURES',
    });

    console.log("═".repeat(60));
    console.log("🔎 BridgeBase Signers");
    console.log("═".repeat(60));
    console.log(`   Network: ${NETWORK}`);
    console.log(`   Bridge: ${BRIDGE_ADDRESS}`);
    console.log(`   Required Signatures: ${required}`);
    console.log("\n   Signers:");

    for (const signer of signers) {
        console.log(`   - ${signer}`);
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
