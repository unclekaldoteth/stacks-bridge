# Stacks Bridge Frontend

Next.js frontend for the Base ↔ Stacks USDC Bridge. This interface allows users to bridge USDC between Base (Ethereum L2) and Stacks (Bitcoin L2).

## Features

- **Deposit**: Lock USDC on Base → Mint xUSDC on Stacks
- **Withdraw**: Burn xUSDC on Stacks → Release USDC on Base
- **Wallet Connection**: WalletConnect, MetaMask, Coinbase Wallet (SSR-safe)
- **Real-Time Pricing**: Live ETH/USD (Chainlink) and STX/USD (Coinbase API)
- **Transaction Tracking**: Monitor pending bridge transactions
- **Network-Aware**: Auto-switches APIs between mainnet and testnet

## Getting Started

### Prerequisites

- Node.js 18+
- A WalletConnect Project ID (free at [cloud.walletconnect.com](https://cloud.walletconnect.com/))

### Installation

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

## Environment Variables

Create a `.env.local` file:

```bash
# Required
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id

# Network configuration (mainnet or testnet)
NEXT_PUBLIC_NETWORK=mainnet

# Optional - OnchainKit configuration
NEXT_PUBLIC_ONCHAINKIT_API_KEY=your_onchainkit_api_key
NEXT_PUBLIC_ONCHAINKIT_RPC_URL=https://mainnet.base.org
NEXT_PUBLIC_ONCHAINKIT_SCHEMA_ID=0x...

# Optional - Custom RPC URLs
NEXT_PUBLIC_BASE_RPC_URL=https://mainnet.base.org
NEXT_PUBLIC_BASE_MAINNET_RPC_URL=https://mainnet.base.org
NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
```

### Environment Variable Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | Yes | WalletConnect Cloud project ID |
| `NEXT_PUBLIC_NETWORK` | Yes | `mainnet` or `testnet` |
| `NEXT_PUBLIC_ONCHAINKIT_API_KEY` | No | OnchainKit API key for enhanced features |
| `NEXT_PUBLIC_ONCHAINKIT_RPC_URL` | No | Custom RPC URL for OnchainKit |
| `NEXT_PUBLIC_ONCHAINKIT_SCHEMA_ID` | No | EAS schema ID for attestation badges |
| `NEXT_PUBLIC_BASE_RPC_URL` | No | Base RPC URL (auto-selected based on network) |

## Contract Addresses

Addresses are configured in `src/lib/config.ts` and auto-selected based on `NEXT_PUBLIC_NETWORK`.

### Mainnet (Live)

| Network | Contract | Address |
|---------|----------|---------|
| Base Mainnet | BridgeBase | `0x0EdF28403D027Be0917625C751c78236407dD4E0` |
| Stacks Mainnet | wrapped-usdc-v5 | `SP1MTYHV6K2FNH3QNF4P5QXS9VJ3XZ0GBB5T1SJPK.wrapped-usdc-v5` |

### Testnet

| Network | Contract | Address |
|---------|----------|---------|
| Base Sepolia | BridgeBase | `0xFCDF3e427e4a4CF3E573762693B9a1bBb35C504B` |
| Stacks Testnet | wrapped-usdc-v5 | `ST1ZGGS886YCZHMFXJR1EK61ZP34FNWNSX28M1PMM.wrapped-usdc-v5` |

## Key Components

| Component | Description |
|-----------|-------------|
| `ConnectButton` | SSR-safe wallet connection with hydration handling |
| `BridgeForm` | Main deposit/withdraw form |
| `FeeEstimator` | Real-time fee breakdown (Chainlink + Coinbase) |
| `BridgeStats` | Bridge analytics from Blockscout API |
| `TransactionHistory` | User's bridge transaction history |

## Hooks

| Hook | Description |
|------|-------------|
| `usePrices` | Real-time ETH/USD (Chainlink) and STX/USD (Coinbase) |

## Tech Stack

- **Framework**: Next.js 16 with Turbopack
- **Styling**: Tailwind CSS
- **Wallet**: wagmi v2, WalletConnect, Reown AppKit, OnchainKit
- **Language**: TypeScript

## Related Documentation

- [Main README](../README.md) - Project overview
- [Developer Guides](../docs/developer-guides.md) - Setup and deployment
- [Developer API](../docs/developer-api.md) - Contract APIs

## Deploy on Vercel

The easiest way to deploy is with [Vercel](https://vercel.com/new?utm_medium=default-template&filter=next.js):

```bash
npm run build
vercel deploy
```

See the [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

