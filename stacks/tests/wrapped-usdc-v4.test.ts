import { Clarinet, Tx, Chain, Account, types } from "@hirosystems/clarinet-sdk";

const CONTRACT = "wrapped-usdc-v4";

const ERR = {
    NOT_AUTHORIZED: 401,
    INVALID_AMOUNT: 403,
    NOT_SIGNER: 405,
    EXCEEDS_MAX_TX: 406,
    ALREADY_APPROVED: 409,
};

function getAccounts(accounts: Map<string, Account>) {
    return {
        deployer: accounts.get("deployer")!,
        signer1: accounts.get("wallet_1")!,
        signer2: accounts.get("wallet_2")!,
        signer3: accounts.get("relayer")!,
    };
}

function initializeSigners(chain: Chain, accounts: Map<string, Account>) {
    const { deployer, signer1, signer2, signer3 } = getAccounts(accounts);

    const block = chain.mineBlock([
        Tx.contractCall(
            CONTRACT,
            "initialize-signers",
            [
                types.principal(signer1.address),
                types.principal(signer2.address),
                types.principal(signer3.address),
            ],
            deployer.address
        ),
    ]);

    block.receipts[0].result.expectOk().expectBool(true);
}

Clarinet.test({
    name: "initialize-signers can only run once",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const { deployer, signer1, signer2, signer3 } = getAccounts(accounts);

        let block = chain.mineBlock([
            Tx.contractCall(
                CONTRACT,
                "initialize-signers",
                [
                    types.principal(signer1.address),
                    types.principal(signer2.address),
                    types.principal(signer3.address),
                ],
                deployer.address
            ),
        ]);

        block.receipts[0].result.expectOk().expectBool(true);

        block = chain.mineBlock([
            Tx.contractCall(
                CONTRACT,
                "initialize-signers",
                [
                    types.principal(signer1.address),
                    types.principal(signer2.address),
                    types.principal(signer3.address),
                ],
                deployer.address
            ),
        ]);

        block.receipts[0].result.expectErr().expectUint(ERR.NOT_AUTHORIZED);
    },
});

Clarinet.test({
    name: "queue-mint rejects non-signers",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const { signer1 } = getAccounts(accounts);

        const block = chain.mineBlock([
            Tx.contractCall(
                CONTRACT,
                "queue-mint",
                [types.principal(signer1.address), types.uint(1_000_000)],
                signer1.address
            ),
        ]);

        block.receipts[0].result.expectErr().expectUint(ERR.NOT_SIGNER);
    },
});

Clarinet.test({
    name: "queue-mint enforces max-per-tx",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        initializeSigners(chain, accounts);
        const { signer1 } = getAccounts(accounts);

        const block = chain.mineBlock([
            Tx.contractCall(
                CONTRACT,
                "queue-mint",
                [types.principal(signer1.address), types.uint(10_000_000_001)],
                signer1.address
            ),
        ]);

        block.receipts[0].result.expectErr().expectUint(ERR.EXCEEDS_MAX_TX);
    },
});

Clarinet.test({
    name: "queue + approve + execute mints and burn reduces balance",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        initializeSigners(chain, accounts);
        const { signer1, signer2 } = getAccounts(accounts);

        const amount = 1_000_000n;

        let block = chain.mineBlock([
            Tx.contractCall(
                CONTRACT,
                "queue-mint",
                [types.principal(signer1.address), types.uint(amount)],
                signer1.address
            ),
        ]);

        block.receipts[0].result.expectOk().expectUint(0);

        block = chain.mineBlock([
            Tx.contractCall(CONTRACT, "approve-mint", [types.uint(0)], signer2.address),
        ]);
        block.receipts[0].result.expectOk().expectBool(true);

        block = chain.mineBlock([
            Tx.contractCall(CONTRACT, "execute-mint", [types.uint(0)], signer1.address),
        ]);
        block.receipts[0].result.expectOk().expectBool(true);

        const balance = chain.callReadOnlyFn(
            CONTRACT,
            "get-balance",
            [types.principal(signer1.address)],
            signer1.address
        );
        balance.result.expectOk().expectUint(amount);

        block = chain.mineBlock([
            Tx.contractCall(
                CONTRACT,
                "burn",
                [types.uint(500_000), types.ascii("0x0000000000000000000000000000000000000000")],
                signer1.address
            ),
        ]);
        block.receipts[0].result.expectOk().expectBool(true);

        const finalBalance = chain.callReadOnlyFn(
            CONTRACT,
            "get-balance",
            [types.principal(signer1.address)],
            signer1.address
        );
        finalBalance.result.expectOk().expectUint(500_000n);
    },
});

Clarinet.test({
    name: "approve-mint rejects duplicate approvals",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        initializeSigners(chain, accounts);
        const { signer1 } = getAccounts(accounts);

        let block = chain.mineBlock([
            Tx.contractCall(
                CONTRACT,
                "queue-mint",
                [types.principal(signer1.address), types.uint(1_000_000)],
                signer1.address
            ),
        ]);

        block.receipts[0].result.expectOk().expectUint(0);

        block = chain.mineBlock([
            Tx.contractCall(CONTRACT, "approve-mint", [types.uint(0)], signer1.address),
        ]);
        block.receipts[0].result.expectErr().expectUint(ERR.ALREADY_APPROVED);
    },
});

Clarinet.test({
    name: "burn rejects zero amount",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        initializeSigners(chain, accounts);
        const { signer1 } = getAccounts(accounts);

        const block = chain.mineBlock([
            Tx.contractCall(
                CONTRACT,
                "burn",
                [types.uint(0), types.ascii("0x0000000000000000000000000000000000000000")],
                signer1.address
            ),
        ]);

        block.receipts[0].result.expectErr().expectUint(ERR.INVALID_AMOUNT);
    },
});
