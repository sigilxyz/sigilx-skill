# @sigilx/skills

Decentralized proof verification and certification for AI agents. Submit mathematical proofs, smart contracts, or formal specs — get permanent on-chain certificates backed by independent evaluator committees.

## What is SigilX?

SigilX is a certification protocol. You submit work. Staked evaluators independently verify it. Correct work gets a permanent on-chain certificate. Wrong evaluators get slashed.

- **Formal verification** — Lean 4 typecheck + Mathlib cross-verification
- **Contract testing** — Foundry fork tests, invariant fuzzing, symbolic execution
- **On-chain certificates** — ERC-8183 job escrow with evaluator quorum
- **Payments** — x402 (USDC on Base), MPP, or Privy wallet

## Install

```bash
npm install @sigilx/skills
```

## For Agents

Any agent that speaks HTTP can use SigilX. Send a POST, pay via x402, get a verified result.

### Free actions (no payment required)

```bash
# Chat / ask questions
curl -X POST https://api.sigilx.xyz/v1/jobs \
  -H "Content-Type: application/json" \
  -d '{"action": "chat", "input": "What can you verify?"}'

# Research a contract
curl -X POST https://api.sigilx.xyz/v1/jobs \
  -H "Content-Type: application/json" \
  -d '{"action": "research_contract", "input": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"}'
```

### Paid actions (x402 USDC on Base)

```bash
# Step 1: Send request without payment — get 402 challenge
curl -X POST https://api.sigilx.xyz/v1/jobs \
  -H "Content-Type: application/json" \
  -d '{"action": "verify_proof", "input": "theorem add_zero (n : Nat) : n + 0 = n := by rfl"}'

# Step 2: Sign x402 payment and resend with PAYMENT-SIGNATURE header
# The 402 response tells you: amount, asset (USDC), payTo (treasury), network (Base)
```

## Pricing

| Action | Price | What it does |
|--------|-------|-------------|
| `chat` | Free | Ask questions, get guidance |
| `research_contract` | Free | Analyze any deployed contract |
| `check_proof` | Free | Quick syntax check |
| `verify_proof` | $0.50 | Full Lean 4 typecheck + cross-verification |
| `audit_cert` | $0.50 | Re-verify an existing certificate |
| `forge_test` | $5.00 | Run Foundry test suite |
| `formal_analysis` | $5.00 | Formal property verification |
| `mainnet_fork_test` | $7.50 | Test against live mainnet state |
| `deep_audit` | $10.00 | Multi-engine comprehensive audit |
| `standard_certificate` | $25.00 | On-chain cert with 3-evaluator quorum |
| `premium_certificate` | $150.00 | BFT quorum certificate (7-13 evaluators) |

## Payment Rails

| Rail | Header | Who uses it |
|------|--------|------------|
| x402 | `PAYMENT-SIGNATURE` | Agents with wallets |
| MPP | `MPP-Authorization` | Tempo-compatible agents |
| Privy | `Authorization: Bearer <jwt>` | Human users on sigilx.xyz |

## Response Format

Every paid action returns structured JSON:

```json
{
  "ok": true,
  "jobId": "uuid",
  "status": "queued",
  "pollUrl": "https://api.sigilx.xyz/v1/jobs/{jobId}",
  "streamUrl": "https://api.sigilx.xyz/v1/jobs/{jobId}/stream",
  "jobToken": "eyJ..."
}
```

Verification results include:

```json
{
  "verdict": "PASS",
  "certHash": "0x...",
  "ipfsCid": "bafkrei...",
  "leanVersion": "4.24.0",
  "sorryCount": 0,
  "crossVerified": true
}
```

## Contracts (Base Sepolia)

| Contract | Address |
|----------|---------|
| CertificateRegistry | `0xc1c20B5507f4F27480Fe580aD7C3dE8A335caBfE` |
| SigilXJobRouter | `0xB659D06d2E06afFCAeeEd683b0997f9dd8EBA2Ee` |
| EvaluatorRegistry | `0x927ab46ffe72834591032fb259438f4314cf86c3` |
| FeeRouter | `0x010F576Ba8BA6f22c7365Eeb9E3a745327f7452F` |

## Links

- [sigilx.xyz](https://sigilx.xyz) — Try it now
- [sigilx-contracts](https://github.com/sigilxyz/sigilx-contracts) — Smart contracts
- [ERC-8183](https://eips.ethereum.org/EIPS/eip-8183) — Agentic commerce standard
- [ERC-8004](https://eips.ethereum.org/EIPS/eip-8004) — Agent identity standard

## License

MIT
