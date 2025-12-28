# Base to Stacks USDC Bridge

**A decentralized, trustless bridge for transferring USDC between Base (Ethereum L2) and Stacks (Bitcoin L2).**  
**Built with Solidity, Clarity, and a multi-signature relayer architecture.**

The Base-Stacks Bridge enables seamless cross-chain USDC transfers, allowing users to bridge USDC from Base to receive xUSDC (wrapped USDC) on Stacks, and vice versa. Built for security-first with multi-signature validation, timelocked withdrawals, and rate limiting.

---

## Why This Bridge?

Stacks lacks native USDC liquidity. Users who want to participate in the Stacks DeFi ecosystem must navigate complex bridging solutions with limited support.

**This bridge solves that problem.**  
Deposit USDC on Base, receive xUSDC on Stacks within minutes. Burn xUSDC on Stacks, receive USDC back on Base. All trustlessly validated by a decentralized multi-sig relayer network.

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
- Open-source smart contracts (Solidity + Clarity)
- Modular relayer architecture
- REST API for integration
- Event-driven webhook support via Hiro Chainhooks

---

## Architecture Overview

```
    BASE (EVM)                    STACKS (Bitcoin L2)
    ┌─────────────┐               ┌─────────────────┐
    │ BridgeBase  │               │  wrapped-usdc   │
    │ (Solidity)  │               │   (Clarity)     │
    └──────┬──────┘               └────────┬────────┘
           │                               │
           │      ┌─────────────────┐      │
           └──────┤    RELAYER      ├──────┘
                  │  (Multi-Sig)    │
                  │                 │
                  │ • Event Watcher │
                  │ • Tx Submitter  │
                  │ • Approval Flow │
                  └─────────────────┘
```

### Smart Contracts

**Base (Solidity)**
- `BridgeBase.sol` - Handles USDC deposits, queues releases, manages multi-sig approvals
- Uses OpenZeppelin's SafeERC20 for secure token handling

**Stacks (Clarity)**
- `wrapped-usdc.clar` - SIP-010 compliant xUSDC token with multi-sig mint/burn
- `dex-adapter-trait.clar` - Generic DEX integration interface
- `velar-adapter.clar` - Velar DEX adapter for USDCx swaps

### Relayer Service

- Node.js-based event listener and transaction submitter
- Watches Base for Deposit events
- Queues mints on Stacks with multi-sig validation
- Handles approval flow and execution

---

## How It Works

### Bridge: Base to Stacks

1. User calls `deposit()` on BridgeBase contract with USDC amount and Stacks address
2. USDC is locked in the bridge contract
3. Relayer detects the Deposit event
4. Relayer calls `queue-mint` on Stacks contract
5. Signers approve the mint (2-of-3 required)
6. After timelock expires, `execute-mint` mints xUSDC to user

### Bridge: Stacks to Base

1. User calls `burn` on wrapped-usdc contract with amount and Base address
2. xUSDC is burned
3. Relayer detects the Burn event
4. Relayer calls `queueRelease` on BridgeBase contract
5. Signers approve the release (2-of-3 required)
6. After timelock expires, USDC is released to user on Base

---

## Project Structure

```
stacks-bridge-base/
├── evm/                    # Solidity contracts for Base
│   ├── contracts/
│   │   └── BridgeBase.sol
│   ├── scripts/
│   │   └── deploy.js
│   └── hardhat.config.js
│
├── stacks/                 # Clarity contracts for Stacks
│   ├── contracts/
│   │   ├── wrapped-usdc.clar
│   │   ├── wrapped-usdc-v2.clar
│   │   ├── sip-010-trait-ft-standard.clar
│   │   ├── dex-adapter-trait.clar
│   │   └── velar-adapter.clar
│   └── Clarinet.toml
│
├── relayer/                # Node.js relayer service
│   ├── src/
│   │   ├── index.js
│   │   ├── config.js
│   │   ├── base-listener.js
│   │   └── stacks-handler.js
│   └── scripts/
│       ├── initialize-signers.js
│       └── approve-execute-v2.js
│
└── frontend/               # Next.js web interface
    ├── src/
    │   ├── app/
    │   ├── components/
    │   └── lib/
    └── package.json
```

---

## Deployed Contracts

### Testnet Deployment

| Network | Contract | Address |
|---------|----------|---------|
| Base Sepolia | BridgeBase | `0x06c6Fd0afa92062FE76DE72DA5EC7a63Ba01F6FC` |
| Stacks Testnet | wrapped-usdc | `ST1ZGGS886YCZHMFXJR1EK61ZP34FNWNSX28M1PMM.wrapped-usdc` |
| Stacks Testnet | wrapped-usdc-v2 | `ST1ZGGS886YCZHMFXJR1EK61ZP34FNWNSX28M1PMM.wrapped-usdc-v2` |

---

## Getting Started

### Prerequisites

- Node.js 18+
- Hardhat (for EVM deployment)
- Clarinet (for Stacks deployment)
- A Base Sepolia RPC (Alchemy recommended)

### Installation

```bash
# Clone the repository
git clone https://github.com/unclekaldoteth/stacks-bridge.git
cd stacks-bridge

# Install EVM dependencies
cd evm && npm install

# Install Stacks dependencies
cd ../stacks && npm install

# Install Relayer dependencies
cd ../relayer && npm install

# Install Frontend dependencies
cd ../frontend && npm install
```

### Configuration

1. Copy environment files:
```bash
cp evm/.env.example evm/.env
cp relayer/.env.example relayer/.env
```

2. Fill in your private keys, RPC URLs, and contract addresses

3. Deploy contracts:
```bash
# Deploy to Base Sepolia
cd evm && npx hardhat run scripts/deploy.js --network baseSepolia

# Deploy to Stacks Testnet
cd ../stacks && clarinet deployments apply -p deployments/default.testnet-plan.yaml
```

4. Initialize signers:
```bash
cd relayer && node scripts/initialize-signers.js
```

### Running the Bridge

```bash
# Start the relayer
cd relayer && npm start

# Start the frontend
cd frontend && npm run dev
```

Visit `http://localhost:3000` to use the bridge.

---

## Security Considerations

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

## Roadmap

### Phase 1 - Core Infrastructure [COMPLETED]
- EVM bridge contract with multi-sig
- Clarity xUSDC SIP-010 token
- Basic relayer with event watching
- Frontend deposit interface

### Phase 2 - Security Hardening [COMPLETED]
- Timelocked releases
- Rate limiting
- Multi-signature validation
- Emergency pause mechanism

### Phase 3 - USDCx Integration [IN PROGRESS]
- DEX adapter trait for modular swaps
- Velar DEX integration
- Auto-swap xUSDC to native USDCx

### Phase 4 - Production Launch
- Mainnet deployment
- Security audit
- Decentralized relayer network
- Governance token

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| EVM Smart Contracts | Solidity, Hardhat, OpenZeppelin |
| Stacks Smart Contracts | Clarity 2, Clarinet |
| Relayer | Node.js, Viem, @stacks/transactions |
| Frontend | Next.js 16, React, Wagmi, @stacks/connect |
| Indexing | Hiro Chainhooks (optional) |

---

## Contributing

We welcome contributions! Please:

1. Fork the repository
2. Create a feature branch
3. Submit a pull request with clear description

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
