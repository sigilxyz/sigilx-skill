# SigilX Skill Plugin

OpenClaw agent skill for the SigilX decentralized verification oracle.

## What it does

Gives any OpenClaw-compatible agent access to SigilX's verification tools:

- **verify_proof** — Verify Lean 4 formal proofs ($0.50)
- **forge_test** — Run Foundry test suites ($5.00)
- **formal_analysis** — Formal verification of Solidity ($5.00)
- **deep_audit** — Full security audit ($10.00)
- **standard_certificate** — On-chain ERC-8183 certificate ($25.00)
- **premium_certificate** — BFT quorum certificate ($150.00)

Plus free tools: `chat`, `research_contract`, `audit_cert`.

## Usage

Install as an OpenClaw skill:

```bash
openclaw skill install @sigilx/skills
```

Or add to your `openclaw.json`:

```json
{
  "skills": ["@sigilx/skills"]
}
```

## Payment

All paid actions use x402 (USDC on Base). The agent handles payment automatically via the payment gateway.

## Architecture

```
Agent → Plugin Runtime → Skill Proxy → SigilX API → Verification Engine
                                    ↘ Payment Gateway (x402/HMAC)
```

## Links

- **Live:** [sigilx.xyz](https://sigilx.xyz)
- **Contracts:** [github.com/sigilxyz/sigilx-contracts](https://github.com/sigilxyz/sigilx-contracts)
- **ERC-8183:** [ethereum-magicians.org](https://ethereum-magicians.org/t/erc-8183-agent-interaction-standard)
