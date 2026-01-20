# Developer API and Flow Guide

This document describes the on-chain contract APIs and the relayer flow used to bridge USDC between Base (EVM) and Stacks.

## Overview

Bridging works in two directions:

- Base -> Stacks: user locks USDC on Base, relayer queues mint on Stacks.
- Stacks -> Base: user burns xUSDC on Stacks, relayer queues release on Base.

Multi-sig, rate limits, and timelocks are enforced on both sides.

## Contract APIs

### Base (EVM) - `BridgeBase`

Location: `evm/contracts/BridgeBase.sol`

Core functions:

- `lock(uint256 amount, string stacksAddress)`
  - Transfers USDC from the caller to the bridge.
  - Emits `Deposit(from, amount, stacksAddress, timestamp)`.
  - Validates minimum amount (10 USDC) and Stacks address format (starts with `S`).
- `queueRelease(address receiver, uint256 amount)` (signer only)
  - Creates a pending release with a timelock and auto-approval from the initiator.
  - Emits `ReleaseQueued` and `ReleaseApproved`.
- `approveRelease(uint256 releaseId)` (signer only)
  - Adds a signature for a pending release.
  - Emits `ReleaseApproved`.
- `executeRelease(uint256 releaseId)`
  - Executes a release after timelock and approvals.
  - Emits `ReleaseExecuted`.
- `cancelRelease(uint256 releaseId)` (signer only)
  - Cancels a pending release and refunds rate limits.
  - Emits `ReleaseCancelled`.

Admin functions:

- `addSigner(address newSigner)` (owner only)
- `removeSigner(address signer)` (owner only)
- `updateLimits(uint256 maxPerTx, uint256 hourlyLimit, uint256 dailyLimit)` (owner only)
- `pause()` (signer only)
- `unpause()` (owner only)
- `emergencyWithdraw(address to, uint256 amount)` (owner only)

View helpers:

- `getReleaseInfo(uint256 releaseId)`
- `getPendingDeposit(string stacksAddress)`
- `getRemainingLimits()`
- `getSigners()`
- `getSignerCount()`

Limits and timelocks (USDC has 6 decimals):

- Min deposit: 10 USDC
- Max per tx: 10,000 USDC
- Hourly limit: 50,000 USDC
- Daily limit: 200,000 USDC
- Timelock: <= 1,000 USDC instant, <= 10,000 USDC 10 minutes, > 10,000 USDC 1 hour

Events:

- `Deposit(address indexed from, uint256 amount, string stacksAddress, uint256 timestamp)`
- `ReleaseQueued(uint256 indexed releaseId, address indexed receiver, uint256 amount, uint256 executeAfter)`
- `ReleaseApproved(uint256 indexed releaseId, address indexed signer, uint256 approvalCount)`
- `ReleaseExecuted(uint256 indexed releaseId, address indexed receiver, uint256 amount)`
- `ReleaseCancelled(uint256 indexed releaseId)`

Common error cases:

- `NotSigner`, `InvalidAmount`, `AmountBelowMinimum`, `InvalidStacksAddress`
- `ExceedsMaxPerTx`, `ExceedsHourlyLimit`, `ExceedsDailyLimit`
- `InsufficientContractBalance`, `TimelockNotExpired`, `InsufficientApprovals`

### Stacks - `wrapped-usdc-v4`

Location: `stacks/contracts/wrapped-usdc-v4.clar`

Multi-sig minting:

- `queue-mint (recipient principal) (amount uint)`
  - Creates pending mint and prints `mint-queued`.
- `approve-mint (mint-id uint)`
  - Adds approval and prints `mint-approved`.
- `execute-mint (mint-id uint)`
  - Executes after timelock and approvals; prints `mint-executed`.
- `execute-mint-and-swap (mint-id uint) (min-usdcx-out uint)`
  - Executes mint to the contract and prints `mint-and-swap-requested`.
  - Swap is currently off-chain (DEX adapter integration is stubbed).

Burn (user-initiated):

- `burn (amount uint) (base-address (string-ascii 42))`
  - Burns xUSDC and prints `burn`.

Admin (owner or signer):

- `initialize-signers (signer1 principal) (signer2 principal) (signer3 principal)`
  - One-time setup; owner only.
- `add-signer (new-signer principal)` (owner only)
- `pause` (signer only)
- `unpause` (owner only)
- `set-dex-adapter (adapter principal)` (owner only)
- `set-auto-swap-enabled (enabled bool)` (owner only)
- `set-usdcx-contract (usdcx-address principal)` (owner only)

Read-only:

- `get-pending-mint (mint-id uint)`
- `has-approved-mint (mint-id uint) (signer principal)`
- `is-authorized-signer (address principal)`
- `get-rate-limits`
- `get-balance`, `get-total-supply`

Notes:

- `REQUIRED-SIGNATURES` is `u1` for testnet; change to `u2` for production.
- Timelocks and rate limits use `stacks-block-time`.

Printed event payloads:

- `mint-queued` / `mint-approved` / `mint-executed`
- `mint-and-swap-requested`
- `mint-via-xreserve-requested`
- `burn` (this is used by the relayer)

### Stacks - `velar-adapter`

Location: `stacks/contracts/velar-adapter.clar`

Mainnet Router: `SP1Y5YSTAHZ88XYK1VPDH24GY0HPX5J4JECTMY4A1.univ2-router`

Admin functions (owner only):

- `set-router-contract (router principal)` - Configure Velar router
- `configure-pool (xusdc principal) (usdcx principal) (pool-id uint)` - Set pool tokens
- `set-slippage-tolerance (bps uint)` - Set slippage in basis points (default 50 = 0.5%)
- `set-paused (paused bool)` - Emergency pause

Public functions:

- `swap-exact-tokens (amount-in uint) (min-out uint) (token-in principal) (token-out principal)`
  - Swaps xUSDC → USDCx via Velar pool
  - Returns amount-out on success

Read-only:

- `get-swap-quote (amount-in uint) (token-in principal) (token-out principal)`
- `get-pool-config` - Returns pool configuration tuple
- `get-expected-output (amount-in uint)` - Returns output after 0.3% fee
- `get-paused-status` - Returns pause state

### Stacks - `xreserve-adapter`

Location: `stacks/contracts/xreserve-adapter.clar`

> **Note**: Circle Bridge Kit SDK expected Q1 2026. Current implementation uses relayer-based attestation flow.

Admin functions (owner only):

- `configure-tokens (xusdc principal) (usdcx principal)` - Set token pair
- `set-service-id (service-id (string-ascii 64))` - Set xReserve service ID
- `set-paused (paused bool)` - Emergency pause
- `complete-swap (swap-id uint)` - Mark swap as completed (called by relayer)

Public functions:

- `swap-exact-tokens (amount-in uint) (min-out uint) (token-in principal) (token-out principal)`
  - Creates pending swap and emits `xreserve-swap-requested` event
  - Returns expected 1:1 amount

Read-only:

- `get-swap-quote (amount-in uint) (token-in principal) (token-out principal)` - Returns 1:1 rate
- `get-pending-swap (swap-id uint)` - Returns swap details
- `get-swap-nonce` - Returns next swap ID
- `get-paused-status` - Returns pause state

## Relayer APIs and Flow

Location: `relayer/src`

### Flow summary

Base -> Stacks:

1) `watchDeposits` listens for `Deposit` events on Base.
2) `queueMint` calls `queue-mint` on Stacks with the Stacks recipient and amount.
3) Additional signer instances run `approve-mint` and `execute-mint`.

Stacks -> Base:

1) `pollBurnEvents` reads Stacks contract events and looks for `burn`.
2) `queueRelease` calls `queueRelease` on Base for the EVM receiver and amount.
3) Additional signer instances run `approveRelease` and `executeRelease`.

### Base listener (`base-listener.js`)

Runtime functions used by the relayer:

- `initWalletClient()`: Initializes the EVM signer (uses `SIGNER_PRIVATE_KEY`).
- `watchDeposits(onDeposit)`: Subscribes to `Deposit` events.
- `queueRelease(receiver, amount)`: Calls `queueRelease` on `BridgeBase`.
- `approveRelease(releaseId)`
- `executeRelease(releaseId)`
- `getReleaseInfo(releaseId)`
- `checkIsSigner(address)`

Deposit callback shape:

```json
{
  "from": "0xSender",
  "amount": "10000000",
  "stacksAddress": "ST...",
  "timestamp": "1690000000",
  "txHash": "0x...",
  "blockNumber": "123456"
}
```

### Stacks handler (`stacks-handler.js`)

Runtime functions used by the relayer:

- `queueMint(recipient, amount)`
- `approveMint(mintId)`
- `executeMint(mintId)`
- `pollBurnEvents(onBurn, lastProcessedBlock)`
- `getPendingMint(mintId)` (read-only helper)

Burn callback shape:

```json
{
  "sender": "ST...",
  "amount": "1000000",
  "baseAddress": "0xReceiver",
  "txId": "0xStacksTx",
  "blockHeight": 12345
}
```

### Webhook server (optional)

Location: `relayer/src/webhook-server.js`

The webhook server accepts Chainhook events and queues releases:

- `POST /chainhook/burn`
- Auth header: `Authorization: Bearer <WEBHOOK_AUTH_TOKEN>`
- Body contains `apply` and/or `rollback` blocks from Chainhook.

Example request:

```json
{
  "apply": [
    {
      "transactions": [
        {
          "metadata": {
            "kind": { "type": "ContractCall" },
            "receipt": { "events": [] }
          }
        }
      ]
    }
  ]
}
```

## Relayer Configuration

Relayer environment variables (see `relayer/src/config.js`):

```env
NETWORK=testnet
BASE_RPC_URL=https://sepolia.base.org
BRIDGE_BASE_ADDRESS=0x...
SIGNER_PRIVATE_KEY=0x...
STACKS_API_URL=https://api.testnet.hiro.so
STACKS_CORE_API_URL=https://stacks-node-api.testnet.stacks.co
STACKS_CONTRACT_ADDRESS=ST...
STACKS_CONTRACT_NAME=wrapped-usdc-v4
STACKS_PRIVATE_KEY=...
```

Webhook server:

```env
WEBHOOK_PORT=3000
WEBHOOK_PORT_TRIES=5
WEBHOOK_AUTH_TOKEN=bridge-secret-token
```

## Examples

### Sample burn event logs

Stacks API `contract_log.value.repr` example (used by `pollBurnEvents`):

```text
(tuple (event "burn") (sender 'ST2J8EVYHPN9VQ9H0N9H4E1RJGQ2A0H9Z2WZ8B4S1) (amount u1000000) (base-address "0x1111111111111111111111111111111111111111"))
```

Chainhook event payload fragment (used by `webhook-server.js`):

```json
{
  "type": "SmartContractEvent",
  "data": {
    "value": {
      "type": "tuple",
      "value": {
        "event": { "type": "string_ascii", "value": "burn" },
        "sender": { "type": "principal", "value": "ST2J8EVYHPN9VQ9H0N9H4E1RJGQ2A0H9Z2WZ8B4S1" },
        "amount": { "type": "uint", "value": "1000000" },
        "base-address": { "type": "string_ascii", "value": "0x1111111111111111111111111111111111111111" }
      }
    }
  }
}
```

### Approve/execute scripts

These scripts read `NETWORK`, `STACKS_API_URL`, `STACKS_CORE_API_URL`, `STACKS_CONTRACT_ADDRESS`,
and `STACKS_CONTRACT_NAME` from `relayer/.env`.

Stacks mint approve + execute (ensure `relayer/.env` points at the target contract):

```bash
cd relayer
node scripts/approve-execute-mint.js 0
```

Stacks execute only after approvals (ensure `relayer/.env` points at the target contract):

```bash
cd relayer
node scripts/execute-only.js 0
```

Base release approve + execute (local Hardhat only):

```bash
cd evm
npx hardhat run scripts/approve-execute-latest.js --network localhost
```

## Operational Notes

- The relayer uses event deduping in-memory; restarts may reprocess older events.
- For local testing and step-by-step flows, see `docs/local-e2e.md`.
