/**
 * Remove a signer from BridgeBase contract
 * Run: NETWORK=mainnet node scripts/remove-base-signer.js <signerAddress>
 */

import "dotenv/config";
import { createPublicClient, createWalletClient, http } from 'viem';
import { base, baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const NETWORK = process.env.NETWORK || "testnet";
const IS_MAINNET = NETWORK === "mainnet";
const BASE_RPC = process.env.BASE_RPC_URL || (IS_MAINNET ? "https://mainnet.base.org" : "https://sepolia.base.org");
const BRIDGE_ADDRESS = process.env.BRIDGE_BASE_ADDRESS;
const OWNER_PRIVATE_KEY = process.env.OWNER_PRIVATE_KEY || process.env.SIGNER_PRIVATE_KEY;

const ABI = [
    { name: 'removeSigner', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'signer', type: 'address' }], outputs: [] },
    { name: 'owner', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
    { name: 'isSigner', type: 'function', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'bool' }] },
];

async function main() {
    if (!BRIDGE_ADDRESS) {
        console.error("❌ BRIDGE_BASE_ADDRESS not set");
        process.exit(1);
    }

    const signerToRemove = process.argv[2];
    if (!signerToRemove) {
        console.error("❌ Signer address required.");
        console.log("   Usage: node scripts/remove-base-signer.js <signerAddress>");
        process.exit(1);
    }

    if (!OWNER_PRIVATE_KEY) {
        console.error("❌ OWNER_PRIVATE_KEY not set");
        process.exit(1);
    }

    let key = OWNER_PRIVATE_KEY.trim();
    if (!key.startsWith('0x')) key = `0x${key}`;

    const account = privateKeyToAccount(key);
    const chain = IS_MAINNET ? base : baseSepolia;

    const publicClient = createPublicClient({
        chain,
        transport: http(BASE_RPC),
    });

    const walletClient = createWalletClient({
        account,
        chain,
        transport: http(BASE_RPC),
    });

    console.log("═".repeat(50));
    console.log("🗑️ Remove Signer from BridgeBase");
    console.log("═".repeat(50));
    console.log(`   Network: ${NETWORK}`);
    console.log(`   Caller: ${account.address}`);
    console.log(`   Removing Signer: ${signerToRemove}`);

    // Check owner
    const owner = await publicClient.readContract({
        address: BRIDGE_ADDRESS,
        abi: ABI,
        functionName: 'owner',
    });

    if (owner.toLowerCase() !== account.address.toLowerCase()) {
        console.error("❌ Caller is not the contract owner!");
        process.exit(1);
    }

    const isSigner = await publicClient.readContract({
        address: BRIDGE_ADDRESS,
        abi: ABI,
        functionName: 'isSigner',
        args: [signerToRemove],
    });

    if (!isSigner) {
        console.log("⚠️ Address is not a signer. Nothing to remove.");
        process.exit(0);
    }

    console.log("\n🔄 Removing signer...");

    try {
        const hash = await walletClient.writeContract({
            address: BRIDGE_ADDRESS,
            abi: ABI,
            functionName: 'removeSigner',
            args: [signerToRemove],
        });

        console.log(`   TX Hash: ${hash}`);
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        console.log(`\n✅ Signer removed in block ${receipt.blockNumber}`);
    } catch (error) {
        console.error("❌ Error:", error.message);
        process.exit(1);
    }
}

main().catch(console.error);
