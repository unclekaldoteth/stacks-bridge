import { describe, expect, it } from "vitest";
import { Cl, ClarityValue } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet1 = accounts.get("wallet_1")!;
const wallet2 = accounts.get("wallet_2")!;

const CONTRACT = "velar-adapter";

const ERR = {
    NOT_AUTHORIZED: 401,
    INSUFFICIENT_OUTPUT: 502,
    NOT_CONFIGURED: 504,
    INVALID_TOKEN: 505,
};

describe("velar-adapter", () => {
    it("set-router-contract only callable by owner", () => {
        // Non-owner should fail
        const failResult = simnet.callPublicFn(
            CONTRACT,
            "set-router-contract",
            [Cl.principal(wallet1)],
            wallet1
        );
        expect(failResult.result).toBeErr(Cl.uint(ERR.NOT_AUTHORIZED));

        // Owner should succeed
        const successResult = simnet.callPublicFn(
            CONTRACT,
            "set-router-contract",
            [Cl.principal(wallet1)],
            deployer
        );
        expect(successResult.result).toBeOk(Cl.bool(true));
    });

    it("configure-pool sets pool parameters", () => {
        const poolId = 42;

        const result = simnet.callPublicFn(
            CONTRACT,
            "configure-pool",
            [
                Cl.principal(deployer),
                Cl.principal(wallet1),
                Cl.uint(poolId)
            ],
            deployer
        );
        expect(result.result).toBeOk(Cl.bool(true));

        // Check pool is configured
        const poolConfig = simnet.callReadOnlyFn(
            CONTRACT,
            "get-pool-config",
            [],
            deployer
        );

        expect(poolConfig.result).toBeTuple({
            "xusdc-token": Cl.principal(deployer),
            "usdcx-token": Cl.principal(wallet1),
            "pool-id": Cl.uint(poolId),
            "configured": Cl.bool(true)
        });
    });

    it("swap-exact-tokens fails when pool not configured", () => {
        // Reset simnet to clear previous configuration
        const result = simnet.callPublicFn(
            CONTRACT,
            "swap-exact-tokens",
            [
                Cl.uint(1000000),
                Cl.uint(990000),
                Cl.principal(deployer),
                Cl.principal(wallet1)
            ],
            deployer
        );

        // Will fail because pool not configured in clean state
        // or because tokens don't match
        expect(result.result.type).toBe("err");
    });

    it("get-swap-quote returns correct amount after fee", () => {
        const amountIn = 1000000; // 1 USDC
        const expectedOut = 997000; // After 0.3% fee (997/1000)

        const quote = simnet.callReadOnlyFn(
            CONTRACT,
            "get-swap-quote",
            [
                Cl.uint(amountIn),
                Cl.principal(deployer),
                Cl.principal(wallet1)
            ],
            deployer
        );

        expect(quote.result).toBeOk(Cl.uint(expectedOut));
    });

    it("set-slippage-tolerance updates tolerance", () => {
        const result = simnet.callPublicFn(
            CONTRACT,
            "set-slippage-tolerance",
            [Cl.uint(100)], // 1% = 100 basis points
            deployer
        );
        expect(result.result).toBeOk(Cl.bool(true));

        const tolerance = simnet.callReadOnlyFn(
            CONTRACT,
            "get-slippage-tolerance",
            [],
            deployer
        );
        expect(tolerance.result).toBeUint(100);
    });

    it("set-paused toggles pause state", () => {
        const result = simnet.callPublicFn(
            CONTRACT,
            "set-paused",
            [Cl.bool(true)],
            deployer
        );
        expect(result.result).toBeOk(Cl.bool(true));

        const status = simnet.callReadOnlyFn(
            CONTRACT,
            "get-paused-status",
            [],
            deployer
        );
        expect(status.result).toBeBool(true);
    });

    it("get-expected-output calculates fee correctly", () => {
        const amountIn = 1000000;

        const output = simnet.callReadOnlyFn(
            CONTRACT,
            "get-expected-output",
            [Cl.uint(amountIn)],
            deployer
        );

        // 0.3% fee: 1000000 * 997 / 1000 = 997000
        expect(output.result).toBeUint(997000);
    });
});
