/**
 * SigilX Skill Plugin Runtime — Handles tool execution via POST to skill proxy.
 * Each tool call gets forwarded as { command, requestId, params } to the proxy.
 */

const PROXY_URL = process.env.SIGILX_SKILL_PROXY_URL || "http://sigilx-skill-proxy.railway.internal:8080";
const PROXY_TOKEN = process.env.SKILL_PROXY_TOKEN || "";
const { randomUUID } = require("node:crypto");

/**
 * Plugin entry point — called by OpenClaw when any registered tool is invoked.
 * @param {Object} context - { toolName, args, requestId }
 */
module.exports = async function handler(context) {
  const { toolName, args, requestId: extRequestId } = context;
  const requestId = extRequestId || randomUUID();
  
  // Map tool names to commands
  const command = toolName.replace(/-/g, "_");
  
  const body = {
    command,
    requestId,
    params: args || {},
  };

  console.log(`[sigilx-tools] Executing ${command} (requestId ${requestId})`);

  try {
    const res = await fetch(`${PROXY_URL}/skill`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-request-id": requestId,
        ...(PROXY_TOKEN ? { Authorization: `Bearer ${PROXY_TOKEN}` } : {}),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(600000),
    });

    const data = await res.json().catch(() => ({
      ok: false,
      error: { code: "BAD_RESPONSE", message: "Non-JSON response from proxy" },
    }));

    if (!res.ok || !data.ok) {
      const errMsg = data?.error?.message || data?.error || `HTTP ${res.status}`;
      console.error(`[sigilx-tools] ${command} failed: ${errMsg}`);
      return { error: errMsg };
    }

    console.log(`[sigilx-tools] ${command} succeeded (requestId ${requestId})`);
    return data.result || data;
  } catch (err) {
    console.error(`[sigilx-tools] ${command} error: ${err.message}`);
    return { error: err.message };
  }
};
