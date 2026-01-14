const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    if (!['hardhat', 'localhost'].includes(hre.network.name)) {
        throw new Error(`lock-local only supports hardhat/localhost (got ${hre.network.name})`);
    }

    const deploymentsPath = path.join(__dirname, "../deployments.local.json");
    if (!fs.existsSync(deploymentsPath)) {
        throw new Error("Missing deployments.local.json. Run deploy-local first.");
    }

    const deploymentInfo = JSON.parse(fs.readFileSync(deploymentsPath, "utf8"));
    const usdcAddress = deploymentInfo.usdcAddress;
    const bridgeAddress = deploymentInfo.bridgeAddress;
    const fundedUser = deploymentInfo.fundedUser;

    const stacksAddress = process.env.STACKS_ADDRESS || "ST1ZGGS886YCZHMFXJR1EK61ZP34FNWNSX28M1PMM";
    const amountUsdc = process.env.AMOUNT_USDC || "100";
    const amount = hre.ethers.parseUnits(amountUsdc, 6);

    const signers = await hre.ethers.getSigners();
    const userSigner = signers.find(
        (signer) => signer.address.toLowerCase() === fundedUser.toLowerCase()
    );

    if (!userSigner) {
        throw new Error(`Funded user ${fundedUser} not found in local signers`);
    }

    const usdc = await hre.ethers.getContractAt("MockUSDC", usdcAddress);
    const bridge = await hre.ethers.getContractAt("BridgeBase", bridgeAddress);

    console.log("Submitting local lock...");
    console.log(`User: ${userSigner.address}`);
    console.log(`Amount: ${amountUsdc} USDC`);
    console.log(`Stacks address: ${stacksAddress}`);

    await usdc.connect(userSigner).approve(bridgeAddress, amount);
    const tx = await bridge.connect(userSigner).lock(amount, stacksAddress);
    const receipt = await tx.wait();

    console.log(`\n✅ Deposit confirmed in block ${receipt.blockNumber}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
