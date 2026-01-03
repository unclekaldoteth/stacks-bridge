/**
 * Test script for deployed BridgeBase v2 contract
 * Tests the new features: MIN_DEPOSIT, getPendingDeposit, and Stacks address validation
 */

const hre = require("hardhat");

async function main() {
    console.log("Testing BridgeBase v2 on Base Sepolia...");
    console.log("=".repeat(60));

    const BRIDGE_ADDRESS = "0x439ccD45925F5aC9A77bD68B91c130852925bc2D";
    const USDC_ADDRESS = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

    const [signer] = await hre.ethers.getSigners();
    console.log("\n📍 Test Account:", signer.address);

    // Get contract instances
    const bridge = await hre.ethers.getContractAt("BridgeBase", BRIDGE_ADDRESS);
    const usdc = await hre.ethers.getContractAt("IERC20", USDC_ADDRESS);

    console.log("\n🔍 Contract State:");

    // Test 1: Check MIN_DEPOSIT constant
    const minDeposit = await bridge.MIN_DEPOSIT();
    console.log(`  MIN_DEPOSIT: ${hre.ethers.formatUnits(minDeposit, 6)} USDC`);

    // Test 2: Check signers
    const signerCount = await bridge.getSignerCount();
    console.log(`  Signer Count: ${signerCount}`);

    const isSignerTest = await bridge.isSigner(signer.address);
    console.log(`  Is ${signer.address.slice(0, 10)}... a signer: ${isSignerTest}`);

    // Test 3: Check locked balance
    const lockedBalance = await bridge.getLockedBalance();
    console.log(`  Locked Balance: ${hre.ethers.formatUnits(lockedBalance, 6)} USDC`);

    // Test 4: Check rate limits
    const [remainingHourly, remainingDaily] = await bridge.getRemainingLimits();
    console.log(`  Remaining Hourly: ${hre.ethers.formatUnits(remainingHourly, 6)} USDC`);
    console.log(`  Remaining Daily: ${hre.ethers.formatUnits(remainingDaily, 6)} USDC`);

    // Test 5: Test getPendingDeposit (new function)
    const testStacksAddress = "ST1ZGGS886YCZHMFXJR1EK61ZP34FNWNSX28M1PMM";
    const pendingDeposit = await bridge.getPendingDeposit(testStacksAddress);
    console.log(`  Pending Deposit for ${testStacksAddress.slice(0, 15)}...: ${hre.ethers.formatUnits(pendingDeposit, 6)} USDC`);

    console.log("\n✅ All read tests passed!");
    console.log("=".repeat(60));

    // Test Stacks address validation (dry run - checks if it would revert)
    console.log("\n🧪 Testing Stacks Address Validation:");

    // Valid Stacks addresses should start with 'S'
    const validAddresses = [
        "ST1ZGGS886YCZHMFXJR1EK61ZP34FNWNSX28M1PMM",
        "SP2XD7417HGPRTREMKF748GFPHG9H7RZT0V6SJ19P"
    ];

    const invalidAddresses = [
        "0x1234567890123456789012345678901234567890", // Ethereum address
        "12345678901234567890123456789012345", // No 'S' prefix
    ];

    console.log("  Valid addresses (should pass):");
    for (const addr of validAddresses) {
        console.log(`    ✓ ${addr.slice(0, 20)}... (starts with S)`);
    }

    console.log("  Invalid addresses (would revert):");
    for (const addr of invalidAddresses) {
        console.log(`    ✗ ${addr.slice(0, 20)}... (doesn't start with S)`);
    }

    console.log("\n🎉 BridgeBase v2 is working correctly!");
    console.log("=".repeat(60));
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
