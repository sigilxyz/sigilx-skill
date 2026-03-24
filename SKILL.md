---
name: "@sigilx/skills"
description: Decentralized verification oracle for smart contracts and mathematical proofs. Verify code, get on-chain ERC-8183 certificates, query reputation via ERC-8004. Accepts x402 payments (USDC on Base).
metadata:
  {
    "openclaw":
      {
        "emoji": "🔬",
        "homepage": "https://sigilx.xyz",
        "primaryEnv": "SIGILX_ENGINE_URL",
        "requires": { "env": ["SIGILX_ENGINE_URL", "SIGILX_INTERNAL_HMAC_SECRET", "SKILL_PROXY_TOKEN"] },
      },
  }
---

# SigilX — Decentralized Verification Oracle

Verify smart contracts and mathematical proofs. Get on-chain certificates. Pay with USDC.

**API:** `https://api.sigilx.xyz`
**Frontend:** https://sigilx.xyz
**Certificates:** ERC-8183 on Base
**Reputation:** ERC-8004 on Base

---

## Quick Start

SigilX works with natural language. Send a prompt, optionally attach a file, include a payment header for paid actions. That's it.

### Free — no payment header needed

```bash
curl -X POST "https://api.sigilx.xyz/v1/chat" \
  -H "Content-Type: application/json" \
  -d '{"message": "Is 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 safe to interact with?"}'
```

### Paid — include one payment header

```bash
curl -X POST "https://api.sigilx.xyz/v1/jobs" \
  -H "Content-Type: application/json" \
  -H "PAYMENT-SIGNATURE: <base64-encoded x402 proof>" \
  -d '{
    "action": "formal_analysis",
    "input": "// SPDX-License-Identifier: MIT\npragma solidity ^0.8.20;\n\ncontract MyToken { ... }",
    "fileName": "MyToken.sol"
  }'
```

```bash
# Poll until done
curl "https://api.sigilx.xyz/v1/jobs/job_abc123"
```

Pay with USDC on Base via the x402 protocol. No API key, no account, no signup.

---

## Actions & Pricing

All prices in USDC. Same actions, same prices, regardless of payment rail.

| Action                 | Price   | Input            | Output                        |
| ---------------------- | ------- | ---------------- | ----------------------------- |
| `chat`                 | Free    | Natural language | Conversational response       |
| `research_contract`    | Free    | Contract address | Exploit history, EIP analysis |
| `verify_proof`         | $0.50   | Source code      | PASS / FAIL verdict           |
| `audit_cert`           | $0.50   | Certificate hash | Cross-verification result     |
| `forge_test`           | $5.00   | Solidity source  | Test results + gas report     |
| `formal_analysis`      | $5.00   | Solidity source  | Formal analysis report        |
| `mainnet_fork_test`    | $7.50   | Solidity source  | Fork test results             |
| `deep_audit`           | $10.00  | Source code      | Full audit report             |
| `standard_certificate` | $25.00  | Verified source  | On-chain ERC-8183 certificate |
| `premium_certificate`  | $150.00 | Verified source  | BFT quorum certificate        |

**World ID discount:** 20% off tooling actions for World ID verified callers. Certificates are full price (evaluator economics require it).

**Aliases:** `full_audit` → `formal_analysis`, `deep_analysis` → `deep_audit`, `certificate_mint` → `standard_certificate`.

---

## API Endpoints

### Chat — Conversational (Streaming)

Natural language interface. Describe what you want. The agent figures out which tools to use.

```
POST https://api.sigilx.xyz/v1/chat
Content-Type: application/json
```

```json
{
  "message": "Run a deep audit on this ERC-20 contract",
  "fileContent": "<solidity source code>",
  "fileName": "MyToken.sol",
  "threadId": "thr_optional"
}
```

Returns a streaming SSE response. Pass `threadId` from the response to continue a conversation.

Free actions (`chat`, `research_contract`) require no payment headers. Paid actions require exactly one payment header (see Payment Rails below).

### Jobs — Structured (Async)

For automated pipelines. Submit an action, poll for results.

```
POST https://api.sigilx.xyz/v1/jobs
Content-Type: application/json
```

```json
{
  "action": "formal_analysis",
  "input": "<source code or contract address>",
  "fileName": "MyContract.sol"
}
```

**Poll:**

```
GET https://api.sigilx.xyz/v1/jobs/{jobId}
```

**Stream (SSE):**

```
GET https://api.sigilx.xyz/v1/jobs/{jobId}/stream
```

**Job statuses:** `pending` → `running` → `completed` | `failed`

**Completed response:**

```json
{
  "jobId": "job_abc123",
  "status": "completed",
  "action": "formal_analysis",
  "result": {
    "verdict": "PASS",
    "report": "...",
    "certificateHash": "0x...",
    "txHash": "0x...",
    "certificateUrl": "https://sigilx.xyz/cert/job_abc123"
  },
  "quote": {
    "serviceFee": "4500000",
    "platformFee": "500000",
    "gasFee": "50",
    "total": "5000050",
    "breakdown": "Service: $4.50 + Platform: $0.50 + Gas: $0.00",
    "action": "formal_analysis"
  }
}
```

---

## Payment — x402 (USDC on Base)

Any agent with a Base wallet can pay per-request. No API key, no account, no signup.

**Header:** `PAYMENT-SIGNATURE`

**Flow:**

1. Make a request without payment — get a `402` response with payment requirements.
2. Sign a USDC payment matching the required amount.
3. Base64-encode the signed payment.
4. Retry the request with the `PAYMENT-SIGNATURE` header.

**Payment parameters:**

| Field               | Value                                                  |
| ------------------- | ------------------------------------------------------ |
| `scheme`            | `exact`                                                |
| `network`           | `eip155:8453`                                          |
| `asset`             | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`           |
| `payTo`             | Returned in 402 response `accepts[0].payTo`            |
| `maxTimeoutSeconds` | `30`                                                   |
| `amount`            | Action price in atomic USDC (e.g. `5000000` for $5.00) |

**Example (TypeScript with @x402 SDK):**

```typescript
import { x402Client } from "@x402/core/client";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { wrapFetchWithPayment } from "@x402/fetch";
import { privateKeyToAccount } from "viem/accounts";

// Create an x402 client with your wallet
const client = new x402Client();
client.register("eip155:*", new ExactEvmScheme(
  privateKeyToAccount(process.env.PRIVATE_KEY)
));

// Wrap fetch — 402 responses are handled automatically
const fetchWithPayment = wrapFetchWithPayment(fetch, client);

// Just call the API — payment happens transparently
const res = await fetchWithPayment("https://api.sigilx.xyz/v1/jobs", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    action: "formal_analysis",
    input: soliditySource,
    fileName: "MyContract.sol",
  }),
});

const job = await res.json();
console.log(job.jobId, job.status);
```

**402 response shape:**

```json
{
  "x402Version": 1,
  "error": "Payment required",
  "resource": {
    "url": "https://api.sigilx.xyz/v1/jobs",
    "description": "formal_analysis — $5.00 USDC",
    "mimeType": "application/json"
  },
  "accepts": [
    {
      "scheme": "exact",
      "network": "eip155:8453",
      "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      "amount": "5000000",
      "payTo": "0x...",
      "maxTimeoutSeconds": 30
    }
  ]
}
```

**Coming soon:** MPP (Tempo/Stripe) and ACP (Virtuals Protocol) payment rails.

---

## Fee Structure

Every paid action returns a quote breakdown:

```json
{
  "quote": {
    "serviceFee": "4500000",
    "platformFee": "500000",
    "gasFee": "50",
    "total": "5000050",
    "breakdown": "Service: $4.50 + Platform: $0.50 + Gas: $0.00",
    "action": "formal_analysis"
  }
}
```

- **Service fee:** 90% of action price
- **Platform fee:** 10% of action price (rounded up)
- **Gas fee:** ~$0.00005 fixed estimate for Base L2 operations

All amounts in USDC atomic units (6 decimals: 1,000,000 = $1.00).

---

## On-Chain Certificates

Verified work receives immutable ERC-8183 certificates on Base.

- **Standard ($25)** — single-evaluator formal verification + on-chain certificate
- **Premium ($150)** — BFT evaluator quorum: 5-13 independent evaluators selected via VRF, staked with slashing

Certificates are non-transferable and bound to the verified artifact. Any agent can query:

```solidity
CertificateRegistry.isVerified(bytes32 certHash) → bool
```

**Contract addresses (Base Sepolia 84532):**

| Contract             | Address                                      |
| -------------------- | -------------------------------------------- |
| CertificateRegistry  | `0xc1c20B5507f4F27480Fe580aD7C3dE8A335caBfE` |
| EvaluatorRegistry    | `0x2c0F572Fbcb24FD9b5ebFb768678D6f725344919` |
| SigilXEvaluatorV2    | `0xf5D04616ecA3be49feA323c205451936d7816B01` |
| OptimisticEscrow     | `0xdaE8a643C10392cD85376F999808E8eb67d00757` |
| SigilXToken (SIGILX) | `0x26213ff340f919ECf7D482847406A5b618Ec45f8` |

---

## Accepted Inputs

| Extension | Type               | Example          |
| --------- | ------------------ | ---------------- |
| .sol      | Solidity contracts | MyToken.sol      |
| .lean     | Formal proofs      | Invariant.lean   |
| .tex      | LaTeX papers       | proof-sketch.tex |
| .pdf      | Documents          | audit-report.pdf |
| .txt      | Natural language   | requirements.txt |

Or paste code inline — no file required.

---

## Error Handling

| HTTP | Meaning          | Action                                           |
| ---- | ---------------- | ------------------------------------------------ |
| 200  | Success          | Process result                                   |
| 402  | Payment required | Decode `x-payment-required` header, sign and pay |
| 403  | Unauthorized     | Check payment amount meets action price          |
| 404  | Not found        | Check job ID or endpoint path                    |
| 429  | Rate limited     | Wait and retry with exponential backoff          |
| 500  | Server error     | Retry once, then report                          |

**Error response:**

```json
{
  "error": "payment_required",
  "code": "PAYMENT_REQUIRED",
  "message": "This action requires $5.00 USDC",
  "requiredAmount": "5000000",
  "currency": "USDC",
  "chain": "base",
  "retryable": false,
  "docsUrl": "https://sigilx.xyz/docs/payments"
}
```

---

## Chains

| Chain        | ID    | Status  |
| ------------ | ----- | ------- |
| Base Sepolia | 84532 | Live    |
| Base         | 8453  | Pending |

Default to Base Sepolia (84532) during testnet phase.

---

## Safety

- SigilX never stores your private keys or wallet credentials
- x402 payments are settled atomically — pay only when verification succeeds
- All certificates are immutable on-chain — no one can revoke or alter them
- Job scope tokens expire after 48 hours
- Free tier: 10 messages per 24-hour window per wallet/IP
- Use a dedicated wallet with limited funds for autonomous agents

---

## Security & Credentials

| Variable | Purpose | Required |
|---|---|---|
| `SIGILX_ENGINE_URL` | Base URL of the SigilX verification engine API | Yes |
| `SIGILX_INTERNAL_HMAC_SECRET` | HMAC signing secret for authenticated requests (min 32 chars) | Yes |
| `SKILL_PROXY_TOKEN` | Bearer token for skill proxy authentication | Yes |
| `SIGILX_ENGINE_TIMEOUT_MS` | Request timeout in milliseconds (default: 120000) | No |

All credentials must be set in your OpenClaw runtime environment. Never embed secrets in skill JSON `env` blocks or commit them to source control.

## Network Access

This skill makes HTTPS requests **only** to the URL configured in `SIGILX_ENGINE_URL`. No data is sent to any other endpoint. All requests are HMAC-signed for mutual authentication between the agent runtime and the SigilX engine.

## Resources

- **Frontend:** https://sigilx.xyz
- **API:** https://api.sigilx.xyz
- **Contracts:** https://github.com/sigilxyz/sigilx-contracts
- **ERC-8183 spec:** https://eips.ethereum.org/EIPS/eip-8183
- **ERC-8004 spec:** https://eips.ethereum.org/EIPS/eip-8004
