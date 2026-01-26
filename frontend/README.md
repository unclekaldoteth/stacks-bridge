# Stacks Bridge Frontend

Next.js frontend for the Base ↔ Stacks USDC Bridge. This interface allows users to bridge USDC between Base (Ethereum L2) and Stacks (Bitcoin L2).

## Features

- **Deposit**: Lock USDC on Base → Mint xUSDC on Stacks
- **Withdraw**: Burn xUSDC on Stacks → Release USDC on Base
- **Wallet Connection**: WalletConnect, MetaMask, Coinbase Wallet
- **Transaction Tracking**: Monitor pending bridge transactions

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

# Optional - OnchainKit configuration
NEXT_PUBLIC_ONCHAINKIT_API_KEY=your_onchainkit_api_key
NEXT_PUBLIC_ONCHAINKIT_RPC_URL=https://sepolia.base.org
NEXT_PUBLIC_ONCHAINKIT_SCHEMA_ID=0x...

# Optional - Network configuration
NEXT_PUBLIC_BASE_RPC_URL=https://sepolia.base.org
NEXT_PUBLIC_NETWORK=testnet
```

### Environment Variable Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | Yes | WalletConnect Cloud project ID |
| `NEXT_PUBLIC_ONCHAINKIT_API_KEY` | No | OnchainKit API key for enhanced features |
| `NEXT_PUBLIC_ONCHAINKIT_RPC_URL` | No | Custom RPC URL for OnchainKit |
| `NEXT_PUBLIC_ONCHAINKIT_SCHEMA_ID` | No | EAS schema ID for attestation badges |
| `NEXT_PUBLIC_BASE_RPC_URL` | No | Base RPC URL (defaults to Sepolia) |
| `NEXT_PUBLIC_NETWORK` | No | `testnet` or `mainnet` |

## Contract Addresses

Update contract addresses in `src/lib/config.ts` when deploying to new networks.

### Testnet (Current)

| Network | Contract | Address |
|---------|----------|---------|
| Base Sepolia | BridgeBase | `0xFCDF3e427e4a4CF3E573762693B9a1bBb35C504B` |
| Stacks Testnet | wrapped-usdc-v5 | `ST1ZGGS886YCZHMFXJR1EK61ZP34FNWNSX28M1PMM.wrapped-usdc-v5` |

## Tech Stack

- **Framework**: Next.js 16 with Turbopack
- **Styling**: Tailwind CSS
- **Wallet**: wagmi v2, WalletConnect, OnchainKit
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
