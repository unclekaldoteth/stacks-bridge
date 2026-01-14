const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    if (!['hardhat', 'localhost'].includes(hre.network.name)) {
        throw new Error(`deploy-local only supports hardhat/localhost (got ${hre.network.name})`);
    }

    const [deployer, signer1, signer2, signer3, user] = await hre.ethers.getSigners();

    console.log("Deploying MockUSDC + BridgeBase to local network...");

    const MockUSDC = await hre.ethers.getContractFactory("MockUSDC");
    const usdc = await MockUSDC.deploy();
    await usdc.waitForDeployment();

    const BridgeBase = await hre.ethers.getContractFactory("BridgeBase");
    const bridge = await BridgeBase.deploy(await usdc.getAddress(), [
        signer1.address,
        signer2.address,
        signer3.address,
    ]);
    await bridge.waitForDeployment();

    const userAmount = hre.ethers.parseUnits("100000", 6);
    await usdc.mint(user.address, userAmount);

    const deploymentInfo = {
        network: hre.network.name,
        usdcAddress: await usdc.getAddress(),
        bridgeAddress: await bridge.getAddress(),
        signers: [signer1.address, signer2.address, signer3.address],
        fundedUser: user.address,
        fundedUserBalance: userAmount.toString(),
    };

    const outputPath = path.join(__dirname, "../deployments.local.json");
    fs.writeFileSync(outputPath, JSON.stringify(deploymentInfo, null, 2));

    console.log("\n✅ Local deployment complete");
    console.log(`USDC: ${deploymentInfo.usdcAddress}`);
    console.log(`Bridge: ${deploymentInfo.bridgeAddress}`);
    console.log(`Funded user: ${deploymentInfo.fundedUser}`);
    console.log(`Signers: ${deploymentInfo.signers.join(", ")}`);
    console.log(`\nSaved to: ${outputPath}`);

    console.log("\nSet these for the relayer:");
    console.log(`BASE_RPC_URL=http://127.0.0.1:8545`);
    console.log(`BRIDGE_BASE_ADDRESS=${deploymentInfo.bridgeAddress}`);
    console.log("SIGNER_PRIVATE_KEY=<use signer1 private key from hardhat node>");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
