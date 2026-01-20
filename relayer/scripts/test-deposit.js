/**
 * Test Deposit Script - Base Sepolia → Stacks Testnet
 * 
 * This script deposits USDC to the bridge and monitors for relayer response.
 * Run with: node scripts/test-deposit.js
 */

import { createPublicClient, createWalletClient, http, parseAbi, formatUnits } from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import dotenv from 'dotenv';

dotenv.config();

// Config
const BRIDGE_ADDRESS = process.env.BRIDGE_BASE_ADDRESS || '0xb879aF9CeA3193157168A10Fdfdb853bDE4f32Ef';
const USDC_ADDRESS = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';
const RPC_URL = process.env.BASE_RPC_URL || 'https://base-sepolia.g.alchemy.com/v2/poHXZbv0T2Q6sgplkdhqf';

// ABIs
const USDC_ABI = parseAbi([
    'function balanceOf(address) view returns (uint256)',
    'function approve(address spender, uint256 amount) returns (bool)',
    'function allowance(address owner, address spender) view returns (uint256)',
]);

const BRIDGE_ABI = parseAbi([
    'function lock(uint256 amount, string calldata stacksAddress)',
    'event Deposit(address indexed from, uint256 amount, string stacksAddress, uint256 timestamp)',
]);

async function main() {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🧪 Testnet Deposit Test - Base Sepolia → Stacks');
    console.log('═══════════════════════════════════════════════════════════');

    // Get private key
    const privateKey = process.env.SIGNER_PRIVATE_KEY;
    if (!privateKey) {
        console.error('❌ SIGNER_PRIVATE_KEY not set in .env');
        process.exit(1);
    }

    // Create clients
    const account = privateKeyToAccount(privateKey);
    const publicClient = createPublicClient({
        chain: baseSepolia,
        transport: http(RPC_URL),
    });
    const walletClient = createWalletClient({
        account,
        chain: baseSepolia,
        transport: http(RPC_URL),
    });

    console.log(`\n📍 Configuration:`);
    console.log(`   Bridge: ${BRIDGE_ADDRESS}`);
    console.log(`   USDC: ${USDC_ADDRESS}`);
    console.log(`   Depositor: ${account.address}`);

    // Check USDC balance
    const balance = await publicClient.readContract({
        address: USDC_ADDRESS,
        abi: USDC_ABI,
        functionName: 'balanceOf',
        args: [account.address],
    });

    console.log(`\n💰 USDC Balance: ${formatUnits(balance, 6)} USDC`);

    if (balance < 1000000n) { // 1 USDC minimum
        console.error('❌ Insufficient USDC balance. Need at least 1 USDC.');
        console.log('   Get testnet USDC from https://faucet.circle.com');
        process.exit(1);
    }

    // Deposit amount (1 USDC)
    const depositAmount = 1000000n; // 1 USDC (6 decimals)
    const stacksAddress = 'ST1ZGGS886YCZHMFXJR1EK61ZP34FNWNSX28M1PMM'; // Testnet deployer

    console.log(`\n📤 Deposit Amount: ${formatUnits(depositAmount, 6)} USDC`);
    console.log(`   To Stacks: ${stacksAddress}`);

    // Check allowance
    const allowance = await publicClient.readContract({
        address: USDC_ADDRESS,
        abi: USDC_ABI,
        functionName: 'allowance',
        args: [account.address, BRIDGE_ADDRESS],
    });

    console.log(`\n🔒 Current Allowance: ${formatUnits(allowance, 6)} USDC`);

    // Approve if needed
    if (allowance < depositAmount) {
        console.log(`\n⏳ Approving USDC...`);
        const approveHash = await walletClient.writeContract({
            address: USDC_ADDRESS,
            abi: USDC_ABI,
            functionName: 'approve',
            args: [BRIDGE_ADDRESS, depositAmount * 10n], // Approve extra for future tests
        });
        console.log(`   Approve TX: ${approveHash}`);
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
        console.log(`   ✅ Approved!`);
    }

    // Deposit
    console.log(`\n⏳ Locking USDC in bridge...`);
    const depositHash = await walletClient.writeContract({
        address: BRIDGE_ADDRESS,
        abi: BRIDGE_ABI,
        functionName: 'lock',
        args: [depositAmount, stacksAddress],
    });

    console.log(`   Deposit TX: ${depositHash}`);
    console.log(`   View on BaseScan: https://sepolia.basescan.org/tx/${depositHash}`);

    const receipt = await publicClient.waitForTransactionReceipt({ hash: depositHash });

    if (receipt.status === 'success') {
        console.log(`\n✅ Deposit Successful!`);
        console.log(`   Block: ${receipt.blockNumber}`);
        console.log(`\n📡 Relayer should now detect this deposit and queue mint on Stacks.`);
        console.log(`   Check relayer logs for: "📥 New Deposit Detected"`);
    } else {
        console.error(`\n❌ Deposit Failed!`);
        process.exit(1);
    }

    console.log(`\n═══════════════════════════════════════════════════════════`);
}

main().catch(console.error);
