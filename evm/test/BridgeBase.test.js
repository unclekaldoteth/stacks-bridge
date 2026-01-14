const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");

describe("BridgeBase", function () {
    let owner;
    let signer1;
    let signer2;
    let signer3;
    let user;
    let receiver;
    let usdc;
    let bridge;

    beforeEach(async function () {
        [owner, signer1, signer2, signer3, user, receiver] = await ethers.getSigners();

        const MockUSDC = await ethers.getContractFactory("MockUSDC");
        usdc = await MockUSDC.deploy();

        const BridgeBase = await ethers.getContractFactory("BridgeBase");
        bridge = await BridgeBase.deploy(await usdc.getAddress(), [
            signer1.address,
            signer2.address,
            signer3.address,
        ]);
    });

    describe("lock", function () {
        it("locks USDC and tracks pending deposits", async function () {
            const amount = await bridge.MIN_DEPOSIT();
            const stacksAddress = "ST1ZGGS886YCZHMFXJR1EK61ZP34FNWNSX28M1PMM";

            await usdc.mint(user.address, amount);
            await usdc.connect(user).approve(await bridge.getAddress(), amount);

            await expect(bridge.connect(user).lock(amount, stacksAddress))
                .to.emit(bridge, "Deposit")
                .withArgs(user.address, amount, stacksAddress, anyValue);

            const pending = await bridge.pendingDeposits(stacksAddress);
            expect(pending).to.equal(amount);
        });

        it("rejects amounts below the minimum", async function () {
            const amount = (await bridge.MIN_DEPOSIT()) - 1n;
            const stacksAddress = "ST1ZGGS886YCZHMFXJR1EK61ZP34FNWNSX28M1PMM";

            await usdc.mint(user.address, amount + 1n);
            await usdc.connect(user).approve(await bridge.getAddress(), amount + 1n);

            await expect(bridge.connect(user).lock(amount, stacksAddress))
                .to.be.revertedWithCustomError(bridge, "AmountBelowMinimum");
        });

        it("rejects invalid Stacks addresses", async function () {
            const amount = await bridge.MIN_DEPOSIT();
            const invalidStacksAddress = "0xabc";

            await usdc.mint(user.address, amount);
            await usdc.connect(user).approve(await bridge.getAddress(), amount);

            await expect(bridge.connect(user).lock(amount, invalidStacksAddress))
                .to.be.revertedWithCustomError(bridge, "InvalidStacksAddress");
        });
    });

    describe("queueRelease", function () {
        it("requires a signer", async function () {
            const amount = ethers.parseUnits("100", 6);
            await usdc.mint(await bridge.getAddress(), amount);

            await expect(
                bridge.connect(user).queueRelease(receiver.address, amount)
            ).to.be.revertedWithCustomError(bridge, "NotSigner");
        });

        it("enforces per-tx and hourly limits", async function () {
            const maxPerTx = ethers.parseUnits("100", 6);
            const hourlyLimit = ethers.parseUnits("150", 6);
            const dailyLimit = ethers.parseUnits("200", 6);

            await bridge.connect(owner).updateLimits(maxPerTx, hourlyLimit, dailyLimit);
            await usdc.mint(await bridge.getAddress(), dailyLimit + 1n);

            await expect(
                bridge.connect(signer1).queueRelease(receiver.address, maxPerTx + 1n)
            ).to.be.revertedWithCustomError(bridge, "ExceedsMaxPerTx");

            await bridge.connect(signer1).queueRelease(receiver.address, maxPerTx);

            await expect(
                bridge.connect(signer1).queueRelease(receiver.address, ethers.parseUnits("60", 6))
            ).to.be.revertedWithCustomError(bridge, "ExceedsHourlyLimit");
        });
    });

    describe("approve + execute", function () {
        it("executes after approvals for small amounts", async function () {
            const amount = ethers.parseUnits("100", 6);
            await usdc.mint(await bridge.getAddress(), amount);

            const releaseId = await bridge
                .connect(signer1)
                .queueRelease.staticCall(receiver.address, amount);

            await bridge.connect(signer1).queueRelease(receiver.address, amount);
            await bridge.connect(signer2).approveRelease(releaseId);

            await expect(bridge.executeRelease(releaseId))
                .to.emit(bridge, "ReleaseExecuted")
                .withArgs(releaseId, receiver.address, amount);

            expect(await usdc.balanceOf(receiver.address)).to.equal(amount);
        });

        it("enforces timelock for medium amounts", async function () {
            const amount = ethers.parseUnits("2000", 6);
            await usdc.mint(await bridge.getAddress(), amount);

            const releaseId = await bridge
                .connect(signer1)
                .queueRelease.staticCall(receiver.address, amount);

            await bridge.connect(signer1).queueRelease(receiver.address, amount);
            await bridge.connect(signer2).approveRelease(releaseId);

            await expect(bridge.executeRelease(releaseId))
                .to.be.revertedWithCustomError(bridge, "TimelockNotExpired");

            const delay = await bridge.MEDIUM_DELAY();
            await time.increase(delay);

            await expect(bridge.executeRelease(releaseId))
                .to.emit(bridge, "ReleaseExecuted")
                .withArgs(releaseId, receiver.address, amount);
        });

        it("tracks approvals and prevents duplicates", async function () {
            const amount = ethers.parseUnits("100", 6);
            await usdc.mint(await bridge.getAddress(), amount);

            const releaseId = await bridge
                .connect(signer1)
                .queueRelease.staticCall(receiver.address, amount);

            await bridge.connect(signer1).queueRelease(receiver.address, amount);
            await bridge.connect(signer2).approveRelease(releaseId);

            await expect(bridge.connect(signer2).approveRelease(releaseId))
                .to.be.revertedWithCustomError(bridge, "AlreadyApproved");
        });

        it("refunds rate limits on cancel", async function () {
            const amount = ethers.parseUnits("500", 6);
            await usdc.mint(await bridge.getAddress(), amount);

            const releaseId = await bridge
                .connect(signer1)
                .queueRelease.staticCall(receiver.address, amount);

            await bridge.connect(signer1).queueRelease(receiver.address, amount);

            expect(await bridge.currentHourlyVolume()).to.equal(amount);
            expect(await bridge.currentDailyVolume()).to.equal(amount);

            await bridge.connect(signer2).cancelRelease(releaseId);

            expect(await bridge.currentHourlyVolume()).to.equal(0n);
            expect(await bridge.currentDailyVolume()).to.equal(0n);
        });
    });
});
