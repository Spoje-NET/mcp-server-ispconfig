import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ISPConfigClient } from "../ispconfig-client.js";
import { registerTool } from "../register.js";
import { toJson } from "../redact.js";
import { ToolOptions } from "./types.js";

/** DNS record types supported by ISPConfig */
const DNS_RECORD_TYPES = [
  "a", "aaaa", "alias", "cname", "hinfo", "mx", "ns", "ptr", "srv", "txt",
] as const;

export function registerDnsTools(server: McpServer, client: ISPConfigClient, opts: ToolOptions) {
  // --- Zones ---

  registerTool(
    server,
    opts,
    "dns_zone_list",
    "List all DNS zones.",
    {},
    async () => {
      const result = await client.call("dns_zone_get", { primary_id: -1 });
      return { content: [{ type: "text", text: toJson(result) }] };
    },
  );

  registerTool(
    server,
    opts,
    "dns_zone_get",
    "Get a DNS zone by ID.",
    { zone_id: z.number().int().positive().describe("The zone ID") },
    async ({ zone_id }) => {
      const result = await client.call("dns_zone_get", { primary_id: zone_id });
      return { content: [{ type: "text", text: toJson(result) }] };
    },
  );

  registerTool(
    server,
    opts,
    "dns_record_get",
    "Get a DNS record by type and ID.",
    {
      type: z.enum(DNS_RECORD_TYPES).describe("Record type (a, aaaa, cname, mx, txt, etc.)"),
      record_id: z.number().int().positive().describe("Record ID"),
    },
    async ({ type, record_id }) => {
      const result = await client.call(`dns_${type}_get`, { primary_id: record_id });
      return { content: [{ type: "text", text: toJson(result) }] };
    },
  );

  // Everything below mutates the instance; skip it entirely in read-only mode.
  if (opts.readonly) return;

  registerTool(
    server,
    opts,
    "dns_zone_add",
    "Create a new DNS zone.",
    {
      server_id: z.number().int().nonnegative().describe("Server ID"),
      client_id: z.number().int().nonnegative().describe("Client ID (0 for admin)"),
      origin: z.string().describe("Zone origin (e.g. example.com.)"),
      ns: z.string().describe("Primary nameserver"),
      mbox: z.string().describe("Admin email in DNS format (admin.example.com.)"),
      ttl: z.number().int().positive().default(3600).describe("Default TTL"),
      refresh: z.number().int().positive().default(7200).describe("SOA refresh interval in seconds"),
      retry: z.number().int().positive().default(540).describe("SOA retry interval in seconds"),
      expire: z.number().int().positive().default(604800).describe("SOA expire time in seconds"),
      minimum: z.number().int().positive().default(86400).describe("Negative-caching TTL in seconds"),
      active: z.enum(["y", "n"]).default("y").describe("Whether the zone is active"),
    },
    async (params) => {
      const { server_id, client_id, ...zoneParams } = params;
      const result = await client.call("dns_zone_add", {
        client_id,
        params: { server_id, ...zoneParams },
      });
      return { content: [{ type: "text", text: `Zone created with ID: ${toJson(result)}` }] };
    },
  );

  registerTool(
    server,
    opts,
    "dns_zone_update",
    "Update an existing DNS zone.",
    {
      zone_id: z.number().int().positive().describe("Zone ID to update"),
      client_id: z.number().int().nonnegative().describe("Client ID"),
      params: z.record(z.string(), z.unknown()).describe("Fields to update"),
    },
    async ({ zone_id, client_id, params }) => {
      const result = await client.call("dns_zone_update", {
        client_id,
        primary_id: zone_id,
        params,
      });
      return { content: [{ type: "text", text: toJson(result) }] };
    },
  );

  registerTool(
    server,
    opts,
    "dns_zone_delete",
    "Delete a DNS zone.",
    { zone_id: z.number().int().positive().describe("Zone ID to delete") },
    async ({ zone_id }) => {
      const result = await client.call("dns_zone_delete", { primary_id: zone_id });
      return { content: [{ type: "text", text: `Zone deleted: ${toJson(result)}` }] };
    },
  );

  // --- Records (generic for all record types) ---

  registerTool(
    server,
    opts,
    "dns_record_add",
    "Add a DNS record to a zone.",
    {
      type: z.enum(DNS_RECORD_TYPES).describe("Record type"),
      client_id: z.number().int().nonnegative().describe("Client ID"),
      params: z.record(z.string(), z.unknown()).describe("Record parameters (zone, name, data, ttl, etc.)"),
    },
    async ({ type, client_id, params }) => {
      const result = await client.call(`dns_${type}_add`, { client_id, params });
      return { content: [{ type: "text", text: `Record created: ${toJson(result)}` }] };
    },
  );

  registerTool(
    server,
    opts,
    "dns_record_update",
    "Update a DNS record.",
    {
      type: z.enum(DNS_RECORD_TYPES).describe("Record type"),
      record_id: z.number().int().positive().describe("Record ID"),
      client_id: z.number().int().nonnegative().describe("Client ID"),
      params: z.record(z.string(), z.unknown()).describe("Fields to update"),
    },
    async ({ type, record_id, client_id, params }) => {
      const result = await client.call(`dns_${type}_update`, {
        client_id,
        primary_id: record_id,
        params,
      });
      return { content: [{ type: "text", text: toJson(result) }] };
    },
  );

  registerTool(
    server,
    opts,
    "dns_record_delete",
    "Delete a DNS record.",
    {
      type: z.enum(DNS_RECORD_TYPES).describe("Record type"),
      record_id: z.number().int().positive().describe("Record ID"),
    },
    async ({ type, record_id }) => {
      const result = await client.call(`dns_${type}_delete`, { primary_id: record_id });
      return { content: [{ type: "text", text: `Record deleted: ${toJson(result)}` }] };
    },
  );
}
