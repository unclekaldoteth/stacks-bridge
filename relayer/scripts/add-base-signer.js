/**
 * Add a new signer to BridgeBase contract
 * Run: node scripts/add-base-signer.js [newSignerAddress]
 */

import "dotenv/config";
import { createPublicClient, createWalletClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const BASE_RPC = process.env.BASE_RPC_URL || "https://base-sepolia.g.alchemy.com/v2/poHXZbv0T2Q6sgplkdhqf";
const BRIDGE_ADDRESS = process.env.BRIDGE_BASE_ADDRESS || "0xb879aF9CeA3193157168A10Fdfdb853bDE4f32Ef";

const ABI = [
    { name: 'addSigner', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'newSigner', type: 'address' }], outputs: [] },
    { name: 'owner', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
    { name: 'isSigner', type: 'function', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'bool' }] },
];

async function main() {
    const newSigner = process.argv[2] || "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

    const privateKey = process.env.SIGNER_PRIVATE_KEY;
    if (!privateKey) {
        console.error("❌ SIGNER_PRIVATE_KEY not set");
        process.exit(1);
    }

    let key = privateKey.trim();
    if (!key.startsWith('0x')) key = `0x${key}`;

    const account = privateKeyToAccount(key);

    const publicClient = createPublicClient({
        chain: baseSepolia,
        transport: http(BASE_RPC),
    });

    const walletClient = createWalletClient({
        account,
        chain: baseSepolia,
        transport: http(BASE_RPC),
    });

    console.log("═".repeat(50));
    console.log("🔐 Add Signer to BridgeBase");
    console.log("═".repeat(50));
    console.log(`   Caller: ${account.address}`);
    console.log(`   New Signer: ${newSigner}`);

    // Check owner
    const owner = await publicClient.readContract({
        address: BRIDGE_ADDRESS,
        abi: ABI,
        functionName: 'owner',
    });
    console.log(`   Contract Owner: ${owner}`);

    if (owner.toLowerCase() !== account.address.toLowerCase()) {
        console.error("❌ Caller is not the contract owner!");
        process.exit(1);
    }

    // Check if already signer
    const alreadySigner = await publicClient.readContract({
        address: BRIDGE_ADDRESS,
        abi: ABI,
        functionName: 'isSigner',
        args: [newSigner],
    });

    if (alreadySigner) {
        console.log("\n⚠️  Address is already a signer!");
        process.exit(0);
    }

    console.log("\n🔄 Adding signer...");

    try {
        const hash = await walletClient.writeContract({
            address: BRIDGE_ADDRESS,
            abi: ABI,
            functionName: 'addSigner',
            args: [newSigner],
        });

        console.log(`   TX Hash: ${hash}`);

        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        console.log(`\n✅ Signer added in block ${receipt.blockNumber}`);
    } catch (error) {
        console.error("❌ Error:", error.message);
        process.exit(1);
    }
}

main().catch(console.error);
