# Signer Rotation Runbook (Base + Stacks)

This runbook describes how to rotate signer keys for the Base and Stacks bridge contracts without disrupting user flows.

## Preconditions

1. Schedule a maintenance window and notify relayer operators.
2. Ensure you have the contract owner keys for both chains.
3. Confirm current signer lists and counts on both chains.
4. Pause user-initiated flows if you need a clean cutover.

## Base (EVM) Signer Rotation

1. Generate 3 new EVM signer keys and distribute them to separate operators.
2. List current signers: `NETWORK=mainnet node relayer/scripts/list-base-signers.js`
3. From the BridgeBase owner wallet, call `addSigner(newSigner)` for each new address: `NETWORK=mainnet OWNER_PRIVATE_KEY=... BRIDGE_BASE_ADDRESS=... node relayer/scripts/add-base-signer.js 0xNewSigner`
4. Verify each new signer with `isSigner(address)`.
5. Update each relayer instance: set `SIGNER_PRIVATE_KEY` to the new key and restart the relayer process.
6. Execute a small test release and verify approvals succeed with the new signers.
7. From the BridgeBase owner wallet, call `removeSigner(oldSigner)` for each retired address: `NETWORK=mainnet OWNER_PRIVATE_KEY=... BRIDGE_BASE_ADDRESS=... node relayer/scripts/remove-base-signer.js 0xOldSigner`
8. Verify the signer set with `getSigners()`: `NETWORK=mainnet node relayer/scripts/list-base-signers.js`

## Stacks Signer Rotation

The current `wrapped-usdc-v5` contract supports `add-signer` but does not support signer removal. Rotation depends on the current signer count.

### If signer count is below MAX_SIGNERS

1. Generate new Stacks signer keys.
2. List current signers: `NETWORK=mainnet node relayer/scripts/list-stacks-signers.js`
3. From the contract owner, call `add-signer` for each new principal: `NETWORK=mainnet STACKS_PRIVATE_KEY="..." STACKS_CONTRACT_ADDRESS=... node relayer/scripts/add-signer.js SP...`
4. Update relayers to use the new `STACKS_PRIVATE_KEY` values and restart.
5. Verify signer authorization with `is-authorized-signer`.

### If signer count equals MAX_SIGNERS (common on mainnet)

1. Plan a contract upgrade or redeploy a new wrapped-USDC contract version.
2. Initialize new signers on the new contract.
3. Update relayers and frontend to point to the new contract address.
4. Pause the old contract to prevent new mints.
5. Publish a migration notice for users and operators.

## Post-Rotation Verification

1. Base: verify `isSigner` for new addresses and `isSigner` false for retired ones.
2. Stacks: verify `is-authorized-signer` for new signers.
3. Run a deposit -> mint and burn -> release test flow.
4. Monitor relayer logs for authorization errors.

## Rollback Plan

1. If approvals fail, re-enable the previous signer keys and restart relayers.
2. Re-run a small test release/mint before resuming traffic.
