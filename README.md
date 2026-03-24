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

### Free actions

Free actions use the chat endpoint:

```bash
# Chat / ask questions
curl -X POST https://api.sigilx.xyz/v1/chat \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "What can you verify?"}]}'

# Research a contract
curl -X POST https://api.sigilx.xyz/v1/chat \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "Research contract 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"}]}'
```

### Paid actions (x402 USDC on Base)

Paid actions use the jobs endpoint. First request returns a 402 challenge:

```bash
# Step 1: Send request — get 402 with payment requirements
curl -X POST https://api.sigilx.xyz/v1/jobs \
  -H "Content-Type: application/json" \
  -d '{"action": "verify_proof", "input": "theorem add_zero (n : Nat) : n + 0 = n := by rfl"}'

# Response: 402 Payment Required
# {
#   "x402Version": 1,
#   "scheme": "exact",
#   "network": "base-sepolia",
#   "payload": {
#     "amount": "10050",
#     "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
#     "payTo": "0x010F576Ba8BA6f22c7365Eeb9E3a745327f7452F"
#   }
# }

# Step 2: Sign EIP-712 TransferWithAuthorization and resend
curl -X POST https://api.sigilx.xyz/v1/jobs \
  -H "Content-Type: application/json" \
  -H "Payment-Signature: <x402-signed-payment>" \
  -d '{"action": "verify_proof", "input": "theorem add_zero (n : Nat) : n + 0 = n := by rfl"}'
```

## Pricing

| Action | Price | What it does |
|--------|-------|-------------|
| `chat` | Free | Ask questions, get guidance |
| `research_contract` | Free | Analyze any deployed contract |
| `verify_proof` | $0.50 | Full Lean 4 typecheck + cross-verification |
| `audit_cert` | $0.50 | Re-verify an existing certificate |
| `forge_test` | $5.00 | Run Foundry test suite |
| `formal_analysis` | $5.00 | Formal property verification |
| `mainnet_fork_test` | $7.50 | Test against live mainnet state |
| `deep_audit` | $10.00 | Multi-engine comprehensive audit |
| `standard_certificate` | $25.00 | On-chain cert with 3-evaluator quorum |

## Payment Rails

| Rail | Header | Who uses it |
|------|--------|------------|
| x402 | `Payment-Signature` | Agents with wallets (USDC on Base) |
| MPP | `MPP-Authorization` | Tempo-compatible agents |
| Privy | `Authorization: Bearer <jwt>` | Human users on sigilx.xyz |

## Response Format

Paid actions return a job with polling and streaming URLs:

```json
{
  "ok": true,
  "jobId": "uuid",
  "status": "queued",
  "pollUrl": "https://api.sigilx.xyz/v1/jobs/{jobId}",
  "streamUrl": "https://api.sigilx.xyz/v1/jobs/{jobId}/stream",
  "jobToken": "eyJ...",
  "quote": {
    "serviceFee": "9000",
    "platformFee": "1000",
    "gasFee": "50",
    "total": "10050",
    "action": "verify_proof"
  }
}
```

Verification results:

```json
{
  "verdict": "PASS",
  "certHash": "0x...",
  "ipfsCid": "bafkrei...",
  "leanVersion": "4.24.0",
  "sorryCount": 0,
  "crossVerified": true,
  "verifier": "0x046a..."
}
```

## Contracts (Base Sepolia)

| Contract | Address |
|----------|---------|
| CertificateRegistryV3 | `0x90786f1A716fCae0a88bB91472B4Bf9b31794B7C` |
| SigilXJobRouter | `0xB659D06d2E06afFCAeeEd683b0997f9dd8EBA2Ee` |
| EvaluatorRegistry (USDC) | `0x927ab46ffe72834591032fb259438f4314cf86c3` |
| EvaluatorRegistry (SIGILX) | `0x0b2De5D10440b242dEDBe86Ee54588de908Cc770` |
| SigilXToken | `0x26213ff340f919ECf7D482847406A5b618Ec45f8` |
| FeeRouter | `0x010F576Ba8BA6f22c7365Eeb9E3a745327f7452F` |
| TreasuryManager | `0xBAd92A83B751F060ed452Ff9725AACBcB8eDb406` |
| SigilXEvaluatorV2 | `0xf5D04616ecA3be49feA323c205451936d7816B01` |

## Links

- [sigilx.xyz](https://sigilx.xyz) — Try it now
- [sigilx-contracts](https://github.com/sigilxyz/sigilx-contracts) — Smart contracts
- [ERC-8183](https://eips.ethereum.org/EIPS/eip-8183) — Agentic commerce standard
- [ERC-8004](https://eips.ethereum.org/EIPS/eip-8004) — Agent identity standard

## License

MIT
