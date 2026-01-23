/// <reference types="vitest" />

// Type declarations for Clarinet SDK globals
declare global {
    // Simnet global provided by vitest-environment-clarinet
    const simnet: {
        getAccounts(): Map<string, string>;
        callPublicFn(
            contract: string,
            fn: string,
            args: import("@stacks/transactions").ClarityValue[],
            sender: string
        ): { result: import("@stacks/transactions").ClarityValue };
        callReadOnlyFn(
            contract: string,
            fn: string,
            args: import("@stacks/transactions").ClarityValue[],
            sender: string
        ): { result: import("@stacks/transactions").ClarityValue };
    };

    // Reports collected by vitest setup
    const coverageReports: unknown[];
    const costsReports: unknown[];
}

// Extend Vitest matchers with Clarity-specific matchers
declare module "vitest" {
    interface Assertion<T> {
        toBeOk(expected: import("@stacks/transactions").ClarityValue): void;
        toBeErr(expected: import("@stacks/transactions").ClarityValue): void;
        toBeUint(expected: number | bigint): void;
        toBeBool(expected: boolean): void;
        toBeAscii(expected: string): void;
        toBeTuple(expected: Record<string, import("@stacks/transactions").ClarityValue>): void;
        toBeList(expected: import("@stacks/transactions").ClarityValue[]): void;
        toBePrincipal(expected: string): void;
    }
}

export { };
