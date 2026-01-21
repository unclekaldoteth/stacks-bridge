# Base <> Stacks USDC Bridge Relayer

Multi-sig relayer for the Base <> Stacks USDC bridge.

## Architecture

```
┌─────────────────┐     ┌─────────────────┐
│   Base Chain    │     │  Stacks Chain   │
│  (BridgeBase)   │     │  (wrapped-usdc) │
└────────┬────────┘     └────────┬────────┘
         │                       │
         │    ┌───────────┐      │
         └───►│  Relayer  │◄─────┘
              │  (2-of-3) │
              └───────────┘
```

## Multi-Sig Setup

You need **3 relayer instances** running, each with a different signer key:

- Relayer 1: `SIGNER_INDEX=1`
- Relayer 2: `SIGNER_INDEX=2`
- Relayer 3: `SIGNER_INDEX=3`

Any 2 of 3 must approve transactions for execution.

## Setup

1. Copy environment template:
```bash
cp .env.example .env
```

2. Configure `.env`:
```bash
# Set deployed contract addresses
BRIDGE_BASE_ADDRESS=0x...
STACKS_CONTRACT_ADDRESS=ST...

# Set this relayer's signer keys
SIGNER_INDEX=1
SIGNER_PRIVATE_KEY=<evm-private-key>
STACKS_PRIVATE_KEY=<stacks-private-key>
```

3. Install dependencies:
```bash
npm install
```

4. Run relayer:
```bash
npm start
```

## Developer Docs

See `docs/developer-api.md` for contract APIs, event payloads, and relayer flow details.

## Flow

### Deposit (Base → Stacks)
1. User locks USDC on Base
2. Relayer detects `Deposit` event
3. Relayer calls `queue-mint` on Stacks
4. 2nd relayer calls `approve-mint`
5. After timelock, any relayer calls `execute-mint`

### Withdraw (Stacks → Base)
1. User burns xUSDC on Stacks
2. Relayer detects `burn` print event
3. Relayer calls `queueRelease` on Base
4. 2nd relayer calls `approveRelease`
5. After timelock, any relayer calls `executeRelease`

## Security Features

- **2-of-3 Multi-Sig**: No single point of failure
- **Rate Limits**: 10K/tx, 50K/hr, 200K/day
- **Timelock**: Small instant, medium 10min, large 1hr
- **Emergency Pause**: Any signer can pause
- **Auto-Reconnect**: Automatically recreates RPC event filters when they expire (Alchemy filters timeout after ~5 min)

## Testnet Configuration

For Base Sepolia + Stacks Testnet:

```bash
# .env (testnet)
BASE_RPC_URL=https://base-sepolia.g.alchemy.com/v2/<your-key>
BRIDGE_BASE_ADDRESS=0xb879aF9CeA3193157168A10Fdfdb853bDE4f32Ef

STACKS_API_URL=https://api.testnet.hiro.so
STACKS_CORE_API_URL=https://api.testnet.hiro.so
STACKS_CONTRACT_ADDRESS=ST1ZGGS886YCZHMFXJR1EK61ZP34FNWNSX28M1PMM
STACKS_CONTRACT_NAME=wrapped-usdc-v5
```

## xReserve Handler (USDCx Integration)

For users who want 1:1 USDCx instead of xUSDC, the relayer includes an xReserve handler:

```javascript
import { startXReserveHandler } from './src/xreserve-handler.js';
await startXReserveHandler();
```

This handler:
1. Polls for `mint-via-xreserve-requested` events
2. Requests attestation from Circle xReserve API
3. Submits attestation to mint USDCx

> **Note**: Circle Bridge Kit SDK expected Q1 2026. Current implementation is a placeholder.

See [docs/usdcx-workflow.md](../docs/usdcx-workflow.md) for full USDCx integration guide.

## Commands

```bash
npm start      # Run relayer
npm run dev    # Run with auto-reload
```
