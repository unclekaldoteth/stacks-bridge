# Roadmap

## Vision

Build a decentralized, cost-effective bridge between Base (Ethereum L2) and Stacks (Bitcoin L2) that allows users to transfer USDC at significantly lower costs than bridging via Ethereum L1.

## Phase 1: Core Infrastructure (Completed)

- [x] EVM bridge contract (Solidity) with multi-sig support
- [x] Stacks xUSDC SIP-010 token upgraded to Clarity 4 (`wrapped-usdc-v4`)
- [x] Relayer service for event watching + mint/release flows
- [x] Frontend with wallet connection (WalletConnect + MetaMask + Base Account)
- [x] Deposit flow: Base USDC -> Stacks xUSDC
- [x] Withdraw flow: Stacks xUSDC -> Base USDC

## Phase 2: Security Hardening (Completed)

- [x] Multi-signature validation (2-of-3 signers)
- [x] Rate limiting (hourly and daily caps) using `stacks-block-time`
- [x] Timelocked releases for large transactions
- [x] Emergency pause mechanism
- [x] Immutable on-chain audit trail

## Phase 3: Developer Tooling & Open Source (Current)

- [x] Repository documentation + contribution guidelines
- [x] Local E2E harness scripts + guide (`docs/local-e2e.md`)
- [x] Deployment scripts with network-specific USDC validation
- [x] Config management (mainnet/testnet auto-detect + `STACKS_CORE_API_URL`)
- [x] Stacks devnet support + signer initialization v4 script
- [x] Frontend wallet UX upgrades (OnchainKit + Base Account, wagmi v2)
- [x] Initial testing (EVM unit tests + Clarinet tests for `wrapped-usdc-v4`)
- [x] GitHub issue templates
- [x] Good first issues for contributors (templates)
- [x] API documentation (contracts + relayer flow)
- [x] Expanded developer guides (setup, runbook, troubleshooting, deployment)

## Phase 4: USDCx Integration ✅

> **Official USDCx Contract**: `SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE.usdcx` (Circle xReserve)

- [x] Configure official Circle USDCx contract address in all contracts
- [x] Update frontend with USDCx contract reference
- [x] DEX adapter trait + Velar adapter stub contract
- [x] `execute-mint-and-swap` flow + auto-swap toggles in `wrapped-usdc-v4`
- [x] Research: DEX liquidity pool creation for xUSDC/USDCx (No pool exists; Velar permissionless, Bitflow preferred for stable-swaps)
- [x] Integration: Velar on-chain swap calls + pool configuration (`velar-adapter.clar`)
- [x] Alternative: Direct Circle xReserve integration (`xreserve-adapter.clar` + relayer handler)
- [x] Documentation: Bridge to USDCx workflow (`docs/usdcx-workflow.md`)

## Phase 4.5: Testnet Deployment ✅

- [x] Base Sepolia: BridgeBase at `0xFCDF3e427e4a4CF3E573762693B9a1bBb35C504B`
- [x] Stacks Testnet: `wrapped-usdc-v5` deployed and signers initialized
- [x] Stacks Testnet: `xreserve-adapter` deployed
- [x] Relayer auto-reconnect for RPC filter expiration
- [x] Frontend simplified with native wagmi wallet connection
- [x] **Deposit E2E Verified**: Base → Stacks mint flow tested
- [x] **Withdraw E2E Verified**: Stacks → Base release flow tested
  - Burn TX: [`e19bb46b...`](https://explorer.hiro.so/txid/0xe19bb46b2a34dc87508e6049e43dba46a2907bdf5420f7e39e1b6015cce4117d?chain=testnet)
  - Execute Release TX: [`0x40320215...`](https://sepolia.basescan.org/tx/0x403202153897b662442c98728f8632b51dccb12233d0e63f63f4ff3a02c66384)
- [x] **Transaction History UI**: Component fetching from Blockscout API
- [x] **Functional Withdraw Button**: `burnTokens()` via `openContractCall`

## Phase 5: Decentralization

- [ ] Decentralized relayer network (multiple operators)
- [ ] Governance token for protocol decisions
- [ ] Fee sharing with relayer operators
- [ ] Staking mechanism for relayers

## Phase 6: Multi-Chain Expansion

- [ ] Arbitrum One support
- [ ] Optimism support
- [ ] Other EVM L2 chains
- [ ] Cross-chain routing optimization

## Phase 7: Mainnet Launch ✅ COMPLETE (January 30, 2026)

### Base Mainnet
- [x] Deploy BridgeBase contract
- [x] Verify on BaseScan (Etherscan V2 API)
- [x] **Contract:** [`0x0EdF28403D027Be0917625C751c78236407dD4E0`](https://basescan.org/address/0x0EdF28403D027Be0917625C751c78236407dD4E0#code)

### Stacks Mainnet  
- [x] Deploy wrapped-usdc-v5 and sip-010-trait
- [x] Initialize 3-of-3 signers
- [x] **Contract:** [`SP1MTYHV6K2FNH3QNF4P5QXS9VJ3XZ0GBB5T1SJPK.wrapped-usdc-v5`](https://explorer.hiro.so/txid/0x44c62212aa019260add71e59bea6bc0de16298efa19d730ff4d1c9645e785d0f?chain=mainnet)
- [x] **Signers TX:** [`0x82f87b95...`](https://explorer.hiro.so/txid/0x82f87b9599b7d04515af772c41b8d0b064e0156474f8257c1e8887960df0d7d3)
- [x] **Block Height:** 6202949

### Security Configuration
- [x] 2-of-3 multi-sig on both chains
- [x] Rate limits: 10K/tx, 50K/hr, 200K/day
- [x] Timelock for large transactions
- [x] Relayer configured and running

## Phase 7.5: Frontend Enhancements ✅ (January 2026)

### Real-Time Price Feeds
- [x] ETH/USD from Chainlink on Base mainnet (updates every block)
- [x] STX/USD from Coinbase API (5-minute cache)
- [x] `usePrices` hook with fallback values

### SSR-Safe Wallet Connection
- [x] `ConnectButton` component with hydration handling
- [x] `useSyncExternalStore` for React 18 compatibility
- [x] Lazy AppKit initialization via `openAppKitModal()`
- [x] `projectId` validation with user-friendly error state

### Network-Aware Components
- [x] `BridgeStats`: Dynamic Blockscout API (mainnet/testnet)
- [x] `TransactionHistory`: Auto-switches based on `NEXT_PUBLIC_NETWORK`
- [x] `FeeEstimator`: Live price badges showing data sources

---

## Phase 8: Future Improvements

- [ ] Security audit by reputable firm
- [ ] Bug bounty program
- [ ] Liquidity bootstrapping
- [ ] DEX pool creation for xUSDC/USDCx

---

## How to Contribute

See [CONTRIBUTING.md](./CONTRIBUTING.md) for details on how to help with any of these phases.
For contract APIs and relayer flow details, see [docs/developer-api.md](./docs/developer-api.md).

## Priority Areas

1. **Security Audit** - Third-party code review
2. **Liquidity** - DEX pool creation for better UX
3. **Decentralization** - Multiple relayer operators
4. **Documentation** - User guides and tutorials
