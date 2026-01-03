# Roadmap

## Vision

Build a decentralized, cost-effective bridge between Base (Ethereum L2) and Stacks (Bitcoin L2) that allows users to transfer USDC at significantly lower costs than bridging via Ethereum L1.

## Phase 1: Core Infrastructure (Completed)

- [x] EVM bridge contract (Solidity) with multi-sig support
- [x] Clarity 4 xUSDC SIP-010 token with timelock security
- [x] Basic relayer service for event watching
- [x] Frontend with wallet connection (WalletConnect + Metamask)
- [x] Deposit flow: Base USDC -> Stacks xUSDC

## Phase 2: Security Hardening (Completed)

- [x] Multi-signature validation (2-of-3 signers)
- [x] Rate limiting (hourly and daily caps)
- [x] Timelocked releases for large transactions
- [x] Emergency pause mechanism
- [x] Immutable on-chain audit trail

## Phase 3: Open Source Launch (Current)

- [x] Repository documentation
- [x] Contribution guidelines
- [ ] GitHub issue templates
- [ ] Good first issues for contributors
- [ ] Developer documentation
- [ ] API documentation

## Phase 4: USDCx Integration (In Progress)

> **Official USDCx Contract**: `SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE.usdcx` (Circle xReserve)

- [x] Configure official Circle USDCx contract address in all contracts
- [x] Update frontend with USDCx contract reference
- [ ] Research: DEX liquidity pool creation for xUSDC/USDCx
- [ ] Integration: Velar SDK for automatic swaps
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

## Priority Areas

1. **USDCx Integration** - Most impactful for user experience
2. **Testing** - Unit and integration tests for all components
3. **Documentation** - API docs, deployment guides
4. **Security** - Code review, vulnerability assessment
