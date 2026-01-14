const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    if (!['hardhat', 'localhost'].includes(hre.network.name)) {
        throw new Error(`approve-execute-latest only supports hardhat/localhost (got ${hre.network.name})`);
    }

    const deploymentsPath = path.join(__dirname, "../deployments.local.json");
    if (!fs.existsSync(deploymentsPath)) {
        throw new Error("Missing deployments.local.json. Run deploy-local first.");
    }

    const deploymentInfo = JSON.parse(fs.readFileSync(deploymentsPath, "utf8"));
    const bridgeAddress = deploymentInfo.bridgeAddress;

    const [owner, signer1, signer2] = await hre.ethers.getSigners();
    const bridge = await hre.ethers.getContractAt("BridgeBase", bridgeAddress);

    const releaseNonce = await bridge.releaseNonce();
    if (releaseNonce === 0n) {
        console.log("No releases found.");
        return;
    }

    const releaseId = releaseNonce - 1n;
    const releaseInfo = await bridge.getReleaseInfo(releaseId);

    if (releaseInfo.executed) {
        console.log(`Release #${releaseId} already executed.`);
        return;
    }

    if (releaseInfo.cancelled) {
        console.log(`Release #${releaseId} was cancelled.`);
        return;
    }

    const hasApprovedSigner2 = await bridge.hasApproved(releaseId, signer2.address);
    if (!hasApprovedSigner2) {
        console.log(`Approving release #${releaseId} with signer2...`);
        const tx = await bridge.connect(signer2).approveRelease(releaseId);
        await tx.wait();
        console.log("Approval sent.");
    } else {
        console.log(`Release #${releaseId} already approved by signer2.`);
    }

    const updatedInfo = await bridge.getReleaseInfo(releaseId);
    const latestBlock = await hre.ethers.provider.getBlock("latest");
    const now = BigInt(latestBlock.timestamp);

    if (now < updatedInfo.executeAfter) {
        console.log(
            `Timelock not expired yet. Execute after ${updatedInfo.executeAfter} (now ${now}).`
        );
        return;
    }

    if (updatedInfo.approvalCount < 2n) {
        console.log(`Not enough approvals yet: ${updatedInfo.approvalCount}`);
        return;
    }

    console.log(`Executing release #${releaseId}...`);
    const execTx = await bridge.connect(signer2).executeRelease(releaseId);
    await execTx.wait();
    console.log("Release executed.");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
