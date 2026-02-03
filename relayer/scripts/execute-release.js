/**
 * Execute Release on Base
 * Execute a pending release after timelock
 * 
 * Run: node scripts/execute-release.js [releaseId]
 */

import "dotenv/config";
import { createPublicClient, createWalletClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const BASE_RPC = process.env.BASE_RPC_URL || "https://sepolia.base.org";
const BRIDGE_ADDRESS = process.env.BRIDGE_BASE_ADDRESS || "0xFCDF3e427e4a4CF3E573762693B9a1bBb35C504B";

// Bridge ABI
const BRIDGE_ABI = [
    {
        name: 'executeRelease',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [{ name: 'releaseId', type: 'uint256' }],
        outputs: []
    },
    {
        name: 'getReleaseInfo',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: 'releaseId', type: 'uint256' }],
        outputs: [
            { name: 'receiver', type: 'address' },
            { name: 'amount', type: 'uint256' },
            { name: 'executeAfter', type: 'uint256' },
            { name: 'approvalCount', type: 'uint256' },
            { name: 'executed', type: 'bool' },
            { name: 'cancelled', type: 'bool' }
        ]
    }
];

async function main() {
    const releaseId = process.argv[2] || "0";

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
    console.log(`🚀 Executing Release #${releaseId}`);
    console.log("═".repeat(50));

    // Get release info
    const info = await publicClient.readContract({
        address: BRIDGE_ADDRESS,
        abi: BRIDGE_ABI,
        functionName: 'getReleaseInfo',
        args: [BigInt(releaseId)],
    });

    console.log(`   Receiver: ${info[0]}`);
    console.log(`   Amount: ${Number(info[1]) / 1e6} USDC`);
    console.log(`   Execute After: ${new Date(Number(info[2]) * 1000).toISOString()}`);
    console.log(`   Approval Count: ${info[3]}`);
    console.log(`   Executed: ${info[4]}`);

    if (info[4]) {
        console.log("\n⚠️  Release already executed!");
        process.exit(0);
    }

    const now = Math.floor(Date.now() / 1000);
    if (now < Number(info[2])) {
        console.log(`\n⏳ Timelock not expired. Wait ${Number(info[2]) - now} seconds.`);
        process.exit(1);
    }

    console.log("\n🔄 Executing release...");

    try {
        const hash = await walletClient.writeContract({
            address: BRIDGE_ADDRESS,
            abi: BRIDGE_ABI,
            functionName: 'executeRelease',
            args: [BigInt(releaseId)],
        });

        console.log(`   TX Hash: ${hash}`);

        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        console.log(`\n✅ Release executed in block ${receipt.blockNumber}`);
        console.log(`   ${Number(info[1]) / 1e6} USDC sent to ${info[0]}`);
    } catch (error) {
        console.error("❌ Error:", error.message);
        process.exit(1);
    }
}

main().catch(console.error);
