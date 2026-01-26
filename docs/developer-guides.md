# Developer Guides

This guide complements `README.md` and `docs/developer-api.md`. It focuses on setup, runbook workflows, troubleshooting, and deployment checklists.

## Setup

### Prerequisites

- Node.js 18+
- Clarinet 3.11+ (for Stacks devnet or contract checks)
- Hardhat (for EVM scripts)
- Stacks wallet (Leather/Xverse) for testnet/mainnet
- MetaMask or Base Account for Base testnet/mainnet

### Repo install

```bash
npm install
```

Install package dependencies per workspace as needed:

```bash
cd evm && npm install
cd relayer && npm install
cd frontend && npm install
```

### Environment layout

- EVM deploy keys: `evm/.env`
- Relayer config: `relayer/.env`
- Frontend config: `frontend/.env.local`

See `evm/.env.example` and `relayer/.env.example` for required variables.

### Local Base (Hardhat) setup

```bash
cd evm
npx hardhat node
```

In another terminal:

```bash
cd evm
npm run deploy:local
```

This writes `evm/deployments.local.json` and prints the bridge + USDC addresses.

### Stacks devnet (optional)

```bash
cd stacks
clarinet devnet start --manifest-path Clarinet.toml \
  --deployment-plan-path deployments/default.devnet-plan.yaml \
  --use-on-disk-deployment-plan
```

Initialize signers after deployment:

```bash
cd relayer
node scripts/initialize-signers-v4.js
```

### Relayer config

Populate `relayer/.env`:

```env
NETWORK=testnet
BASE_RPC_URL=http://127.0.0.1:8545
BRIDGE_BASE_ADDRESS=<bridgeAddress from evm/deployments.local.json>
SIGNER_PRIVATE_KEY=<hardhat account #1 private key>

STACKS_API_URL=https://api.testnet.hiro.so
STACKS_CORE_API_URL=https://stacks-node-api.testnet.stacks.co
STACKS_CONTRACT_ADDRESS=<stacks principal>
STACKS_CONTRACT_NAME=wrapped-usdc-v5
STACKS_PRIVATE_KEY=<mnemonic or hex key>
```

Run the relayer:

```bash
cd relayer
npm start
```

Helper scripts under `relayer/scripts` also read `NETWORK`, `STACKS_API_URL`, `STACKS_CORE_API_URL`,
`STACKS_CONTRACT_ADDRESS`, and `STACKS_CONTRACT_NAME` from the same `.env`.

### Frontend config

Set environment variables in `frontend/.env.local`:

```env
NEXT_PUBLIC_NETWORK=testnet
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=...
NEXT_PUBLIC_BASE_RPC_URL=https://sepolia.base.org
```

Update addresses in `frontend/src/lib/config.ts` when deploying to new networks.

## Runbook

### Deposit (Base -> Stacks)

1) User calls `BridgeBase.lock(amount, stacksAddress)` on Base.
2) Relayer sees `Deposit` and calls `queue-mint` on Stacks.
3) Additional signer relayers call `approve-mint`.
4) After timelock, a relayer calls `execute-mint`.

Local smoke test:

```bash
cd evm
npm run lock:local
```

### Withdraw (Stacks -> Base)

1) User calls `burn(amount, base-address)` on Stacks.
2) Relayer detects `burn` and calls `queueRelease` on Base.
3) Additional signer relayers call `approveRelease`.
4) After timelock, a relayer calls `executeRelease`.

Local smoke test (burn without Stacks node):

```bash
cd relayer
npm run webhook
node scripts/simulate-burn-webhook.js
```

Approve + execute latest release on local Hardhat:

```bash
cd evm
npm run approve:latest
```

### Relayer operations (multi-sig)

Run 3 relayers with distinct `SIGNER_INDEX` values and keys:

```env
SIGNER_INDEX=1
SIGNER_PRIVATE_KEY=...
STACKS_PRIVATE_KEY=...
```

Repeat for `SIGNER_INDEX=2` and `SIGNER_INDEX=3` in separate processes.

## Troubleshooting

- `NotSigner` / `ERR-NOT-SIGNER`: Ensure `SIGNER_PRIVATE_KEY` matches a signer on the bridge contract. For local Hardhat, use account #1, not #0.
- `No contract code found`: `BRIDGE_BASE_ADDRESS` does not match the deployed bridge on the current RPC.
- `InvalidStacksAddress`: Stacks addresses must start with `S` and be 34-64 chars.
- `TimelockNotExpired` / `ERR-TIMELOCK-NOT-EXPIRED`: Wait for the delay or lower the amount for quicker tests.
- `ExceedsHourlyLimit` / `ExceedsDailyLimit`: Reduce amount or wait for the time window to reset.
- Stacks burns not detected: Check `STACKS_API_URL`/`STACKS_CORE_API_URL`, correct contract name, and network mode (`NETWORK`).
- Reprocessing after restart: Relayer deduping is in-memory; restarts may re-handle past events.

## Deployment Checklists

### Testnet checklist (Base Sepolia + Stacks Testnet)

EVM:

- [ ] Set `PRIVATE_KEY`, `SIGNER_1..3`, `USDC_ADDRESS` in `evm/.env`.
- [ ] Deploy with `cd evm && npm run deploy:testnet`.
- [ ] Record the bridge address for relayer + frontend config.

Stacks:

- [ ] Deploy `wrapped-usdc-v5` via Clarinet or your Stacks workflow.
- [ ] Run `node relayer/scripts/initialize-signers-v4.js` with owner key.
- [ ] Set `STACKS_CONTRACT_ADDRESS` and `STACKS_CONTRACT_NAME=wrapped-usdc-v5` in relayer.

Relayer:

- [ ] Configure `relayer/.env` for Base Sepolia + Stacks Testnet.
- [ ] Start 3 relayer instances (distinct `SIGNER_INDEX` + keys).
- [ ] Confirm signer authorization on Base contract.

Frontend:

- [ ] Update `frontend/src/lib/config.ts` with new Base + Stacks addresses.
- [ ] Set `NEXT_PUBLIC_NETWORK=testnet` and RPC URLs in `frontend/.env.local`.

### Mainnet checklist (Base + Stacks)

Contracts:

- [ ] Set `REQUIRED-SIGNATURES` to `u2` in `wrapped-usdc-v5.clar` and redeploy.
- [ ] Update `STACKS_CONTRACT_ADDRESS`, `STACKS_CONTRACT_NAME`, and Base bridge address everywhere.
- [ ] Configure USDCx contract + DEX adapter only after audited integrations.

Relayer:

- [ ] Set `NETWORK=mainnet` and mainnet RPC endpoints.
- [ ] Run 3 relayers with independent keys and separate hosts if possible.
- [ ] Monitor release volume against rate limits.

Frontend:

- [ ] Update addresses in `frontend/src/lib/config.ts`.
- [ ] Set `NEXT_PUBLIC_NETWORK=mainnet`.

Operations:

- [ ] Backup signer keys and rotate access.
- [ ] Enable alerting for relayer errors and failed executions.
- [ ] Confirm monitoring for Base and Stacks RPC/API outages.
