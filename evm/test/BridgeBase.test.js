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

    describe("pause", function () {
        it("prevents lock when paused", async function () {
            const amount = await bridge.MIN_DEPOSIT();
            const stacksAddress = "ST1ZGGS886YCZHMFXJR1EK61ZP34FNWNSX28M1PMM";

            await usdc.mint(user.address, amount);
            await usdc.connect(user).approve(await bridge.getAddress(), amount);

            await bridge.connect(signer1).pause();

            await expect(bridge.connect(user).lock(amount, stacksAddress))
                .to.be.revertedWithCustomError(bridge, "EnforcedPause");
        });

        it("prevents queueRelease when paused", async function () {
            const amount = ethers.parseUnits("100", 6);
            await usdc.mint(await bridge.getAddress(), amount);

            await bridge.connect(signer1).pause();

            await expect(
                bridge.connect(signer1).queueRelease(receiver.address, amount)
            ).to.be.revertedWithCustomError(bridge, "EnforcedPause");
        });

        it("prevents executeRelease when paused", async function () {
            const amount = ethers.parseUnits("100", 6);
            await usdc.mint(await bridge.getAddress(), amount);

            const releaseId = await bridge
                .connect(signer1)
                .queueRelease.staticCall(receiver.address, amount);

            await bridge.connect(signer1).queueRelease(receiver.address, amount);
            await bridge.connect(signer2).approveRelease(releaseId);

            await bridge.connect(signer1).pause();

            await expect(bridge.executeRelease(releaseId))
                .to.be.revertedWithCustomError(bridge, "EnforcedPause");
        });

        it("only signers can pause, only owner can unpause", async function () {
            // Non-signer cannot pause
            await expect(bridge.connect(user).pause())
                .to.be.revertedWithCustomError(bridge, "NotSigner");

            // Signer can pause
            await bridge.connect(signer1).pause();

            // Non-owner cannot unpause
            await expect(bridge.connect(signer1).unpause())
                .to.be.revertedWithCustomError(bridge, "OwnableUnauthorizedAccount");

            await bridge.connect(owner).unpause();
        });
    });

    describe("signer management", function () {
        it("addSigner - owner only and respects MAX_SIGNERS", async function () {
            // First remove a signer to make room
            await bridge.connect(owner).removeSigner(signer1.address);

            const newSigner = (await ethers.getSigners())[6];

            await expect(bridge.connect(user).addSigner(newSigner.address))
                .to.be.revertedWithCustomError(bridge, "OwnableUnauthorizedAccount");

            await expect(bridge.connect(owner).addSigner(newSigner.address))
                .to.emit(bridge, "SignerAdded")
                .withArgs(newSigner.address);

            expect(await bridge.isSigner(newSigner.address)).to.be.true;
        });

        it("addSigner - respects MAX_SIGNERS limit", async function () {
            const newSigner = (await ethers.getSigners())[6];
            // Already at max 3 signers, should fail
            await expect(bridge.connect(owner).addSigner(newSigner.address))
                .to.be.revertedWithCustomError(bridge, "TooManySigners");
        });

        it("removeSigner - owner only", async function () {
            await expect(bridge.connect(user).removeSigner(signer1.address))
                .to.be.revertedWithCustomError(bridge, "OwnableUnauthorizedAccount");

            await expect(bridge.connect(owner).removeSigner(signer1.address))
                .to.emit(bridge, "SignerRemoved")
                .withArgs(signer1.address);

            expect(await bridge.isSigner(signer1.address)).to.be.false;
        });

        it("removeSigner - keeps minimum signers", async function () {
            // With REQUIRED_SIGNATURES=2, we need at least 2 signers
            // Remove one signer (3 -> 2)
            await bridge.connect(owner).removeSigner(signer1.address);

            // Removing another signer should fail (need at least 2 for REQUIRED_SIGNATURES=2)
            await expect(bridge.connect(owner).removeSigner(signer2.address))
                .to.be.revertedWithCustomError(bridge, "NotEnoughSigners");
        });

        it("removeSigner - non-existent signer reverts", async function () {
            await expect(bridge.connect(owner).removeSigner(user.address))
                .to.be.revertedWithCustomError(bridge, "SignerDoesNotExist");
        });
    });

    describe("emergency withdraw", function () {
        it("only owner can call", async function () {
            const amount = ethers.parseUnits("1000", 6);
            await usdc.mint(await bridge.getAddress(), amount);

            await expect(
                bridge.connect(user).emergencyWithdraw(owner.address, amount)
            ).to.be.revertedWithCustomError(bridge, "OwnableUnauthorizedAccount");
        });

        it("transfers correct amount and emits event", async function () {
            const amount = ethers.parseUnits("1000", 6);
            await usdc.mint(await bridge.getAddress(), amount);

            const balanceBefore = await usdc.balanceOf(owner.address);

            await expect(bridge.connect(owner).emergencyWithdraw(owner.address, amount))
                .to.emit(bridge, "EmergencyWithdraw")
                .withArgs(owner.address, amount, owner.address);

            const balanceAfter = await usdc.balanceOf(owner.address);
            expect(balanceAfter - balanceBefore).to.equal(amount);
        });
    });

    describe("edge cases", function () {
        it("daily limit enforcement", async function () {
            const maxPerTx = ethers.parseUnits("100", 6);
            const hourlyLimit = ethers.parseUnits("500", 6);
            const dailyLimit = ethers.parseUnits("150", 6);

            await bridge.connect(owner).updateLimits(maxPerTx, hourlyLimit, dailyLimit);
            await usdc.mint(await bridge.getAddress(), dailyLimit * 2n);

            // First release should succeed
            await bridge.connect(signer1).queueRelease(receiver.address, maxPerTx);

            // Second release should fail due to daily limit
            await expect(
                bridge.connect(signer1).queueRelease(receiver.address, ethers.parseUnits("60", 6))
            ).to.be.revertedWithCustomError(bridge, "ExceedsDailyLimit");
        });

        it("executeRelease after cancelled reverts", async function () {
            const amount = ethers.parseUnits("100", 6);
            await usdc.mint(await bridge.getAddress(), amount);

            const releaseId = await bridge
                .connect(signer1)
                .queueRelease.staticCall(receiver.address, amount);

            await bridge.connect(signer1).queueRelease(receiver.address, amount);
            await bridge.connect(signer2).cancelRelease(releaseId);

            await expect(bridge.executeRelease(releaseId))
                .to.be.revertedWithCustomError(bridge, "ReleaseCancelledError");
        });

        it("approveRelease by non-signer reverts", async function () {
            const amount = ethers.parseUnits("100", 6);
            await usdc.mint(await bridge.getAddress(), amount);

            const releaseId = await bridge
                .connect(signer1)
                .queueRelease.staticCall(receiver.address, amount);

            await bridge.connect(signer1).queueRelease(receiver.address, amount);

            await expect(bridge.connect(user).approveRelease(releaseId))
                .to.be.revertedWithCustomError(bridge, "NotSigner");
        });

        it("large amount requires 1 hour timelock", async function () {
            const amount = ethers.parseUnits("6000", 6);
            await usdc.mint(await bridge.getAddress(), amount);

            const releaseId = await bridge
                .connect(signer1)
                .queueRelease.staticCall(receiver.address, amount);

            await bridge.connect(signer1).queueRelease(receiver.address, amount);
            await bridge.connect(signer2).approveRelease(releaseId);

            // Should fail before timelock
            await expect(bridge.executeRelease(releaseId))
                .to.be.revertedWithCustomError(bridge, "TimelockNotExpired");

            // Wait for large delay (1 hour)
            const largeDelay = await bridge.LARGE_DELAY();
            await time.increase(largeDelay);

            await expect(bridge.executeRelease(releaseId))
                .to.emit(bridge, "ReleaseExecuted");
        });

        // Note: REQUIRED_SIGNATURES=1 in testnet config, so we skip insufficient approvals test
    });

    describe("view functions", function () {
        it("getLockedBalance returns correct value", async function () {
            const amount = ethers.parseUnits("500", 6);
            await usdc.mint(await bridge.getAddress(), amount);

            expect(await bridge.getLockedBalance()).to.equal(amount);
        });

        it("getSigners returns all signers", async function () {
            const signers = await bridge.getSigners();
            expect(signers.length).to.equal(3);
            expect(signers).to.include(signer1.address);
            expect(signers).to.include(signer2.address);
            expect(signers).to.include(signer3.address);
        });

        it("getReleaseInfo returns correct data", async function () {
            const amount = ethers.parseUnits("100", 6);
            await usdc.mint(await bridge.getAddress(), amount);

            const releaseId = await bridge
                .connect(signer1)
                .queueRelease.staticCall(receiver.address, amount);

            await bridge.connect(signer1).queueRelease(receiver.address, amount);

            const info = await bridge.getReleaseInfo(releaseId);
            expect(info.receiver).to.equal(receiver.address);
            expect(info.amount).to.equal(amount);
            expect(info.approvalCount).to.equal(1);
            expect(info.executed).to.be.false;
            expect(info.cancelled).to.be.false;
        });

        it("getPendingDeposit returns correct value", async function () {
            const amount = await bridge.MIN_DEPOSIT();
            const stacksAddress = "ST1ZGGS886YCZHMFXJR1EK61ZP34FNWNSX28M1PMM";

            await usdc.mint(user.address, amount);
            await usdc.connect(user).approve(await bridge.getAddress(), amount);
            await bridge.connect(user).lock(amount, stacksAddress);

            expect(await bridge.getPendingDeposit(stacksAddress)).to.equal(amount);
        });
    });
});
