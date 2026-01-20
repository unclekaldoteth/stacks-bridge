# Bridge to USDCx Workflow

This guide explains how to convert bridged xUSDC tokens to native USDCx (Circle's USDC on Stacks).

## Overview

```
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│   Base/ETH   │ ──── │   Bridge     │ ──── │   Stacks     │
│    USDC      │      │   xUSDC      │      │   USDCx      │
└──────────────┘      └──────────────┘      └──────────────┘
       Lock           Queue + Mint          Swap via DEX
```

**Two Paths Available:**
1. **Velar DEX** - Permissionless, instant, higher slippage
2. **xReserve** - 1:1 rate, requires attestation (Q1 2026 SDK)

---

## Token Addresses

| Token | Contract | Network |
|-------|----------|---------|
| USDCx (Circle) | `SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE.usdcx` | Mainnet |
| xUSDC (Bridge) | Your deployed `wrapped-usdc-v4` contract | Mainnet/Testnet |
| Velar Router | `SP1Y5YSTAHZ88XYK1VPDH24GY0HPX5J4JECTMY4A1.univ2-router` | Mainnet |

---

## Path 1: Velar DEX Swap

### Setup Requirements

1. **Create Pool on Velar** (if not exists)
   - Cost: 100 STX minimum + liquidity
   - Ratio: **MUST be exactly 1:1** (critical!)
   - Go to: https://velar.co/swap → Pools → Create Pair

2. **Configure Adapter**
   ```clarity
   ;; Set Velar adapter in wrapped-usdc-v4
   (contract-call? .wrapped-usdc-v4 set-dex-adapter .velar-adapter)
   (contract-call? .wrapped-usdc-v4 set-auto-swap-enabled true)
   
   ;; Configure pool in velar-adapter
   (contract-call? .velar-adapter configure-pool 
     .wrapped-usdc-v4  ;; xUSDC contract
     'SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE.usdcx  ;; USDCx
     u1)  ;; Pool ID from Velar
   ```

### User Flow

1. User bridges USDC from Base → xUSDC minted on Stacks
2. User calls `execute-mint-and-swap` instead of `execute-mint`
3. Relayer processes swap via Velar adapter
4. User receives USDCx

### Slippage Protection

Default: 0.5% (50 basis points)

```clarity
;; Adjust if needed (owner only)
(contract-call? .velar-adapter set-slippage-tolerance u100)  ;; 1%
```

---

## Path 2: xReserve Attestation

> **Note:** Circle Bridge Kit SDK releasing Q1 2026. Current implementation is relayer-based.

### Setup Requirements

1. **Configure xReserve Adapter**
   ```clarity
   (contract-call? .wrapped-usdc-v4 set-xreserve-adapter .xreserve-adapter)
   (contract-call? .wrapped-usdc-v4 set-xreserve-enabled true)
   
   (contract-call? .xreserve-adapter configure-tokens
     .wrapped-usdc-v4  ;; xUSDC
     'SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE.usdcx)  ;; USDCx
   ```

2. **Start xReserve Handler** in relayer:
   ```javascript
   import { startXReserveHandler } from './src/xreserve-handler.js';
   await startXReserveHandler();
   ```

### User Flow

1. User bridges USDC from Base → xUSDC minted on Stacks
2. User calls `execute-mint-via-xreserve`
3. Relayer requests attestation from Circle xReserve API
4. Relayer submits attestation → USDCx minted 1:1
5. User receives USDCx

### Advantages vs DEX

| Feature | Velar DEX | xReserve |
|---------|-----------|----------|
| Rate | ~0.997:1 (0.3% fee) | 1:1 |
| Speed | Instant | ~1 min (attestation) |
| Liquidity Needed | Yes (pool TVL) | No |
| Slippage | Variable | None |

---

## Choosing the Right Path

**Use Velar when:**
- Pool has deep liquidity (>$50k TVL)
- User wants instant swap
- Small amounts (<$1k)

**Use xReserve when:**
- Large amounts (>$10k)
- No slippage tolerance
- Bridge Kit SDK is available

---

## DEX Pool Creation Guide (Velar)

Based on research: No xUSDC/USDCx pool exists as of Jan 2026.

### Steps to Create Pool

1. **Prerequisites**
   - Leather or Xverse wallet
   - 100+ STX for bond
   - Equal amounts of xUSDC and USDCx

2. **Navigate** to https://velar.co/swap → Pools → Create Pair

3. **Select Tokens**
   - Token A: xUSDC (paste your contract address)
   - Token B: USDCx (`SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE.usdcx`)

4. **Set Initial Liquidity**
   ```
   ⚠️ CRITICAL: Must be EXACTLY 1:1
   
   Example: 10,000 xUSDC + 10,000 USDCx
   
   Wrong ratio = immediate arbitrage loss!
   ```

5. **Confirm and Wait** (~10 min for Bitcoin finality)

### Alternative: Bitflow (Recommended for Stable Pairs)

Bitflow uses Curve-style stable swap = better capital efficiency.

- Contact Bitflow team for pool setup
- Lower slippage per dollar of TVL
- Already hosts aeUSDC/USDCx pool

---

## Contract Reference

### wrapped-usdc-v4 Functions

```clarity
;; Admin Setup
(set-dex-adapter (adapter principal))
(set-xreserve-adapter (adapter principal))
(set-auto-swap-enabled (enabled bool))
(set-xreserve-enabled (enabled bool))

;; User Execution
(execute-mint (mint-id uint))           ;; Get xUSDC
(execute-mint-and-swap (id uint) (min-out uint))  ;; Get USDCx via DEX
(execute-mint-via-xreserve (mint-id uint))        ;; Get USDCx via xReserve
```

### velar-adapter Functions

```clarity
(configure-pool (xusdc principal) (usdcx principal) (pool-id uint))
(set-slippage-tolerance (bps uint))
(swap-exact-tokens (in uint) (min-out uint) (token-in principal) (token-out principal))
(get-swap-quote (in uint) (token-in principal) (token-out principal))
```

### xreserve-adapter Functions

```clarity
(configure-tokens (xusdc principal) (usdcx principal))
(swap-exact-tokens ...)  ;; Emits event for relayer
(complete-swap (swap-id uint))  ;; Called by relayer after attestation
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Pool not found | Create on Velar or contact Bitflow |
| High slippage | Add more liquidity or use xReserve |
| Swap reverts | Check pool is configured, tokens approved |
| xReserve pending | Wait for relayer + Circle attestation |
