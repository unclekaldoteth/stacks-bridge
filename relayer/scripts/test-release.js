/**
 * Test Queue Release on Base
 * Manually queue a release to test the Base → USDC flow
 * 
 * Run: node scripts/test-release.js
 */

import "dotenv/config";
import { createPublicClient, createWalletClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const BASE_RPC = process.env.BASE_RPC_URL || "https://base-sepolia.g.alchemy.com/v2/poHXZbv0T2Q6sgplkdhqf";
const BRIDGE_ADDRESS = process.env.BRIDGE_BASE_ADDRESS || "0xb879aF9CeA3193157168A10Fdfdb853bDE4f32Ef";

// Bridge ABI (only what we need)
const BRIDGE_ABI = [
    {
        name: 'queueRelease',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
            { name: 'receiver', type: 'address' },
            { name: 'amount', type: 'uint256' }
        ],
        outputs: [{ name: '', type: 'uint256' }]
    },
    {
        name: 'releaseNonce',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: '', type: 'uint256' }]
    },
    {
        name: 'isSigner',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: '', type: 'address' }],
        outputs: [{ name: '', type: 'bool' }]
    }
];

async function main() {
    // Amount to release (5 USDC - matches the burn)
    const releaseAmount = process.argv[2] || "5000000"; // 5 USDC
    const receiver = process.argv[3] || "0x776beEaDe7115Bd870C1344Fec02eF31758C319E";

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

    console.log("═".repeat(60));
    console.log("🔓 Test Queue Release - Base Sepolia");
    console.log("═".repeat(60));
    console.log(`   Bridge: ${BRIDGE_ADDRESS}`);
    console.log(`   Signer: ${account.address}`);
    console.log(`   Receiver: ${receiver}`);
    console.log(`   Amount: ${parseInt(releaseAmount) / 1e6} USDC`);

    // Check if signer
    const isSigner = await publicClient.readContract({
        address: BRIDGE_ADDRESS,
        abi: BRIDGE_ABI,
        functionName: 'isSigner',
        args: [account.address],
    });

    if (!isSigner) {
        console.error("❌ Address is not an authorized signer");
        process.exit(1);
    }
    console.log("\n✅ Signer verified");

    // Get current nonce
    const nonce = await publicClient.readContract({
        address: BRIDGE_ADDRESS,
        abi: BRIDGE_ABI,
        functionName: 'releaseNonce',
    });
    console.log(`📊 Current release nonce: ${nonce}`);

    console.log("\n🔄 Queuing release...");

    try {
        const hash = await walletClient.writeContract({
            address: BRIDGE_ADDRESS,
            abi: BRIDGE_ABI,
            functionName: 'queueRelease',
            args: [receiver, BigInt(releaseAmount)],
        });

        console.log(`   TX Hash: ${hash}`);
        console.log(`   View: https://sepolia.basescan.org/tx/${hash}`);

        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        console.log(`\n✅ Release queued in block ${receipt.blockNumber}`);
        console.log(`   Release ID: ${nonce}`);
        console.log("\n   Next step: Execute release after timelock");
    } catch (error) {
        console.error("❌ Error:", error.message);

        // Check if it's a revert
        if (error.message.includes("revert")) {
            console.log("\n   Possible causes:");
            console.log("   - Insufficient bridge USDC balance");
            console.log("   - Not an authorized signer");
            console.log("   - Amount exceeds limits");
        }
        process.exit(1);
    }
}

main().catch(console.error);
