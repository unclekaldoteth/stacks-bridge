import { describe, expect, it, beforeEach } from "vitest";
import { Cl } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet1 = accounts.get("wallet_1")!;
const wallet2 = accounts.get("wallet_2")!;
const relayer = accounts.get("wallet_3")!;

const CONTRACT = "wrapped-usdc-v4";

const ERR = {
    NOT_AUTHORIZED: 401,
    INVALID_AMOUNT: 403,
    NOT_SIGNER: 405,
    EXCEEDS_MAX_TX: 406,
    ALREADY_APPROVED: 409,
};

function initializeSigners() {
    return simnet.callPublicFn(
        CONTRACT,
        "initialize-signers",
        [Cl.principal(wallet1), Cl.principal(wallet2), Cl.principal(relayer)],
        deployer
    );
}

describe("wrapped-usdc-v4", () => {
    it("initialize-signers can only run once", () => {
        // First call should succeed
        const result1 = initializeSigners();
        expect(result1.result).toBeOk(Cl.bool(true));

        // Second call should fail
        const result2 = simnet.callPublicFn(
            CONTRACT,
            "initialize-signers",
            [Cl.principal(wallet1), Cl.principal(wallet2), Cl.principal(relayer)],
            deployer
        );
        expect(result2.result).toBeErr(Cl.uint(ERR.NOT_AUTHORIZED));
    });

    it("queue-mint rejects non-signers", () => {
        // Initialize signers first
        initializeSigners();

        // Non-signer should fail
        const result = simnet.callPublicFn(
            CONTRACT,
            "queue-mint",
            [Cl.principal(deployer), Cl.uint(1_000_000)],
            deployer // deployer is not a signer
        );
        expect(result.result).toBeErr(Cl.uint(ERR.NOT_SIGNER));
    });

    it("queue-mint enforces max-per-tx", () => {
        initializeSigners();

        // Amount exceeds MAX-PER-TX (10B micro-USDC = 10K USDC)
        const result = simnet.callPublicFn(
            CONTRACT,
            "queue-mint",
            [Cl.principal(wallet1), Cl.uint(10_000_000_001)],
            wallet1
        );
        expect(result.result).toBeErr(Cl.uint(ERR.EXCEEDS_MAX_TX));
    });

    it("approve-mint rejects duplicate approvals", () => {
        initializeSigners();

        // Queue a mint (auto-approves for initiator)
        const queueResult = simnet.callPublicFn(
            CONTRACT,
            "queue-mint",
            [Cl.principal(wallet1), Cl.uint(1_000_000)],
            wallet1
        );
        expect(queueResult.result).toBeOk(Cl.uint(0));

        // Same signer trying to approve again
        const approveResult = simnet.callPublicFn(
            CONTRACT,
            "approve-mint",
            [Cl.uint(0)],
            wallet1
        );
        expect(approveResult.result).toBeErr(Cl.uint(ERR.ALREADY_APPROVED));
    });

    it("burn rejects zero amount", () => {
        initializeSigners();

        const result = simnet.callPublicFn(
            CONTRACT,
            "burn",
            [Cl.uint(0), Cl.stringAscii("0x0000000000000000000000000000000000000000")],
            wallet1
        );
        expect(result.result).toBeErr(Cl.uint(ERR.INVALID_AMOUNT));
    });

    it("get-signer-count returns correct count after initialization", () => {
        initializeSigners();

        const result = simnet.callReadOnlyFn(
            CONTRACT,
            "get-signer-count",
            [],
            deployer
        );
        expect(result.result).toBeUint(3);
    });

    it("is-authorized-signer returns true for signers", () => {
        initializeSigners();

        const result = simnet.callReadOnlyFn(
            CONTRACT,
            "is-authorized-signer",
            [Cl.principal(wallet1)],
            deployer
        );
        expect(result.result).toBeBool(true);
    });

    it("is-authorized-signer returns false for non-signers", () => {
        initializeSigners();

        const result = simnet.callReadOnlyFn(
            CONTRACT,
            "is-authorized-signer",
            [Cl.principal(deployer)],
            deployer
        );
        expect(result.result).toBeBool(false);
    });
});
