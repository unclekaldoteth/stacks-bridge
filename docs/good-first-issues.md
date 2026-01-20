# Good First Issue Templates

These are ready-to-file issue templates for maintainers. Each template is scoped, concrete, and aligned with the developer guides. Copy a template into a new GitHub issue and apply the `good first issue` label.

## Template: Docs - Environment Variable Reference Tables

**Area:** Docs  
**Difficulty:** Easy  
**Estimated time:** 1-2 hours

```
Title: Docs: Add environment variable reference tables
Labels: good first issue, documentation

Context:
The developer guides explain setup, but we do not have a single reference table that lists env vars and defaults.

Scope:
- Add an "Environment Reference" section to docs/developer-guides.md.
- Include tables for evm/.env.example, relayer/.env.example, and frontend/.env.local.
- Mention which vars are required vs optional and any defaults.

Acceptance Criteria:
- Tables exist for EVM, relayer, and frontend env vars.
- Each table includes variable name, purpose, and default (or "required").
- Links to the source files are included.

References:
- docs/developer-guides.md
- evm/.env.example
- relayer/.env.example
- frontend/README.md
```

## Template: Frontend - Env Overrides for Contract Addresses

**Area:** Frontend  
**Difficulty:** Easy  
**Estimated time:** 2-3 hours

```
Title: Frontend: support env overrides for contract addresses
Labels: good first issue, enhancement

Context:
frontend/src/lib/config.ts hardcodes Base + Stacks addresses. We want optional NEXT_PUBLIC_ env overrides.

Scope:
- Add NEXT_PUBLIC_BASE_BRIDGE_ADDRESS, NEXT_PUBLIC_BASE_USDC_ADDRESS,
  NEXT_PUBLIC_STACKS_CONTRACT, and NEXT_PUBLIC_STACKS_API_URL support.
- Keep current defaults if env vars are not provided.
- Document the new vars in frontend/README.md.

Acceptance Criteria:
- Env vars override defaults when set.
- No behavior change if env vars are missing.
- README includes the new variables with short descriptions.

References:
- frontend/src/lib/config.ts
- frontend/README.md
```

## Template: Relayer - Script Usage Section

**Area:** Docs  
**Difficulty:** Easy  
**Estimated time:** 1-2 hours

```
Title: Docs: add relayer helper scripts section
Labels: good first issue, documentation

Context:
relayer/README.md lists start commands but not the helper scripts.

Scope:
- Add a "Helper Scripts" section to relayer/README.md.
- Briefly document what each script does (approve/execute, check-mint, initialize-signers, webhook simulator).
- Link to docs/developer-guides.md for the runbook context.

Acceptance Criteria:
- relayer/README.md includes the new section with short descriptions.
- At least 4 scripts are described.

References:
- relayer/README.md
- relayer/scripts/
- docs/developer-guides.md
```

## Template: Stacks - Add Burn Invalid Address Test

**Area:** Stacks contracts  
**Difficulty:** Easy  
**Estimated time:** 1-2 hours

```
Title: Tests: add burn invalid base-address test
Labels: good first issue, testing

Context:
wrapped-usdc-v4 has tests for zero-amount burns, but not invalid base address length.

Scope:
- Add a Clarinet test that calls burn with an invalid base-address length.
- Assert ERR-INVALID-ADDRESS.

Acceptance Criteria:
- New test added to stacks/tests/wrapped-usdc-v4.test.ts.
- Test passes and uses existing error constants.

References:
- stacks/contracts/wrapped-usdc-v4.clar
- stacks/tests/wrapped-usdc-v4.test.ts
```
