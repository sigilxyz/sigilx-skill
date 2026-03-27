# @sigilx/skills

Decentralized proof verification and on-chain certification for AI agents.

[![npm](https://img.shields.io/npm/v/@sigilx/skills)](https://www.npmjs.com/package/@sigilx/skills)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

## Install

```bash
npm install @sigilx/skills
```

## What it does

Submit mathematical proofs, smart contracts, or formal specs. Get permanent on-chain certificates backed by independent evaluator committees.

| Action | Price | What you get |
|--------|-------|-------------|
| `verify_proof` | $0.50 | Lean 4 typecheck + cross-verification |
| `forge_test` | $5.00 | Foundry test suite execution |
| `formal_analysis` | $5.00 | Formal property verification |
| `deep_audit` | $10.00 | Multi-engine comprehensive audit |
| `standard_certificate` | $25.00 | On-chain ERC-8183 certificate |

Free: `chat`, `research_contract` -- no payment required.

## Quick start

```bash
# Ask a question (free)
curl -X POST https://api.sigilx.xyz/v1/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Is 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 safe?"}'

# Verify a proof (paid -- returns 402, pay with x402 USDC on Base)
curl -X POST https://api.sigilx.xyz/v1/jobs \
  -H "Content-Type: application/json" \
  -d '{"action": "verify_proof", "input": "theorem add_zero (n : Nat) : n + 0 = n := by rfl"}'
```

## Payment

Pay per request with USDC on Base via x402. No API key, no account, no signup.

```
Request without payment --> 402 with payment requirements
Sign USDC transfer --> Retry with Payment-Signature header
```

See [SKILL.md](./SKILL.md) for the full API reference, payment flow details, and contract addresses.

## For OpenClaw agents

This package is an OpenClaw skill. Add it to your agent's runtime:

```js
import skill from "@sigilx/skills/runtime/index.js";
```

Required environment variables:

| Variable | Purpose |
|----------|---------|
| `SIGILX_ENGINE_URL` | Verification engine API URL |
| `SIGILX_INTERNAL_HMAC_SECRET` | HMAC signing secret (min 32 chars) |
| `SKILL_PROXY_TOKEN` | Skill proxy bearer token |

## Links

- [sigilx.xyz](https://sigilx.xyz) -- Try it now
- [API docs](./SKILL.md) -- Full API reference
- [Contracts](https://github.com/sigilxyz/sigilx-contracts) -- Smart contracts on Base
- [ERC-8183](https://eips.ethereum.org/EIPS/eip-8183) -- Agentic commerce standard

## License

MIT
