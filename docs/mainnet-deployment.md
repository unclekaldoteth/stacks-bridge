# Mainnet Deployment Checklist

This guide covers deploying the Base ↔ Stacks bridge to mainnet.

---

## Pre-Deployment Requirements

### Wallets & Funds

- [ ] **Base Deployer Wallet** - New wallet with ~0.01 ETH for gas
- [ ] **Stacks Deployer Wallet** - New wallet with ~10 STX for contract fees
- [ ] **Multi-Sig Signer 1** - Separate wallet for relayer 1
- [ ] **Multi-Sig Signer 2** - Separate wallet for relayer 2  
- [ ] **Multi-Sig Signer 3** - Separate wallet for relayer 3

> ⚠️ **Security**: Each signer wallet should be controlled by a different party or hardware wallet.

### API Keys

- [ ] **Hiro API Key** - Get from [platform.hiro.so](https://platform.hiro.so)
- [ ] **BaseScan API Key** - Get from [basescan.org](https://basescan.org/apis)
- [ ] **Base RPC** - Public or use Alchemy/Infura for reliability

---

## Deployment Steps

### 1. Configure Environment Files

```bash
# Stacks
cp stacks/settings/Mainnet.toml.example stacks/settings/Mainnet.toml
# Add your mainnet mnemonic

# EVM
cp evm/.env.mainnet.example evm/.env
# Add private key and signer addresses

# Relayer
cp relayer/.env.mainnet.example relayer/.env
# Add all configuration
```

### 2. Deploy Stacks Contract

```bash
cd stacks

# Check contract compiles
clarinet check

# Deploy to mainnet
clarinet deployments apply -p deployments/default.mainnet-plan.yaml
```

**Expected output**: Contract address like `SP...xxx.wrapped-usdc`

### 3. Deploy EVM Contract

```bash
cd evm

# Deploy BridgeBase
npx hardhat run scripts/deploy.js --network baseMainnet

# Verify on BaseScan
npx hardhat verify --network baseMainnet <CONTRACT_ADDRESS> <USDC_ADDRESS> [SIGNER1, SIGNER2, SIGNER3]
```

**Expected output**: Contract address like `0x...xxx`

### 4. Initialize Signers on Stacks

```bash
cd relayer

# Initialize the 3 signers on Stacks contract
node scripts/initialize-signers.js
```

### 5. Update Frontend Config

Edit `frontend/src/lib/config.ts`:

```typescript
export const config = {
  network: 'mainnet',
  contracts: {
    base: {
      bridge: '0x...MAINNET_ADDRESS...',
      usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // Base mainnet USDC
    },
    stacks: {
      address: 'SP...xxx',
      name: 'wrapped-usdc',
    },
  },
  chains: {
    base: {
      chainId: 8453, // Base Mainnet
      rpc: 'https://mainnet.base.org',
      explorer: 'https://basescan.org',
    },
    stacks: {
      network: 'mainnet',
      api: 'https://api.hiro.so',
      explorer: 'https://explorer.hiro.so',
    },
  },
};
```

### 6. Start Relayers

Each relayer should run on a separate server:

```bash
# Relayer 1 (Server A)
SIGNER_INDEX=1 node src/index.js

# Relayer 2 (Server B)
SIGNER_INDEX=2 node src/index.js

# Relayer 3 (Server C)
SIGNER_INDEX=3 node src/index.js
```

---

## Post-Deployment Verification

### Contract Verification

- [ ] BridgeBase verified on BaseScan
- [ ] wrapped-usdc visible on Stacks Explorer
- [ ] All 3 signers registered on both chains

### Functional Tests

- [ ] Small deposit (10 USDC) - Base → Stacks
- [ ] Check xUSDC minted on Stacks
- [ ] Small withdraw (5 xUSDC) - Stacks → Base
- [ ] Check USDC released on Base

### Security Checks

- [ ] Multi-sig requires 2-of-3 approvals
- [ ] Rate limits active (10K/tx, 50K/hr, 200K/day)
- [ ] Timelock working for large transactions
- [ ] Emergency pause tested

---

## Contract Addresses (Fill After Deployment)

| Chain | Contract | Address |
|-------|----------|---------|
| Base Mainnet | BridgeBase | `0x...` |
| Base Mainnet | USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| Stacks Mainnet | wrapped-usdc | `SP...xxx.wrapped-usdc` |
| Stacks Mainnet | USDCx (Circle) | `SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE.usdc` |

---

## Mainnet URLs

| Service | URL |
|---------|-----|
| Base RPC | `https://mainnet.base.org` |
| Base Explorer | `https://basescan.org` |
| Stacks API | `https://api.hiro.so` |
| Stacks Explorer | `https://explorer.hiro.so` |

---

## Emergency Procedures

### Pause Bridge

```javascript
// From owner wallet
await bridgeBase.pause();
```

### Emergency Withdraw

```javascript
// Only owner can call
await bridgeBase.emergencyWithdraw(safeAddress, amount);
```

### Remove Compromised Signer

```javascript
// Remove and add new signer
await bridgeBase.removeSigner(compromisedAddress);
await bridgeBase.addSigner(newSignerAddress);
```
