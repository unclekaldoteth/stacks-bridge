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
+---------------+                      +---------------+
|     Base      | <-- Bidirectional -> |    Stacks     |
|   (ETH L2)    |        Bridge        |   (BTC L2)    |
+---------------+                      +---------------+
      USDC             Relayer               xUSDC

  Deposit:  Lock USDC on Base  ->  Mint xUSDC on Stacks
  Withdraw: Burn xUSDC on Stacks  ->  Release USDC on Base
```

## Project Status

| Phase | Status | Description |
|-------|--------|------------|
| Core Infrastructure | Completed | Smart contracts, relayer, frontend |
| Security Hardening | Completed | Multi-sig, timelocks, rate limiting |
| Clarity 4 Upgrade | Completed | Latest Stacks features |
| USDCx Contract Config | Completed | Official Circle USDCx address configured |
| Deployment Scripts | Completed | Network-specific USDC validation |
| Config Management | Completed | Mainnet/testnet auto-detection |
| Rate Limiting Fix | Completed | Stacks-block-time implementation |
| USDCx DEX Integration | Completed | Velar adapter + xReserve alternative |
| Testnet Deployment | Completed | Base Sepolia + Stacks Testnet live |
| **Deposit E2E Test** | **Verified** | Base → Stacks mint flow tested |
| **Withdraw E2E Test** | **Verified** | Stacks → Base release flow tested |
| **Frontend Withdraw UI** | **Completed** | Functional burn & withdraw button |
| Production Launch | Ready | Pending mainnet pool creation |

See [ROADMAP.md](./ROADMAP.md) for full details.

## Testnet Deployment

| Network | Contract | Address |
|---------|----------|--------|
| Base Sepolia | **BridgeBase (v2)** | `0xFCDF3e427e4a4CF3E573762693B9a1bBb35C504B` |
| Base Sepolia | USDC (Circle) | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |
| Stacks Testnet | **wrapped-usdc-v5** | `ST1ZGGS886YCZHMFXJR1EK61ZP34FNWNSX28M1PMM.wrapped-usdc-v5` |
| Stacks Testnet | xreserve-adapter | `ST1ZGGS886YCZHMFXJR1EK61ZP34FNWNSX28M1PMM.xreserve-adapter` |
| Stacks Testnet | velar-adapter | `ST1ZGGS886YCZHMFXJR1EK61ZP34FNWNSX28M1PMM.velar-adapter` |

## Recent Updates

### Latest Improvements (January 2026)

**✅ Withdraw E2E Flow Verified**
- Full withdraw flow tested on testnet: burn xUSDC → queue release → execute release
- Transaction Evidence:
  - Burn TX (Stacks): [`e19bb46b...`](https://explorer.hiro.so/txid/0xe19bb46b2a34dc87508e6049e43dba46a2907bdf5420f7e39e1b6015cce4117d?chain=testnet)
  - Queue Release TX (Base): [`0xdbbfc3ce...`](https://sepolia.basescan.org/tx/0xdbbfc3cedb51b3ae0c9e381e9ee4242bd8e49e912a7c524882f20d691b544025)
  - Execute Release TX (Base): [`0x40320215...`](https://sepolia.basescan.org/tx/0x403202153897b662442c98728f8632b51dccb12233d0e63f63f4ff3a02c66384)

**✅ New Frontend Features**
- **Transaction History UI**: Displays bridge transactions fetched from Blockscout API
- **Functional Withdraw Button**: "Burn & Withdraw" button now calls Stacks contract via `openContractCall`
- Input validation with user-friendly error messages
- Explorer links for all transaction types

**End-to-End Testnet Verification Complete**
- Full deposit → queue-mint → execute-mint flow tested and working!
- Base Sepolia: 10 USDC deposited and locked
- Stacks Testnet: 10 xUSDC minted successfully on `wrapped-usdc-v5`
- Fixed signer initialization address derivation bug

**Testnet Deployment**
- Base Sepolia: Bridge deployed at `0xFCDF3e427e4a4CF3E573762693B9a1bBb35C504B`
- Stacks Testnet: `wrapped-usdc-v5` deployed and initialized
- Relayer configured for testnet with auto-reconnect for RPC filter expiration
- Frontend running with wagmi v2 wallet connection

**Phase 4: USDCx Integration Complete**
- Velar DEX adapter (`velar-adapter.clar`) with mainnet router integration
- Circle xReserve alternative (`xreserve-adapter.clar`) for 1:1 attestation swaps
- Dual execution paths: `execute-mint-and-swap` (DEX) or `execute-mint-via-xreserve`
- Relayer xReserve handler for attestation processing
- Full documentation: [docs/usdcx-workflow.md](./docs/usdcx-workflow.md)

**OnchainKit and Base Account Integration**
- Downgraded React to 18.2 and wagmi to v2 for stability
- Pinned viem to 2.17.3 for wagmi v2 compatibility
- Added Turbopack config and root `package.json` scripts for frontend workflows

**Stacks Devnet and Core API Updates**
- Added `STACKS_CORE_API_URL` support for separate Stacks core node endpoints
- Added `relayer/scripts/initialize-signers-v4.js` for devnet signer initialization
- Updated devnet Stacks API port to `3999` and documented devnet setup in `docs/local-e2e.md`

**Deployment Script Enhancements**
- Added network-specific USDC address validation in `evm/scripts/deploy.js`
- Prevents deployment with missing USDC addresses on non-Base Sepolia networks
- Improved error handling for multi-network deployments

**Configuration Management**
- Implemented mainnet/testnet auto-detection in `relayer/src/config.js`
- Automatic RPC URL and API URL selection based on network mode
- Reduced configuration errors and improved developer experience

**Rate Limiting Fix**
- Fixed rate limiting implementation in all Clarity contracts
- Now uses `stacks-block-time` for accurate hourly/daily window resets
- Ensures proper enforcement of 50K hourly and 200K daily caps

**Local E2E Test Harness (In Progress)**
- Added local deployment helpers and a webhook burn simulator
- Added EVM unit tests with a MockUSDC
- Added Clarinet test scaffolding for Stacks contracts
- Documented the local flow in `docs/local-e2e.md`

---

## Quick Start

### Prerequisites

- Node.js 18+
- [Clarinet](https://github.com/hirosystems/clarinet) 3.11+
- [WalletConnect Project ID](https://cloud.walletconnect.com/) (free)
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
npm install             # Install test dependencies
npm test                # Run Vitest tests (22 tests)
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

Tip: from the repo root, `npm run dev` delegates to `frontend` after installing dependencies there.

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
├── wrapped-usdc-v5.clar          # Current xUSDC token (Clarity 4) - Testnet
├── wrapped-usdc-v4.clar          # xUSDC token (Clarity 4)
├── wrapped-usdc-v3.clar          # xUSDC token (SIP-010)
├── wrapped-usdc-v2.clar          # Legacy version
├── wrapped-usdc.clar             # Original version
├── dex-adapter-trait.clar        # DEX integration interface
├── velar-adapter.clar            # Velar DEX adapter
├── xreserve-adapter.clar         # Circle xReserve adapter
└── sip-010-trait-ft-standard.clar

evm/contracts/
└── BridgeBase.sol                # USDC lock/release on Base
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
| Base Sepolia | BridgeBase (v2) | `0xFCDF3e427e4a4CF3E573762693B9a1bBb35C504B` |
| Stacks Testnet | wrapped-usdc-v5 | `ST1ZGGS886YCZHMFXJR1EK61ZP34FNWNSX28M1PMM.wrapped-usdc-v5` |

### Official USDCx (Mainnet Reference)

| Network | Contract | Address |
|---------|----------|---------|
| Stacks Mainnet | USDCx (Circle) | `SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE.usdcx` |

> **Note**: USDCx is Circle's official USDC-backed stablecoin on Stacks, deployed via xReserve. It is only available on mainnet.

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
- [docs/developer-api.md](./docs/developer-api.md) - Contract APIs + relayer flow
- [docs/developer-guides.md](./docs/developer-guides.md) - Setup, runbook, troubleshooting, deployment
- [ROADMAP.md](./ROADMAP.md) - Project phases and priorities
- [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) - Community standards

---

## Tech Stack

| Layer | Technologies |
|-------|--------------|
| **Stacks** | Clarity 4, Epoch 3.3, Clarinet 3.11 |
| **EVM** | Solidity, Hardhat, OpenZeppelin |
| **Relayer** | Node.js, Viem, @stacks/transactions |
| **Frontend** | Next.js (React 18), TypeScript, WalletConnect, Wagmi v2, OnchainKit, Base Account SDK |

---

## Environment Variables

### Relayer (.env)

```env
# Base (EVM)
BASE_RPC_URL=https://sepolia.base.org
SIGNER_PRIVATE_KEY=your_evm_private_key
BRIDGE_BASE_ADDRESS=0xFCDF3e427e4a4CF3E573762693B9a1bBb35C504B

# Stacks
STACKS_API_URL=https://api.testnet.hiro.so
# Optional: separate Stacks core node endpoint (falls back to STACKS_API_URL)
STACKS_CORE_API_URL=https://stacks-node-api.testnet.stacks.co
STACKS_PRIVATE_KEY=your_stacks_mnemonic_or_key
STACKS_CONTRACT_ADDRESS=ST1ZGGS886YCZHMFXJR1EK61ZP34FNWNSX28M1PMM
STACKS_CONTRACT_NAME=wrapped-usdc-v5
```

### Frontend (.env.local)

```env
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_walletconnect_id
# Optional: OnchainKit API key (omit to use an RPC URL)
NEXT_PUBLIC_ONCHAINKIT_API_KEY=your_onchainkit_api_key
# Optional: RPC URL for OnchainKit (falls back to NEXT_PUBLIC_BASE_RPC_URL)
NEXT_PUBLIC_ONCHAINKIT_RPC_URL=https://sepolia.base.org
# Optional: EAS schema ID for OnchainKit attestation badges
NEXT_PUBLIC_ONCHAINKIT_SCHEMA_ID=0x...
NEXT_PUBLIC_BASE_ACCOUNT_APP_NAME=Stacks Bridge
NEXT_PUBLIC_BASE_RPC_URL=https://sepolia.base.org
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
