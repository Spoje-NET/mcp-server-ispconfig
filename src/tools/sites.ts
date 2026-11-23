import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ISPConfigClient } from "../ispconfig-client.js";
import { registerTool } from "../register.js";
import { toJson } from "../redact.js";
import { ToolOptions } from "./types.js";

export function registerSitesTools(server: McpServer, client: ISPConfigClient, opts: ToolOptions) {
  // ── Read tools ────────────────────────────────────────────────
  // ISPConfig's *_get methods return all rows when the primary id is -1.
  // The id key must match the method's parameter name (e.g. sites_cron_get
  // takes `cron_id`, not `primary_id`).

  registerTool(
    server,
    opts,
    "web_domain_list",
    "List all web domains/sites.",
    {},
    async () => {
      const result = await client.call("sites_web_domain_get", { primary_id: -1 });
      return { content: [{ type: "text", text: toJson(result) }] };
    },
  );

  registerTool(
    server,
    opts,
    "web_domain_get",
    "Get a web domain by ID.",
    { domain_id: z.number().int().positive().describe("Web domain ID") },
    async ({ domain_id }) => {
      const result = await client.call("sites_web_domain_get", { primary_id: domain_id });
      return { content: [{ type: "text", text: toJson(result) }] };
    },
  );

  registerTool(
    server,
    opts,
    "ftp_user_list",
    "List FTP users.",
    {},
    async () => {
      const result = await client.call("sites_ftp_user_get", { primary_id: -1 });
      return { content: [{ type: "text", text: toJson(result) }] };
    },
  );

  registerTool(
    server,
    opts,
    "database_list",
    "List all databases.",
    {},
    async () => {
      const result = await client.call("sites_database_get", { primary_id: -1 });
      return { content: [{ type: "text", text: toJson(result) }] };
    },
  );

  registerTool(
    server,
    opts,
    "cron_list",
    "List all cron jobs.",
    {},
    async () => {
      // sites_cron_get's parameter is named `cron_id`, not `primary_id`.
      const result = await client.call("sites_cron_get", { cron_id: -1 });
      return { content: [{ type: "text", text: toJson(result) }] };
    },
  );

  // Everything below mutates the instance; skip it entirely in read-only mode.
  if (opts.readonly) return;

  // ── Web domains ───────────────────────────────────────────────

  registerTool(
    server,
    opts,
    "web_domain_add",
    "Create a new website/web domain.",
    {
      client_id: z.number().int().nonnegative().describe("Client ID"),
      params: z.record(z.string(), z.unknown()).describe("Site params (server_id, domain, ip_address, type, etc.)"),
    },
    async ({ client_id, params }) => {
      const result = await client.call("sites_web_domain_add", { client_id, params });
      return { content: [{ type: "text", text: `Web domain created: ${toJson(result)}` }] };
    },
  );

  registerTool(
    server,
    opts,
    "web_domain_update",
    "Update a web domain.",
    {
      client_id: z.number().int().nonnegative().describe("Client ID"),
      domain_id: z.number().int().positive().describe("Web domain ID"),
      params: z.record(z.string(), z.unknown()).describe("Fields to update"),
    },
    async ({ client_id, domain_id, params }) => {
      const result = await client.call("sites_web_domain_update", {
        client_id,
        primary_id: domain_id,
        params,
      });
      return { content: [{ type: "text", text: toJson(result) }] };
    },
  );

  registerTool(
    server,
    opts,
    "web_domain_delete",
    "Delete a web domain.",
    { domain_id: z.number().int().positive().describe("Web domain ID") },
    async ({ domain_id }) => {
      const result = await client.call("sites_web_domain_delete", { primary_id: domain_id });
      return { content: [{ type: "text", text: `Web domain deleted: ${toJson(result)}` }] };
    },
  );

  // ── Subdomains ────────────────────────────────────────────────

  registerTool(
    server,
    opts,
    "web_subdomain_add",
    "Create a subdomain.",
    {
      client_id: z.number().int().nonnegative().describe("Client ID"),
      params: z.record(z.string(), z.unknown()).describe("Subdomain params"),
    },
    async ({ client_id, params }) => {
      const result = await client.call("sites_web_subdomain_add", { client_id, params });
      return { content: [{ type: "text", text: `Subdomain created: ${toJson(result)}` }] };
    },
  );

  registerTool(
    server,
    opts,
    "web_subdomain_delete",
    "Delete a subdomain.",
    { subdomain_id: z.number().int().positive().describe("Subdomain ID") },
    async ({ subdomain_id }) => {
      const result = await client.call("sites_web_subdomain_delete", { primary_id: subdomain_id });
      return { content: [{ type: "text", text: `Subdomain deleted: ${toJson(result)}` }] };
    },
  );

  // ── Alias domains ─────────────────────────────────────────────

  registerTool(
    server,
    opts,
    "web_aliasdomain_add",
    "Create a web alias domain.",
    {
      client_id: z.number().int().nonnegative().describe("Client ID"),
      params: z.record(z.string(), z.unknown()).describe("Alias domain params"),
    },
    async ({ client_id, params }) => {
      const result = await client.call("sites_web_aliasdomain_add", { client_id, params });
      return { content: [{ type: "text", text: `Alias domain created: ${toJson(result)}` }] };
    },
  );

  // ── FTP users ─────────────────────────────────────────────────

  registerTool(
    server,
    opts,
    "ftp_user_add",
    "Create an FTP user.",
    {
      client_id: z.number().int().nonnegative().describe("Client ID"),
      params: z.record(z.string(), z.unknown()).describe("FTP user params (server_id, parent_domain_id, username, password, etc.)"),
    },
    async ({ client_id, params }) => {
      const result = await client.call("sites_ftp_user_add", { client_id, params });
      return { content: [{ type: "text", text: `FTP user created: ${toJson(result)}` }] };
    },
  );

  registerTool(
    server,
    opts,
    "ftp_user_update",
    "Update an FTP user.",
    {
      client_id: z.number().int().nonnegative().describe("Client ID"),
      user_id: z.number().int().positive().describe("FTP user ID"),
      params: z.record(z.string(), z.unknown()).describe("Fields to update"),
    },
    async ({ client_id, user_id, params }) => {
      const result = await client.call("sites_ftp_user_update", {
        client_id,
        primary_id: user_id,
        params,
      });
      return { content: [{ type: "text", text: toJson(result) }] };
    },
  );

  registerTool(
    server,
    opts,
    "ftp_user_delete",
    "Delete an FTP user.",
    { user_id: z.number().int().positive().describe("FTP user ID") },
    async ({ user_id }) => {
      const result = await client.call("sites_ftp_user_delete", { primary_id: user_id });
      return { content: [{ type: "text", text: `FTP user deleted: ${toJson(result)}` }] };
    },
  );

  // ── Shell users ───────────────────────────────────────────────

  registerTool(
    server,
    opts,
    "shell_user_add",
    "Create a shell user.",
    {
      client_id: z.number().int().nonnegative().describe("Client ID"),
      params: z.record(z.string(), z.unknown()).describe("Shell user params"),
    },
    async ({ client_id, params }) => {
      const result = await client.call("sites_shell_user_add", { client_id, params });
      return { content: [{ type: "text", text: `Shell user created: ${toJson(result)}` }] };
    },
  );

  registerTool(
    server,
    opts,
    "shell_user_delete",
    "Delete a shell user.",
    { user_id: z.number().int().positive().describe("Shell user ID") },
    async ({ user_id }) => {
      const result = await client.call("sites_shell_user_delete", { primary_id: user_id });
      return { content: [{ type: "text", text: `Shell user deleted: ${toJson(result)}` }] };
    },
  );

  // ── Databases ─────────────────────────────────────────────────

  registerTool(
    server,
    opts,
    "database_add",
    "Create a new database.",
    {
      client_id: z.number().int().nonnegative().describe("Client ID"),
      params: z.record(z.string(), z.unknown()).describe("Database params (server_id, parent_domain_id, type, database_name, etc.)"),
    },
    async ({ client_id, params }) => {
      const result = await client.call("sites_database_add", { client_id, params });
      return { content: [{ type: "text", text: `Database created: ${toJson(result)}` }] };
    },
  );

  registerTool(
    server,
    opts,
    "database_delete",
    "Delete a database.",
    { database_id: z.number().int().positive().describe("Database ID") },
    async ({ database_id }) => {
      const result = await client.call("sites_database_delete", { primary_id: database_id });
      return { content: [{ type: "text", text: `Database deleted: ${toJson(result)}` }] };
    },
  );

  // ── Cron jobs ─────────────────────────────────────────────────
  // sites_cron_update/delete take `cron_id`, not `primary_id`.

  registerTool(
    server,
    opts,
    "cron_add",
    "Create a cron job.",
    {
      client_id: z.number().int().nonnegative().describe("Client ID"),
      params: z.record(z.string(), z.unknown()).describe("Cron params (server_id, parent_domain_id, command, run_min, run_hour, etc.)"),
    },
    async ({ client_id, params }) => {
      const result = await client.call("sites_cron_add", { client_id, params });
      return { content: [{ type: "text", text: `Cron job created: ${toJson(result)}` }] };
    },
  );

  registerTool(
    server,
    opts,
    "cron_update",
    "Update a cron job.",
    {
      client_id: z.number().int().nonnegative().describe("Client ID"),
      cron_id: z.number().int().positive().describe("Cron job ID"),
      params: z.record(z.string(), z.unknown()).describe("Fields to update"),
    },
    async ({ client_id, cron_id, params }) => {
      const result = await client.call("sites_cron_update", {
        client_id,
        cron_id,
        params,
      });
      return { content: [{ type: "text", text: toJson(result) }] };
    },
  );

  registerTool(
    server,
    opts,
    "cron_delete",
    "Delete a cron job.",
    { cron_id: z.number().int().positive().describe("Cron job ID") },
    async ({ cron_id }) => {
      const result = await client.call("sites_cron_delete", { cron_id });
      return { content: [{ type: "text", text: `Cron job deleted: ${toJson(result)}` }] };
    },
  );
}
