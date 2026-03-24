/**
 * SigilX Verification Skill — OpenClaw integration
 *
 * Gives the OpenClaw gateway agent the ability to call the headless
 * verification engine (Lean 4 + Foundry + Aristotle) via HTTP.
 *
 * Follows the same pattern as @agent-pulse/openclaw-skill:
 *   startup() → initializes HMAC client
 *   actions   → verify_proof, audit_cert, forge_test, full_audit, research_contract
 */
import { createHmac, randomUUID } from "node:crypto";
// ---------------------------------------------------------------------------
// HMAC Authentication
// ---------------------------------------------------------------------------
const HMAC_PREFIX = "sigilx-internal-v1";
function signRequest(secret) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = randomUUID();
  const payload = `${HMAC_PREFIX}:${timestamp}:${nonce}`;
  const signature = createHmac("sha256", secret).update(payload).digest("hex");
  return {
    "x-sigilx-auth-timestamp": timestamp,
    "x-sigilx-auth-signature": signature,
    "x-nonce": nonce,
  };
}
// ---------------------------------------------------------------------------
// Engine Client
// ---------------------------------------------------------------------------
let config = null;
function normalizeToolParams(params, toolName) {
  console.log(`[sigilx-tools] Raw params for ${toolName}:`, JSON.stringify(params).slice(0, 200));

  let normalized;

  // Case 1: string input
  if (typeof params === "string") {
    // Try parsing as JSON first
    try {
      const parsed = JSON.parse(params);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        normalized = parsed;
      } else {
        // Parsed but not an object (number, boolean, array) — wrap as content
        normalized = { content: params };
      }
    } catch {
      // Not valid JSON — treat as raw content string
      normalized = { content: params };
    }
    console.log(`[sigilx-tools] Normalized params:`, JSON.stringify(normalized).slice(0, 200));
    return normalized;
  }

  // Case 2: null, undefined, non-object, or array — wrap empty
  if (!params || typeof params !== "object" || Array.isArray(params)) {
    normalized = { content: "" };
    console.log(`[sigilx-tools] Normalized params:`, JSON.stringify(normalized).slice(0, 200));
    return normalized;
  }

  const record = params;

  // Case 3: JSON string in `arguments` or `input` wrapper
  const wrappedPayload =
    typeof record.arguments === "string"
      ? record.arguments
      : typeof record.input === "string"
        ? record.input
        : null;
  if (wrappedPayload) {
    try {
      const parsed = JSON.parse(wrappedPayload);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        normalized = parsed;
        console.log(`[sigilx-tools] Normalized params:`, JSON.stringify(normalized).slice(0, 200));
        return normalized;
      }
    } catch {
      // wrappedPayload is a plain string, not JSON — wrap as content
      normalized = { content: wrappedPayload };
      console.log(`[sigilx-tools] Normalized params:`, JSON.stringify(normalized).slice(0, 200));
      return normalized;
    }
  }

  // Case 4: nested `params` object — unwrap
  if (record.params && typeof record.params === "object" && !Array.isArray(record.params)) {
    normalized = record.params;
    console.log(`[sigilx-tools] Normalized params:`, JSON.stringify(normalized).slice(0, 200));
    return normalized;
  }

  // Case 5: flat object with known keys — pass through as-is
  normalized = record;
  console.log(`[sigilx-tools] Normalized params:`, JSON.stringify(normalized).slice(0, 200));
  return normalized;
}
function getRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value;
}
function firstNonEmptyString(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return "";
}
function resolveExecutionContext(ctx) {
  const root = getRecord(ctx);
  const request = getRecord(root?.request);
  const event = getRecord(root?.event);
  const context = getRecord(root?.context);
  const metadata = getRecord(root?.metadata);
  const requestMetadata = getRecord(request?.metadata);
  const eventMetadata = getRecord(event?.metadata);
  const sources = [
    metadata,
    context,
    requestMetadata,
    eventMetadata,
    request,
    event,
    root,
  ].filter(Boolean);
  const lookup = (...keys) =>
    firstNonEmptyString(
      ...sources.flatMap((source) => keys.map((key) => source?.[key])),
    );
  const sessionId = lookup(
    "sessionId",
    "session_id",
    "conversationId",
    "conversation_id",
  );
  return {
    context: {
      userId:
        lookup("userId", "user_id", "principalId", "principal_id") || "unknown",
      walletAddress: lookup("walletAddress", "wallet_address"),
      sessionId,
      conversationId: sessionId,
      jobToken: lookup("jobToken", "job_token"),
    },
    jobToken: lookup("jobToken", "job_token"),
  };
}
async function callEngine(command, params, context, jobToken) {
  if (!config) {
    return {
      ok: false,
      error: { message: "Skill not initialized", code: "NOT_INITIALIZED" },
    };
  }
  const requestId = randomUUID();
  const hmacHeaders = signRequest(config.hmacSecret);
  const timeoutMs = config.timeoutMs ?? 120_000;
  let normalized = normalizeToolParams(params, command);
  // SAFETY: never send empty params — skill proxy rejects them
  if (
    !normalized ||
    typeof normalized !== "object" ||
    Object.keys(normalized).length === 0
  ) {
    const fallbackContent =
      typeof params === "string" ? params : JSON.stringify(params ?? "");
    console.warn(
      `[sigilx-tools] Empty params after normalization for ${command}, using fallback content`,
    );
    normalized = { content: fallbackContent };
  }
  const body = {
    command,
    requestId,
    params: normalized,
    context,
    ...(jobToken ? { jobToken } : {}),
  };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${config.engineUrl}/skill`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-request-id": requestId,
        ...(config.proxyToken
          ? { Authorization: `Bearer ${config.proxyToken}` }
          : {}),
        ...(jobToken ? { "x-sigilx-job-token": jobToken } : {}),
        ...hmacHeaders,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const data = await res.json();
    if (!res.ok) {
      return {
        ok: false,
        error: {
          message: data.error?.message ?? `Engine returned ${res.status}`,
          code: `HTTP_${res.status}`,
        },
      };
    }
    return data;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return {
        ok: false,
        error: { message: "Verification engine timeout", code: "TIMEOUT" },
      };
    }
    const msg = err instanceof Error ? err.message : "Unknown error";
    return {
      ok: false,
      error: { message: `Engine unreachable: ${msg}`, code: "UNREACHABLE" },
    };
  } finally {
    clearTimeout(timer);
  }
}
// ---------------------------------------------------------------------------
// Skill Startup
// ---------------------------------------------------------------------------
/**
 * Called by OpenClaw runtime when the skill is initialized.
 * Reads engine URL and HMAC secret from environment.
 */
export async function startup() {
  const engineUrl = process.env.SIGILX_ENGINE_URL;
  const hmacSecret = process.env.SIGILX_INTERNAL_HMAC_SECRET;
  if (!engineUrl) {
    return { success: false, error: "SIGILX_ENGINE_URL not set" };
  }
  if (!hmacSecret || hmacSecret.length < 32) {
    return {
      success: false,
      error: "SIGILX_INTERNAL_HMAC_SECRET missing or too short (min 32 chars)",
    };
  }
  const proxyToken = process.env.SKILL_PROXY_TOKEN ?? "";
  config = {
    engineUrl: engineUrl.replace(/\/$/, ""),
    hmacSecret,
    proxyToken,
    timeoutMs: parseInt(process.env.SIGILX_ENGINE_TIMEOUT_MS ?? "120000", 10),
  };
  // Probe engine health
  try {
    const res = await fetch(`${config.engineUrl}/healthz`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      return {
        success: false,
        error: `Engine health check failed: ${res.status}`,
      };
    }
  } catch {
    return {
      success: false,
      error: `Engine unreachable at ${config.engineUrl}`,
    };
  }
  return {
    success: true,
    status: {
      engine: config.engineUrl,
      timeout: config.timeoutMs,
      healthy: true,
    },
  };
}
// ---------------------------------------------------------------------------
// Skill Actions (exposed to the OpenClaw agent as capabilities)
// ---------------------------------------------------------------------------
/**
 * Verify a Lean 4 proof via the Aristotle + cross-verify pipeline.
 * Accepts .lean file content or a theorem statement to formalize.
 */
export async function verifyProof(input, context) {
  return callEngine("verify_proof", input, context);
}
/**
 * Cross-verify an existing certificate with local Lean 4 installation.
 * Quick check — no Aristotle needed.
 */
export async function auditCert(input, context) {
  return callEngine("audit_cert", input, context);
}
/**
 * Compile and test a Solidity contract using Foundry fork tests.
 * Runs forge build + forge test against Base mainnet fork.
 */
export async function forgeTest(input, context) {
  return callEngine("forge_test", input, context);
}
/**
 * Full audit — formal verification + Foundry tests + certificate.
 * Most expensive operation. Produces an ERC-8183 on-chain attestation.
 */
export async function fullAudit(input, context) {
  return callEngine("full_audit", input, context);
}
/**
 * Research a deployed contract on Base/Ethereum.
 * Looks up exploit history, EIP compliance, and known vulnerabilities.
 */
export async function researchContract(input, context) {
  return callEngine("research_contract", input, context);
}
/**
 * Generate a DisputeKernel guard certificate.
 * Validates invariants for one of the 5 game-theoretic guards and produces
 * a Lean 4 certificate proof.
 */
export async function generateCertificate(input, context) {
  return callEngine("generate_certificate", input, context);
}
/**
 * Verify an existing DisputeKernel guard certificate.
 * Re-validates guard invariants without generating a new certificate.
 */
export async function verifyCertificate(input, context) {
  return callEngine("verify_certificate", input, context);
}
/**
 * Deep analysis — full audit at the $25 tier.
 * Formal verification + Foundry tests + certificate.
 */
export async function deepAnalysis(input, context) {
  return callEngine("deep_analysis", input, context);
}
/**
 * Standard certificate — $25 tier certificate generation.
 */
export async function standardCertificate(input, context) {
  return callEngine("standard_certificate", input, context);
}
/**
 * Premium certificate — $150 tier certificate generation.
 */
export async function premiumCertificate(input, context) {
  return callEngine("premium_certificate", input, context);
}
// ---------------------------------------------------------------------------
// Sandbox Client
// ---------------------------------------------------------------------------
async function callSandbox(method, path, body) {
  if (!config) {
    return {
      ok: false,
      error: { message: "Skill not initialized", code: "NOT_INITIALIZED" },
    };
  }
  const sandboxUrl = (
    process.env.SIGILX_SANDBOX_URL ??
    "http://sigilx-sandbox.railway.internal:8080"
  ).replace(/\/$/, "");
  const hmacHeaders = signRequest(config.hmacSecret);
  const timeoutMs = config.timeoutMs ?? 120_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const opts = {
      method,
      headers: {
        "Content-Type": "application/json",
        ...hmacHeaders,
      },
      signal: controller.signal,
    };
    if (body && method !== "GET") {
      opts.body = JSON.stringify(body);
    }
    const res = await fetch(`${sandboxUrl}${path}`, opts);
    const data = await res.json();
    if (!res.ok) {
      return {
        ok: false,
        error: {
          message: data.error?.message ?? `Sandbox returned ${res.status}`,
          code: `HTTP_${res.status}`,
        },
      };
    }
    return { ok: true, ...data };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return {
        ok: false,
        error: { message: "Sandbox request timeout", code: "TIMEOUT" },
      };
    }
    const msg = err instanceof Error ? err.message : "Unknown error";
    return {
      ok: false,
      error: { message: `Sandbox unreachable: ${msg}`, code: "UNREACHABLE" },
    };
  } finally {
    clearTimeout(timer);
  }
}
// ---------------------------------------------------------------------------
// Skill Status (for orchestrator queries)
// ---------------------------------------------------------------------------
export function getStatus() {
  return {
    skill: "sigilx-skill",
    version: "1.2.0",
    initialized: config !== null,
    engine: config?.engineUrl ?? "not configured",
    timeout: config?.timeoutMs ?? 0,
    capabilities: TOOL_DEFS.map((t) => t.name),
  };
}
const TOOL_DEFS = [
  {
    name: "verify_proof",
    command: "verify_proof",
    description: "Verify a formal proof. Returns PASS/FAIL verdict. $0.50",
    parameters: {
      type: "object",
      properties: {
        content: { type: "string", description: "Proof content (raw text)" },
        fileName: { type: "string", description: "Filename (e.g. proof.lean)" },
      },
      required: ["content"],
    },
  },
  {
    name: "audit_cert",
    command: "audit_cert",
    description: "Cross-verify an existing certificate. $0.50",
    parameters: {
      type: "object",
      properties: {
        content: { type: "string", description: "Certificate content" },
        fileName: { type: "string", description: "Certificate filename" },
      },
      required: ["content"],
    },
  },
  {
    name: "check_proof",
    command: "verify_proof",
    description: "Poll status of an in-progress proof verification. Free.",
    parameters: {
      type: "object",
      properties: {
        jobId: { type: "string", description: "Job ID to check" },
      },
      required: ["jobId"],
    },
  },
  {
    name: "research_contract",
    command: "research_contract",
    description:
      "Research a deployed contract: exploit history, EIP compliance. Free.",
    parameters: {
      type: "object",
      properties: {
        address: { type: "string", description: "Contract address (0x...)" },
        chainId: { type: "number", description: "Chain ID (8453 for Base)" },
      },
      required: ["address"],
    },
  },
  {
    name: "deep_research",
    command: "research_contract",
    description: "Extended contract research with detailed findings. Free.",
    parameters: {
      type: "object",
      properties: {
        address: { type: "string", description: "Contract address (0x...)" },
        chainId: { type: "number", description: "Chain ID" },
      },
      required: ["address"],
    },
  },
  {
    name: "forge_test",
    command: "forge_test",
    description:
      "Compile and test a Solidity contract using Foundry fork tests. $5.00",
    parameters: {
      type: "object",
      properties: {
        content: { type: "string", description: "Solidity source code" },
        fileName: { type: "string", description: "Solidity filename" },
      },
      required: ["content"],
    },
  },
  {
    name: "mainnet_fork_test",
    command: "forge_test",
    description: "Run contract tests against a live Base mainnet fork. $7.50",
    parameters: {
      type: "object",
      properties: {
        content: { type: "string", description: "Solidity source code" },
        fileName: { type: "string", description: "Solidity filename" },
      },
      required: ["content"],
    },
  },
  {
    name: "formal_analysis",
    command: "full_audit",
    description:
      "Combined formal analysis: proof verification + property testing. $5.00",
    parameters: {
      type: "object",
      properties: {
        content: {
          type: "string",
          description: "Source code or proof content",
        },
        fileName: { type: "string", description: "Source filename" },
      },
      required: ["content"],
    },
  },
  {
    name: "deep_audit",
    command: "full_audit",
    description: "Deep multi-engine audit pipeline. $10.00",
    parameters: {
      type: "object",
      properties: {
        content: { type: "string", description: "Source content" },
        fileName: { type: "string", description: "Source filename" },
      },
      required: ["content"],
    },
  },
  {
    name: "standard_certificate",
    command: "standard_certificate",
    description:
      "Full verification + permanent on-chain ERC-8183 certificate on Base. $25.00",
    parameters: {
      type: "object",
      properties: {
        content: {
          type: "string",
          description: "Source code or proof to certify",
        },
        fileName: { type: "string", description: "Source filename" },
      },
      required: ["content"],
    },
  },
  {
    name: "premium_certificate",
    command: "premium_certificate",
    description:
      "BFT quorum certificate: 5-13 evaluators verify independently. $150.00",
    parameters: {
      type: "object",
      properties: {
        content: {
          type: "string",
          description: "Source code or proof to certify",
        },
        fileName: { type: "string", description: "Source filename" },
      },
      required: ["content"],
    },
  },
  // ---- Sandbox tools ----
  {
    name: "sandbox_upload",
    command: "__sandbox__",
    description:
      "Upload a file to the user's isolated sandbox workspace. Supports .lean, .sol, .js, .ts, .json files.",
    parameters: {
      type: "object",
      properties: {
        fileName: {
          type: "string",
          description: "Destination path inside the workspace (e.g. src/Main.lean)",
        },
        content: {
          type: "string",
          description: "File content to upload (UTF-8 text)",
        },
      },
      required: ["fileName", "content"],
    },
  },
  {
    name: "sandbox_exec",
    command: "__sandbox__",
    description:
      "Run a whitelisted command (lean, lake, forge, node) in the user's sandbox workspace.",
    parameters: {
      type: "object",
      properties: {
        command: {
          type: "string",
          enum: ["lean", "lake", "forge", "node"],
          description: "Command to execute (must be one of: lean, lake, forge, node)",
        },
        args: {
          type: "array",
          items: { type: "string" },
          description: "Command arguments (e.g. ['build'] for lake build)",
        },
        cwd: {
          type: "string",
          description: "Working directory inside workspace (optional, defaults to workspace root)",
        },
      },
      required: ["command"],
    },
  },
  {
    name: "sandbox_list",
    command: "__sandbox__",
    description:
      "List files in the user's sandbox workspace. Returns file names, sizes, and modification times.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Subdirectory to list (optional, defaults to workspace root)",
        },
      },
    },
  },
  {
    name: "sandbox_status",
    command: "__sandbox__",
    description:
      "Check health and resource usage of the user's sandbox workspace.",
    parameters: {
      type: "object",
      properties: {},
    },
  },
];
/**
 * OpenClaw Plugin entry point.
 * Registers all SigilX verification tools as callable functions.
 */
export default function sigilxVerifyPlugin(api) {
  console.log(`[sigilx-verify] Plugin loading...`);
  console.log(`[sigilx-verify] SIGILX_ENGINE_URL=${process.env.SIGILX_ENGINE_URL ? 'SET' : 'MISSING'}`);
  console.log(`[sigilx-verify] SIGILX_INTERNAL_HMAC_SECRET=${process.env.SIGILX_INTERNAL_HMAC_SECRET ? `SET (${process.env.SIGILX_INTERNAL_HMAC_SECRET.length} chars)` : 'MISSING'}`);
  console.log(`[sigilx-verify] SKILL_PROXY_TOKEN=${process.env.SKILL_PROXY_TOKEN ? 'SET' : 'MISSING'}`);
  console.log(`[sigilx-verify] SIGILX_SANDBOX_URL=${process.env.SIGILX_SANDBOX_URL ?? '(default: http://sigilx-sandbox.railway.internal:8080)'}`);

  // Initialize config from env on plugin load
  const engineUrl = process.env.SIGILX_ENGINE_URL;
  const hmacSecret = process.env.SIGILX_INTERNAL_HMAC_SECRET;
  const proxyToken = process.env.SKILL_PROXY_TOKEN ?? "";
  if (engineUrl && hmacSecret && hmacSecret.length >= 32) {
    config = {
      engineUrl: engineUrl.replace(/\/$/, ""),
      hmacSecret,
      proxyToken,
      timeoutMs: parseInt(process.env.SIGILX_ENGINE_TIMEOUT_MS ?? "120000", 10),
    };
  }
  console.log(`[sigilx-verify] Config: ${config ? 'READY' : 'NOT CONFIGURED — tools will return error'}`);
  console.log(`[sigilx-verify] Registering ${TOOL_DEFS.length} tools...`);

  // Register each tool
  for (const def of TOOL_DEFS) {
    if (def.command === "__sandbox__") {
      // Sandbox tools route to the sandbox service, not the verification engine
      api.registerTool(
        (_ctx) => ({
          name: def.name,
          description: def.description,
          parameters: def.parameters,
          async execute(params) {
            if (!config) {
              return {
                type: "text",
                text: JSON.stringify({
                  ok: false,
                  error: "SigilX engine not configured",
                }),
              };
            }
            const resolved = resolveExecutionContext(_ctx);
            const { userId, sessionId } = resolved.context;
            const normalized = normalizeToolParams(params, def.name);
            let result;
            switch (def.name) {
              case "sandbox_upload":
                result = await callSandbox("POST", "/internal/sandbox/upload", {
                  userId,
                  sessionId,
                  fileName: normalized.fileName,
                  content: normalized.content,
                });
                break;
              case "sandbox_exec":
                result = await callSandbox("POST", "/internal/sandbox/exec", {
                  userId,
                  sessionId,
                  command: normalized.command,
                  args: normalized.args ?? [],
                  cwd: normalized.cwd,
                });
                break;
              case "sandbox_list":
                result = await callSandbox("POST", "/internal/sandbox/exec", {
                  userId,
                  sessionId,
                  command: "ls",
                  args: ["-la", normalized.path ?? "."],
                });
                break;
              case "sandbox_status":
                result = await callSandbox(
                  "GET",
                  `/internal/sandbox/status/${encodeURIComponent(sessionId)}`,
                  null,
                );
                break;
              default:
                result = { ok: false, error: { message: "Unknown sandbox tool", code: "UNKNOWN" } };
            }
            return { type: "text", text: JSON.stringify(result) };
          },
        }),
        { name: def.name },
      );
    } else {
      // Verification engine tools
      api.registerTool(
        (_ctx) => ({
          name: def.name,
          description: def.description,
          parameters: def.parameters,
          async execute(params) {
            if (!config) {
              return {
                type: "text",
                text: JSON.stringify({
                  ok: false,
                  error: "SigilX engine not configured",
                }),
              };
            }
            const resolved = resolveExecutionContext(_ctx);
            const result = await callEngine(
              def.command,
              params,
              resolved.context,
              resolved.jobToken,
            );
            return {
              type: "text",
              text: JSON.stringify(result),
            };
          },
        }),
        { name: def.name },
      );
    }
    console.log(`[sigilx-verify] Registered tool: ${def.name}`);
  }
  console.log(`[sigilx-verify] All ${TOOL_DEFS.length} tools registered successfully.`);
}
export const activate = sigilxVerifyPlugin;
export const register = sigilxVerifyPlugin;
