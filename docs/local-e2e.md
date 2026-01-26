# Local Bridge E2E (no mainnet)

This is a local, non-mainnet smoke test harness for the Base <-> Stacks bridge.
For contract and relayer APIs, see `docs/developer-api.md`.

## Progress Snapshot (resume here)

Last known blockers and fixes:
- `queueRelease` reverted with `0xa1b035c8` (NotSigner). Fix by using a relayer private key that matches one of the local bridge signers.
- `BRIDGE_BASE_ADDRESS` must be the local Hardhat deployment from `evm/deployments.local.json`, not the Base Sepolia address.
- `queueRelease` requires the bridge to hold USDC. Run `npm run lock:local` after deploying.
- Webhook simulator must hit the correct port and use a valid EVM `BASE_ADDRESS`.
- Clarinet devnet requires Docker Desktop and a valid on-disk deployment plan.

Quick resume checklist:
1) Start Hardhat node and redeploy local contracts if the node restarted.
2) Update `relayer/.env` with local `BRIDGE_BASE_ADDRESS` and a signer private key from `evm/deployments.local.json`.
3) Run `npm run lock:local` to fund the bridge.
4) Start the webhook server and post a burn event with a valid `BASE_ADDRESS`.
5) Run `npm run approve:latest` to approve and execute the queued release.

## Prereqs

- Node.js 18+
- Clarinet (for local Stacks devnet, optional for the webhook-only flow)

## 1) Start local Base (Hardhat)

In terminal A:

```bash
cd evm
npm install
npx hardhat node
```

If you need a different local chain ID, set `HARDHAT_CHAIN_ID` (e.g. `HARDHAT_CHAIN_ID=31337 npx hardhat node`).

## 2) Deploy local contracts

In terminal B:

```bash
cd evm
npm run deploy:local
```

This writes `evm/deployments.local.json` with the Bridge + MockUSDC addresses.

## 3) Configure the relayer (local)

Create `relayer/.env` (or export env vars) with at least:

```env
NETWORK=testnet
BASE_RPC_URL=http://127.0.0.1:8545
BRIDGE_BASE_ADDRESS=<bridgeAddress from evm/deployments.local.json>
SIGNER_PRIVATE_KEY=<private key for one of the local bridge signers>

# Only required if you want the Base -> Stacks path to actually mint
STACKS_API_URL=<your Stacks API URL>
STACKS_CORE_API_URL=<your Stacks node (core) URL>
STACKS_CONTRACT_ADDRESS=<Stacks contract principal>
STACKS_CONTRACT_NAME=wrapped-usdc-v5
STACKS_PRIVATE_KEY=<Stacks mnemonic or private key>
```

## 4) Base -> Stacks (deposit flow)

In terminal C (relayer main loop):

```bash
cd relayer
npm install
npm run start
```

In terminal D (simulate a deposit):

```bash
cd evm
npm run lock:local
```

If you are not running a Stacks node, the relayer will log the deposit and fail to queue the mint (expected).
If you are running devnet, pass a devnet Stacks address:

```bash
STACKS_ADDRESS=<devnet STC address> npm run lock:local
```

## 5) Stacks -> Base (burn flow) without a Stacks node

In terminal E (webhook server):

```bash
cd relayer
npm run webhook
```

If port 3000 is in use, set a different port (the server will also auto-increment):

```bash
WEBHOOK_PORT=3001 npm run webhook
```

Note: `SIGNER_PRIVATE_KEY` must be **account #1** from the Hardhat node output (account #0 is not a signer in `deploy-local`).
If you restart the Hardhat node, rerun `npm run deploy:local` and update `BRIDGE_BASE_ADDRESS`.

If the webhook starts but throws `No contract code found`, update `BRIDGE_BASE_ADDRESS` to the current local deployment.
If `queueRelease` reverts with `0xa1b035c8`, the relayer signer is not one of the bridge signers.

In terminal F (simulate a burn event):

```bash
cd relayer
node scripts/simulate-burn-webhook.js
```

The simulator needs a valid EVM receiver address. It will use `BASE_ADDRESS` if set,
or fall back to the `fundedUser` from `evm/deployments.local.json`.

```bash
BASE_ADDRESS=<any local hardhat account> node scripts/simulate-burn-webhook.js
```

This queues a release on Base using the relayer signer. To approve/execute the latest release:

```bash
cd evm
npm run approve:latest
```

## Optional: Full local Stacks devnet

If you want Base -> Stacks to fully mint locally, start a Stacks devnet and deploy the contract:

```bash
cd stacks
clarinet devnet start --manifest-path Clarinet.toml --deployment-plan-path deployments/default.devnet-plan.yaml --use-on-disk-deployment-plan
```

Then deploy `wrapped-usdc-v5` using your Clarinet workflow (Clarinet.toml already includes the contract).
Point `STACKS_API_URL` to the devnet API port and use the devnet account keys in `relayer/.env`.
Also set `STACKS_CORE_API_URL` to the devnet node port (default `http://localhost:20443`).

Initialize signers on devnet (owner-only) before queueing mints:

```bash
cd relayer
node scripts/initialize-signers-v4.js
```

If you see a snapshot compatibility prompt, answer `y` or pass `--from-genesis`.
If Clarinet shows `ontracts/...` in a computed plan, keep the on-disk plan (do not overwrite).
