# Contributing to Stacks Bridge Base

Thank you for your interest in contributing to the Base <> Stacks USDC Bridge! This project aims to provide cheaper bridging for users by leveraging Base L2 instead of Ethereum L1.

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
git clone https://github.com/unclekaldoteth/stacks-bridge-base.git
cd stacks-bridge-base

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

### Good First Issues

- [ ] Add unit tests for Clarity contracts
- [ ] Improve error handling in relayer
- [ ] Add transaction history UI component
- [ ] Document API endpoints

### Larger Projects

- [ ] USDCx integration via DEX swap
- [ ] Multi-chain support (Arbitrum, Optimism)
- [ ] Decentralized relayer network
- [ ] Security audit preparation

## Getting Help

- Open a GitHub issue for bugs or questions
- Join the discussion in GitHub Discussions

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
