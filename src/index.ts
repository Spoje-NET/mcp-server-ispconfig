#!/usr/bin/env node

import { createRequire } from "node:module";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ISPConfigClient } from "./ispconfig-client.js";
import { registerDnsTools } from "./tools/dns.js";
import { registerMailTools } from "./tools/mail.js";
import { registerSitesTools } from "./tools/sites.js";
import { registerClientTools } from "./tools/client.js";
import { registerMigrationTools } from "./tools/migration.js";

const { version } = createRequire(import.meta.url)("../package.json") as { version: string };

const HELP = `Usage: mcp-server-ispconfig [--help | --version]

MCP server for ISPConfig 3, speaks MCP over stdio.

Environment:
  ISPCONFIG_URL            panel URL, e.g. https://ispconfig.example.com:8080 (required)
  ISPCONFIG_USER           remote user name (required)
  ISPCONFIG_PASSWORD       remote user password (required)
  ISPCONFIG_READ_ONLY      true = register only read-only tools
  ISPCONFIG_READONLY       legacy alias of ISPCONFIG_READ_ONLY
  ISPCONFIG_INSECURE       true = skip TLS certificate verification
  ISPCONFIG_TIMEOUT        request timeout in seconds (default 30)
  ISPCONFIG_DEST_URL       destination panel URL for migrations
  ISPCONFIG_DEST_USER      destination user (default ISPCONFIG_USER)
  ISPCONFIG_DEST_PASSWORD  destination password (default ISPCONFIG_PASSWORD)`;

function getEnvOrThrow(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required environment variable: ${name}`);
    process.exit(1);
  }
  return value;
}

const isTrue = (value: string | undefined) => /^(true|1|yes|on)$/i.test(value ?? "");

async function main() {
  if (process.argv.includes("--version")) {
    console.log(version);
    return;
  }
  if (process.argv.includes("--help")) {
    console.log(HELP);
    return;
  }

  const ispconfigUrl = getEnvOrThrow("ISPCONFIG_URL");
  const ispconfigUser = getEnvOrThrow("ISPCONFIG_USER");
  const ispconfigPassword = getEnvOrThrow("ISPCONFIG_PASSWORD");
  const insecure = isTrue(process.env.ISPCONFIG_INSECURE);
  const timeoutSeconds = Number(process.env.ISPCONFIG_TIMEOUT || 30);
  if (!(timeoutSeconds > 0 && timeoutSeconds <= 600)) {
    throw new Error("ISPCONFIG_TIMEOUT must be a number of seconds between 0 and 600");
  }
  const timeoutMs = Math.ceil(timeoutSeconds * 1000);
  // When true, no create/update/delete/import tools are registered at all,
  // so the model cannot mutate the ISPConfig instance through this server.
  const readonly = isTrue(process.env.ISPCONFIG_READ_ONLY) || isTrue(process.env.ISPCONFIG_READONLY);

  // TLS verification is handled per-client inside ISPConfigClient (scoped
  // dispatcher), never via the process-global NODE_TLS_REJECT_UNAUTHORIZED.

  const client = new ISPConfigClient({
    url: ispconfigUrl,
    username: ispconfigUser,
    password: ispconfigPassword,
    insecure,
    timeoutMs,
  });

  // Optional destination instance for migrations
  let destClient: ISPConfigClient | null = null;
  if (process.env.ISPCONFIG_DEST_URL) {
    destClient = new ISPConfigClient({
      url: process.env.ISPCONFIG_DEST_URL,
      username: process.env.ISPCONFIG_DEST_USER ?? ispconfigUser,
      password: process.env.ISPCONFIG_DEST_PASSWORD ?? ispconfigPassword,
      insecure,
      timeoutMs,
    });
  }

  const server = new McpServer({
    name: "mcp-server-ispconfig",
    version,
  });

  // Register all tool groups
  const opts = { readonly };
  registerDnsTools(server, client, opts);
  registerMailTools(server, client, opts);
  registerSitesTools(server, client, opts);
  registerClientTools(server, client, opts);
  registerMigrationTools(server, client, destClient, opts);

  if (readonly) {
    console.error("mcp-server-ispconfig: running in READ-ONLY mode; write/delete/import tools are disabled.");
  }

  // Connect via stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fatal error:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
