# Contributing to Stacks Bridge Base

Thank you for your interest in contributing to the Base ↔ Stacks USDC Bridge! 

> **🚀 Status:** Mainnet LIVE (January 30, 2026)  
> **Contracts:** [Base](https://basescan.org/address/0x0EdF28403D027Be0917625C751c78236407dD4E0) | [Stacks](https://explorer.hiro.so/txid/0x44c62212aa019260add71e59bea6bc0de16298efa19d730ff4d1c9645e785d0f?chain=mainnet)

This project provides cheaper bridging for users by leveraging Base L2 instead of Ethereum L1.

## How to Contribute

### Reporting Issues

- Use GitHub Issues to report bugs or request features
- Search existing issues before creating a new one
- Include as much detail as possible (steps to reproduce, expected vs actual behavior)

### Code Contributions

1. **Fork the repository** and create a feature branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** following the code style guidelines below

3. **Test your changes** locally:
   ```bash
   # Smart contracts
   cd stacks && clarinet check
   
   # Frontend
   cd frontend && npm run build
   
   # Relayer
   cd relayer && npm start
   ```

4. **Submit a Pull Request** with a clear description of your changes

### Code Style Guidelines

- **Clarity contracts**: Follow [Clarity style guide](https://docs.stacks.co/docs/clarity/)
- **TypeScript/JavaScript**: Use ESLint and Prettier defaults
- **Solidity**: Follow [Solidity style guide](https://docs.soliditylang.org/en/latest/style-guide.html)

## Development Setup

### Prerequisites

- Node.js 18+
- Clarinet 3.11+
- Hardhat
- Stacks wallet (Leather or Xverse)
- MetaMask (for Base)

### Quick Start

```bash
# Clone the repo
git clone https://github.com/unclekaldoteth/stacks-bridge.git
cd stacks-bridge

# Smart contracts
cd stacks
clarinet check

# Frontend
cd frontend
npm install
npm run dev

# Relayer
cd relayer
npm install
cp .env.example .env
# Edit .env with your configuration
npm start
```

## Architecture Overview

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│    Base     │     │   Relayer   │     │   Stacks    │
│  (Solidity) │ ──> │  (Node.js)  │ ──> │  (Clarity)  │
└─────────────┘     └─────────────┘     └─────────────┘
       │                   │                   │
       │  Lock USDC        │  Watch events     │  Mint xUSDC
       │                   │  Queue mints      │
       │                   │  Execute txs      │
```

## Areas for Contribution

### Completed ✅

- [x] Unit tests for Clarity contracts (28 tests passing)
- [x] Transaction History UI component
- [x] USDCx integration via DEX swap (Velar + Alex adapters)
- [x] API documentation
- [x] Mainnet deployment

### Good First Issues

- [ ] Improve error messages in relayer logs
- [ ] Add loading states to frontend components
- [ ] Write integration tests for relayer
- [ ] Add user guides and tutorials

### Larger Projects

- [ ] Security audit preparation
- [ ] Multi-chain support (Arbitrum, Optimism)
- [ ] Decentralized relayer network
- [ ] DEX liquidity pool creation (xUSDC/USDCx)
- [ ] Analytics dashboard improvements

## Getting Help

- Open a GitHub issue for bugs or questions
- Join the discussion in GitHub Discussions

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
