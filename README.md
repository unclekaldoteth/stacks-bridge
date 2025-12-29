# Stacks Bridge Base

An open-source infrastructure for bridging USDC between Base (Ethereum L2) and Stacks (Bitcoin L2). **80% cheaper than bridging via Ethereum L1.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Contributions Welcome](https://img.shields.io/badge/contributions-welcome-brightgreen.svg)](./CONTRIBUTING.md)

## The Problem

Bridging assets to Stacks currently requires going through Ethereum L1, which is expensive. Users pay high gas fees just to move USDC into the Stacks DeFi ecosystem.

## Our Solution

Use **Base L2** as the source chain instead of Ethereum L1. Base offers:
- 80% lower gas fees than Ethereum mainnet
- Fast finality (~2 seconds)
- Strong security inherited from Ethereum

```
┌─────────────┐                    ┌─────────────┐
│    Base     │  ──── Bridge ────> │   Stacks    │
│  (ETH L2)   │                    │  (BTC L2)   │
└─────────────┘                    └─────────────┘
     USDC            Relayer            xUSDC
```

## Project Status

| Phase | Status | Description |
|-------|--------|------------|
| Core Infrastructure | Completed | Smart contracts, relayer, frontend |
| Security Hardening | Completed | Multi-sig, timelocks, rate limiting |
| Clarity 4 Upgrade | Completed | Latest Stacks features |
| USDCx Integration | Help Wanted | Swap xUSDC to official USDCx |
| Production Launch | Planned | Mainnet deployment |

See [ROADMAP.md](./ROADMAP.md) for full details.

---

## Quick Start

### Prerequisites

- Node.js 18+
- [Clarinet](https://github.com/hirosystems/clarinet) 3.11+
- Stacks wallet (Leather or Xverse)
- MetaMask (for Base)

### 1. Clone and Setup

```bash
git clone https://github.com/unclekaldoteth/stacks-bridge.git
cd stacks-bridge
```

### 2. Run Smart Contracts (Stacks)

```bash
cd stacks
clarinet check          # Verify contracts compile
clarinet devnet start   # Start local devnet
```

### 3. Run Relayer

```bash
cd relayer
npm install
cp .env.example .env    # Configure your keys
npm start
```

### 4. Run Frontend

```bash
cd frontend
npm install
npm run dev             # Opens at http://localhost:3000
```

---

## Architecture

### Components

| Component | Technology | Description |
|-----------|------------|-------------|
| **EVM Contracts** | Solidity, Hardhat | Lock/release USDC on Base |
| **Stacks Contracts** | Clarity 4 | Mint/burn xUSDC on Stacks |
| **Relayer** | Node.js | Watch events, execute cross-chain txs |
| **Frontend** | Next.js, WalletConnect | User interface |

### Smart Contracts

```
stacks/contracts/
├── wrapped-usdc-v3.clar      # Main xUSDC token (SIP-010)
├── dex-adapter-trait.clar    # DEX integration interface
├── velar-adapter.clar        # Velar DEX adapter (stub)
└── sip-010-trait-ft-standard.clar

evm/contracts/
└── BridgeBase.sol            # USDC lock/release on Base
```

### Security Features

- **Multi-Signature**: 2-of-3 signers required for minting
- **Timelocks**: Large transactions have enforced delays
- **Rate Limiting**: Hourly (50K) and daily (200K) caps
- **Emergency Pause**: Any signer can pause, owner unpause

---

## Deployed Contracts (Testnet)

| Network | Contract | Address |
|---------|----------|---------|
| Base Sepolia | BridgeBase | `0x06c6Fd0afa92062FE76DE72DA5EC7a63Ba01F6FC` |
| Stacks Testnet | wrapped-usdc-v3 | `ST1ZGGS886YCZHMFXJR1EK61ZP34FNWNSX28M1PMM.wrapped-usdc-v3` |

---

## Contributing

We need community help! This project is open source and welcomes contributions.

### Priority Areas

| Area | Description | Difficulty |
|------|-------------|------------|
| **USDCx Integration** | Swap xUSDC to official Stacks USDCx | Hard |
| **Testing** | Unit tests for Clarity & Solidity | Medium |
| **Documentation** | API docs, deployment guides | Easy |
| **Security Review** | Code audit, vulnerability assessment | Medium |

### Good First Issues

- Add unit tests for Clarity contracts
- Improve error handling in relayer
- Add transaction history UI component
- Document API endpoints

### Quick Links

- [CONTRIBUTING.md](./CONTRIBUTING.md) - How to contribute
- [ROADMAP.md](./ROADMAP.md) - Project phases and priorities
- [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) - Community standards

---

## Tech Stack

| Layer | Technologies |
|-------|--------------|
| **Stacks** | Clarity 4, Epoch 3.3, Clarinet 3.11 |
| **EVM** | Solidity, Hardhat, OpenZeppelin |
| **Relayer** | Node.js, Viem, @stacks/transactions |
| **Frontend** | Next.js, TypeScript, WalletConnect, Wagmi |

---

## Environment Variables

### Relayer (.env)

```env
# Base (EVM)
BASE_RPC_URL=https://sepolia.base.org
SIGNER_PRIVATE_KEY=your_evm_private_key
BRIDGE_BASE_ADDRESS=0x06c6Fd0afa92062FE76DE72DA5EC7a63Ba01F6FC

# Stacks
STACKS_API_URL=https://api.testnet.hiro.so
STACKS_PRIVATE_KEY=your_stacks_mnemonic_or_key
STACKS_CONTRACT_ADDRESS=ST1ZGGS886YCZHMFXJR1EK61ZP34FNWNSX28M1PMM
STACKS_CONTRACT_NAME=wrapped-usdc-v3
```

### Frontend (.env.local)

```env
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_walletconnect_id
NEXT_PUBLIC_NETWORK=testnet
```

---

## License

MIT License - see [LICENSE](./LICENSE) for details.

---

## Acknowledgments

- [Hiro Systems](https://hiro.so/) - Stacks development tools
- [Base](https://base.org/) - Scalable L2
- [OpenZeppelin](https://openzeppelin.com/) - Secure Solidity libraries
- [Stacks Community](https://stacks.co/) - Feedback and support

---

**Built for the Stacks ecosystem. Contribute and help us make cross-chain bridging accessible to everyone.**
