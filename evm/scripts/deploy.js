const hre = require("hardhat");

async function main() {
    console.log("Deploying BridgeBase (Multi-Sig) to Base Sepolia...");
    console.log("=".repeat(60));

    // Configuration
    const DEFAULT_USDC_SEPOLIA = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
    const isBaseSepolia = ["baseSepolia", "baseSepoliaFlashblocks"].includes(hre.network.name);
    const USDC_ADDRESS = process.env.USDC_ADDRESS || (isBaseSepolia ? DEFAULT_USDC_SEPOLIA : null);

    if (!USDC_ADDRESS) {
        throw new Error(`Missing USDC_ADDRESS for network ${hre.network.name}`);
    }

    // Multi-sig: Get 3 signer addresses from environment
    const SIGNER_1 = process.env.SIGNER_1;
    const SIGNER_2 = process.env.SIGNER_2;
    const SIGNER_3 = process.env.SIGNER_3;

    if (!SIGNER_1 || !SIGNER_2 || !SIGNER_3) {
        throw new Error("Missing signer addresses. Set SIGNER_1, SIGNER_2, SIGNER_3 in .env");
    }

    const signers = [SIGNER_1, SIGNER_2, SIGNER_3];

    const [deployer] = await hre.ethers.getSigners();
    console.log("\n📋 Deployment Config:");
    console.log("Deployer:", deployer.address);
    console.log("Balance:", hre.ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "ETH");
    console.log("\n🔐 Multi-Sig Signers (2-of-3):");
    signers.forEach((s, i) => console.log(`  Signer ${i + 1}: ${s}`));

    // Deploy
    console.log("\n🚀 Deploying...");
    const BridgeBase = await hre.ethers.getContractFactory("BridgeBase");
    const bridge = await BridgeBase.deploy(USDC_ADDRESS, signers);
    await bridge.waitForDeployment();

    const bridgeAddress = await bridge.getAddress();

    console.log("\n✅ Deployment Complete!");
    console.log("=".repeat(60));
    console.log("Bridge Address:", bridgeAddress);
    console.log("USDC Address:", USDC_ADDRESS);
    console.log("Network:", hre.network.name);
    console.log("=".repeat(60));

    // Security Configuration Summary
    console.log("\n🔒 Security Features:");
    console.log("  • Multi-Sig: 2-of-3 required for releases");
    console.log("  • Rate Limits: 10K/tx, 50K/hr, 200K/day");
    console.log("  • Timelock: Instant (<1K), 10min (<10K), 1hr (>10K)");
    console.log("  • Emergency: Any signer can pause");

    // Save deployment info
    const fs = require("fs");
    const deploymentInfo = {
        network: hre.network.name,
        bridgeAddress: bridgeAddress,
        usdcAddress: USDC_ADDRESS,
        signers: signers,
        requiredSignatures: 2,
        rateLimits: {
            maxPerTx: "10000 USDC",
            hourlyLimit: "50000 USDC",
            dailyLimit: "200000 USDC"
        },
        timelockDelays: {
            small: "0 (instant)",
            medium: "10 minutes",
            large: "1 hour"
        },
        deployedAt: new Date().toISOString(),
        deployer: deployer.address
    };

    fs.writeFileSync("./deployments.json", JSON.stringify(deploymentInfo, null, 2));
    console.log("\n💾 Deployment info saved to deployments.json");

    // Verify on BaseScan
    if (process.env.BASESCAN_API_KEY) {
        console.log("\n🔍 Verifying on BaseScan...");
        try {
            await hre.run("verify:verify", {
                address: bridgeAddress,
                constructorArguments: [USDC_ADDRESS, signers],
            });
            console.log("✅ Verified on BaseScan");
        } catch (error) {
            console.log("⚠️ Verification error:", error.message);
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
