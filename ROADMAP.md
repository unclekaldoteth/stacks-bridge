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

## Phase 4: USDCx Integration (In Progress)

> **Official USDCx Contract**: `SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE.usdcx` (Circle xReserve)

- [x] Configure official Circle USDCx contract address in all contracts
- [x] Update frontend with USDCx contract reference
- [x] DEX adapter trait + Velar adapter stub contract
- [x] `execute-mint-and-swap` flow + auto-swap toggles in `wrapped-usdc-v4`
- [ ] Research: DEX liquidity pool creation for xUSDC/USDCx
- [ ] Integration: Velar on-chain swap calls + pool configuration
- [ ] Alternative: Direct Circle xReserve integration
- [ ] Documentation: Bridge to official USDCx workflow

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

## Phase 7: Production Launch

- [ ] Security audit by reputable firm
- [ ] Bug bounty program
- [ ] Mainnet deployment
- [ ] Liquidity bootstrapping

---

## How to Contribute

See [CONTRIBUTING.md](./CONTRIBUTING.md) for details on how to help with any of these phases.
For contract APIs and relayer flow details, see [docs/developer-api.md](./docs/developer-api.md).

## Priority Areas

1. **USDCx Integration** - Most impactful for user experience
2. **Testing** - Expand unit/integration tests + local E2E coverage
3. **Documentation** - API docs, deployment guides
4. **Security** - Code review, vulnerability assessment
