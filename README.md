# Stacks Bridge Base

A decentralized bridge for transferring USDC between Base (Ethereum L2) and Stacks (Bitcoin L2). Built with Clarity 4 smart contracts, Solidity, and a multi-signature relayer architecture.

Stacks Bridge Base enables seamless cross-chain USDC transfers, allowing users to bridge USDC from Base to receive xUSDC (wrapped USDC) on Stacks, and vice versa. Built for security-first with multi-signature validation, timelocked withdrawals, and rate limiting.

---

## Why Stacks Bridge Base?

Stacks currently lacks native USDC liquidity. Users who want to participate in the Stacks DeFi ecosystem must navigate complex bridging solutions with limited support.

This bridge solves that problem by providing:
- Direct USDC bridging from Base to Stacks
- SIP-010 compliant xUSDC token on Stacks
- Integration with Velar DEX for xUSDC to USDCx swaps
- Multi-signature security with timelocked transactions

---

## Key Features

### For Users
- Simple one-click bridging interface
- Real-time transaction tracking
- Sub-10 minute transfer times
- Low fees (network gas only)
- Full transparency via on-chain verification

### For Security
- Multi-signature validation (2-of-3 signers required)
- Timelocked releases for large transactions
- Rate limiting (hourly and daily caps)
- Pausable contracts for emergency response
- Immutable on-chain audit trail

### For Developers
- Open-source smart contracts (Solidity + Clarity 4)
- Modular relayer architecture
- REST API for integration
- Event-driven webhook support via Hiro Chainhooks

---

## Architecture Overview

### Smart Contracts (Clarity 4)

- **wrapped-usdc.clar**
  SIP-010 compliant xUSDC token with multi-signature mint/burn and timelock security.

- **wrapped-usdc-v4.clar**
  Enhanced version with Clarity 4 features including `stacks-block-time` for time-based timelocks.

- **dex-adapter-trait.clar**
  Generic DEX integration interface for modular swap support.

- **velar-adapter.clar**
  Velar DEX adapter for xUSDC to USDCx swaps.

```
stacks-bridge-base/
├── evm/                          # Solidity contracts for Base
│   ├── contracts/
│   │   └── BridgeBase.sol
│   └── hardhat.config.js
├── stacks/                       # Clarity contracts for Stacks
│   ├── contracts/
│   │   ├── wrapped-usdc.clar         # Main xUSDC token
│   │   ├── wrapped-usdc-v2.clar      # V2 iteration
│   │   ├── wrapped-usdc-v3.clar      # V3 iteration
│   │   ├── wrapped-usdc-v4.clar      # Clarity 4 with time-based timelocks
│   │   ├── sip-010-trait-ft-standard.clar
│   │   ├── dex-adapter-trait.clar
│   │   └── velar-adapter.clar
│   ├── settings/
│   │   └── Devnet.toml
│   └── Clarinet.toml
├── relayer/                      # Node.js relayer service
│   └── src/
│       ├── index.js
│       ├── config.js
│       ├── base-listener.js
│       └── stacks-handler.js
└── frontend/                     # Next.js web interface
    └── src/
        ├── app/
        └── components/
```

### Relayer Service

- Node.js-based event listener and transaction submitter
- Watches Base for Deposit events
- Queues mints on Stacks with multi-sig validation
- Handles approval flow and execution

---

## Deployed Contracts

### Testnet Deployment

| Network | Contract | Address |
|---------|----------|---------|
| Base Sepolia | BridgeBase | `0x06c6Fd0afa92062FE76DE72DA5EC7a63Ba01F6FC` |
| Stacks Testnet | wrapped-usdc | `ST1ZGGS886YCZHMFXJR1EK61ZP34FNWNSX28M1PMM.wrapped-usdc` |
| Stacks Testnet | wrapped-usdc-v2 | `ST1ZGGS886YCZHMFXJR1EK61ZP34FNWNSX28M1PMM.wrapped-usdc-v2` |

### Deployment Details

- **Clarity Version:** 4
- **Epoch:** 3.3
- **Clarinet Version:** 3.11.0

---

## Smart Contract Functions

### wrapped-usdc

| Function | Description |
|----------|-------------|
| `queue-mint` | Queue a mint with timelock (signer only) |
| `approve-mint` | Approve a pending mint (signer only) |
| `execute-mint` | Execute approved mint after timelock |
| `burn` | Burn xUSDC to withdraw on Base |
| `transfer` | Standard SIP-010 transfer |

### Admin Functions

| Function | Description |
|----------|-------------|
| `initialize-signers` | Set up multi-sig signers (owner only) |
| `pause` | Emergency pause (any signer) |
| `unpause` | Resume operations (owner only) |
| `set-dex-adapter` | Configure DEX for swaps |
| `set-auto-swap-enabled` | Toggle auto-swap feature |

---

## Quick Start

### Prerequisites

- Node.js 18+
- Clarinet 3.11+
- Hardhat (for EVM deployment)
- Stacks wallet (Leather or Xverse)

### Smart Contracts

```bash
cd stacks

# Check contracts
clarinet check

# Run devnet
clarinet devnet start
```

### Relayer

```bash
cd relayer
npm install
npm start
```

### Frontend

```bash
cd frontend
npm install
npm run dev
# Opens at http://localhost:3000
```

---

## Security Model

### Multi-Signature Validation

All cross-chain operations require approval from 2-of-3 authorized signers before execution.

### Timelocked Withdrawals

Large transactions have enforced delays:
- Under 1,000 USDC: Instant
- 1,000 - 10,000 USDC: 10 minute delay
- Over 10,000 USDC: 1 hour delay

### Rate Limiting

- Hourly limit: 50,000 USDC
- Daily limit: 200,000 USDC
- Per-transaction max: 10,000 USDC

### Emergency Controls

- Contract can be paused by any signer
- Unpause requires contract owner
- All pending operations can be cancelled

---

## Environment Variables

### Relayer (.env)

```
BASE_RPC_URL=https://sepolia.base.org
BASE_PRIVATE_KEY=your_private_key
STACKS_API_URL=https://api.testnet.hiro.so
STACKS_PRIVATE_KEY=your_stacks_private_key
CONTRACT_ADDRESS=ST1ZGGS886YCZHMFXJR1EK61ZP34FNWNSX28M1PMM
CONTRACT_NAME=wrapped-usdc-v4
```

---

## Tech Stack

### Smart Contracts

- Clarity 4
- Stacks Blockchain
- Epoch 3.3
- Clarinet 3.11.0

### EVM Contracts

- Solidity
- Hardhat
- OpenZeppelin

### Relayer

- Node.js
- Viem
- @stacks/transactions
- Hiro Chainhooks

### Frontend

- Next.js
- React
- TypeScript
- @stacks/connect
- WalletConnect
- Wagmi

---

## Roadmap

### Phase 1 - Core Infrastructure (Completed)

- EVM bridge contract with multi-sig
- Clarity xUSDC SIP-010 token
- Basic relayer with event watching
- Frontend deposit interface

### Phase 2 - Security Hardening (Completed)

- Timelocked releases
- Rate limiting
- Multi-signature validation
- Emergency pause mechanism

### Phase 3 - Clarity 4 Upgrade (Completed)

- Upgraded all contracts to Clarity 4
- Added epoch 3.3 support
- Implemented `stacks-block-height` and `current-contract`
- Time-based timelocks with `stacks-block-time`

### Phase 4 - USDCx Integration (In Progress)

- DEX adapter trait for modular swaps
- Velar DEX integration
- Auto-swap xUSDC to native USDCx

### Phase 5 - Production Launch

- Mainnet deployment
- Security audit
- Decentralized relayer network

---

## Contributing

We welcome contributions from the community! This project aims to provide cheaper USDC bridging by using Base L2 instead of Ethereum L1.

### Quick Links

- [CONTRIBUTING.md](./CONTRIBUTING.md) - Contribution guidelines
- [ROADMAP.md](./ROADMAP.md) - Project roadmap and priorities
- [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) - Community standards

### Good First Issues

- Add unit tests for Clarity contracts
- Improve error handling in relayer
- Add transaction history UI component
- Document API endpoints

### Priority Contributions Needed

1. **USDCx Integration** - Help integrate with official Stacks USDCx via DEX swap
2. **Testing** - Unit and integration tests for all components
3. **Security** - Code review and vulnerability assessment

For major changes, please open an issue first to discuss the proposed change.

---

## License

MIT License - see LICENSE file for details.

---

## Acknowledgments

- Hiro Systems for Stacks development tools
- Base team for the scalable L2
- OpenZeppelin for secure Solidity libraries
- The Stacks community for feedback and support
