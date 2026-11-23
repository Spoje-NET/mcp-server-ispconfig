import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ISPConfigClient } from "../ispconfig-client.js";
import { registerTool } from "../register.js";
import { toJson } from "../redact.js";
import { ToolOptions } from "./types.js";

export function registerClientTools(server: McpServer, client: ISPConfigClient, opts: ToolOptions) {
  // ── Read tools ────────────────────────────────────────────────

  registerTool(
    server,
    opts,
    "client_get",
    "Get client details by ID.",
    { client_id: z.number().int().nonnegative().describe("Client ID") },
    async ({ client_id }) => {
      const result = await client.call("client_get", { client_id });
      return { content: [{ type: "text", text: toJson(result) }] };
    },
  );

  registerTool(
    server,
    opts,
    "server_get",
    "Get server information.",
    {
      server_id: z.number().int().nonnegative().describe("Server ID"),
      section: z.string().default("").describe("Config section (empty for all)"),
    },
    async ({ server_id, section }) => {
      const result = await client.call("server_get", { server_id, section });
      return { content: [{ type: "text", text: toJson(result) }] };
    },
  );

  registerTool(
    server,
    opts,
    "server_get_by_ip",
    "Find server by IP address.",
    { ip: z.string().max(45).describe("IP address") },
    async ({ ip }) => {
      const result = await client.call("server_get_serverid_by_ip", { ipaddress: ip });
      return { content: [{ type: "text", text: toJson(result) }] };
    },
  );

  // Everything below can mutate the instance; skip it entirely in read-only
  // mode. api_call is included because it can invoke any write method.
  if (opts.readonly) return;

  registerTool(
    server,
    opts,
    "client_add",
    "Create a new client.",
    {
      reseller_id: z.number().int().nonnegative().describe("Reseller ID (0 for admin)"),
      params: z.record(z.string(), z.unknown()).describe("Client params (company_name, contact_name, username, password, email, etc.)"),
    },
    async ({ reseller_id, params }) => {
      const result = await client.call("client_add", { reseller_id, params });
      return { content: [{ type: "text", text: `Client created: ${toJson(result)}` }] };
    },
  );

  registerTool(
    server,
    opts,
    "client_update",
    "Update a client.",
    {
      client_id: z.number().int().nonnegative().describe("Client ID"),
      reseller_id: z.number().int().nonnegative().describe("Reseller ID"),
      params: z.record(z.string(), z.unknown()).describe("Fields to update"),
    },
    async ({ client_id, reseller_id, params }) => {
      const result = await client.call("client_update", {
        client_id,
        reseller_id,
        params,
      });
      return { content: [{ type: "text", text: toJson(result) }] };
    },
  );

  registerTool(
    server,
    opts,
    "client_delete",
    "Delete a client.",
    { client_id: z.number().int().nonnegative().describe("Client ID") },
    async ({ client_id }) => {
      const result = await client.call("client_delete", { client_id });
      return { content: [{ type: "text", text: `Client deleted: ${toJson(result)}` }] };
    },
  );

  // --- Generic API call (escape hatch) ---

  registerTool(
    server,
    opts,
    "api_call",
    "Call any ISPConfig API method directly (escape hatch for methods not covered by other tools). NOTE: can invoke destructive operations; disabled when ISPCONFIG_READ_ONLY=true.",
    {
      method: z.string().regex(/^[a-z][a-z0-9_]*$/).max(100).describe("API method name (e.g. 'mail_fetchmail_add')"),
      params: z.record(z.string(), z.unknown()).default({}).describe("Method parameters"),
    },
    async ({ method, params }) => {
      if (method === "login" || method === "logout") {
        throw new Error("Sessions are managed by the server; login/logout cannot be called.");
      }
      const result = await client.call(method, params);
      return { content: [{ type: "text", text: toJson(result) }] };
    },
  );
}
