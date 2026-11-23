// Conformance tests: annotations, read-only mode, secrets, session retry, manifest.
import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFileSync, readdirSync } from "node:fs";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { ISPConfigClient } from "../dist/ispconfig-client.js";
import { registerDnsTools } from "../dist/tools/dns.js";
import { registerMailTools } from "../dist/tools/mail.js";
import { registerMigrationTools } from "../dist/tools/migration.js";
import { MAX_OUTPUT_CHARS } from "../dist/register.js";

const ROOT = new URL("..", import.meta.url).pathname;
const PASSWORD = "s3cr3t-placeholder";

async function withServer(env, fn) {
  const client = new Client({ name: "test", version: "1" });
  await client.connect(new StdioClientTransport({
    command: process.execPath,
    args: [`${ROOT}dist/index.js`],
    env: { ISPCONFIG_URL: "http://127.0.0.1:9", ISPCONFIG_USER: "u", ISPCONFIG_PASSWORD: PASSWORD, ...env },
    stderr: "ignore",
  }));
  try { return await fn(client); } finally { await client.close(); }
}
const listTools = (env = {}) => withServer(env, async (c) => (await c.listTools()).tools);

/** HTTP mock: handler(method, params) returns the JSON reply. */
async function withApi(handler, fn) {
  const http = createServer((req, res) => {
    let body = "";
    req.on("data", (d) => (body += d));
    req.on("end", () => handler(req.url.split("?")[1], JSON.parse(body), res));
  });
  await new Promise((r) => http.listen(0, "127.0.0.1", r));
  try { return await fn(`http://127.0.0.1:${http.address().port}`); } finally {
    http.closeAllConnections();
    http.close();
  }
}
const ok = (res, response) => res.end(JSON.stringify({ code: "ok", response }));
const fault = (res, message) => res.end(JSON.stringify({ code: "remote_fault", message, response: false }));

function fake(register, client, ...rest) {
  const tools = new Map();
  register({ registerTool: (name, _c, h) => tools.set(name, h) }, client, ...rest);
  return tools;
}

test("every tool has title, description, described parameters and four hints", async () => {
  const tools = await listTools();
  assert.equal(tools.length, 62);
  for (const t of tools) {
    assert.ok(t.title && t.title !== t.name, t.name);
    assert.ok(t.description, t.name);
    for (const [p, schema] of Object.entries(t.inputSchema.properties ?? {})) assert.ok(schema.description, `${t.name}.${p}`);
    for (const h of ["readOnlyHint", "destructiveHint", "idempotentHint", "openWorldHint"]) {
      assert.equal(typeof t.annotations?.[h], "boolean", `${t.name} ${h}`);
    }
    assert.ok(!(t.annotations.readOnlyHint && t.annotations.destructiveHint), t.name);
    if (/_(get|list)(_|$)/.test(t.name)) assert.ok(t.annotations.readOnlyHint, t.name);
    if (/_(add|update|delete|import)(_|$)/.test(t.name)) assert.ok(!t.annotations.readOnlyHint, t.name);
    if (/delete/.test(t.name)) assert.ok(t.annotations.destructiveHint, t.name);
  }
});

for (const name of ["ISPCONFIG_READ_ONLY", "ISPCONFIG_READONLY"]) {
  test(`${name}=true registers only read-only tools`, async () => {
    const tools = await listTools({ [name]: "true" });
    assert.ok(tools.length > 0);
    assert.deepEqual(tools.filter((t) => !t.annotations.readOnlyHint).map((t) => t.name), []);
  });
}

test("connection errors reach the client without the password", async () => {
  await withServer({}, async (c) => {
    const r = await c.callTool({ name: "mail_domain_list", arguments: {} });
    assert.ok(r.isError);
    assert.ok(!JSON.stringify(r).includes(PASSWORD));
  });
});

test("fault messages are scrubbed and expired sessions retried exactly once", async () => {
  let logins = 0, calls = 0;
  await withApi((method, params, res) => {
    if (method === "login") { logins++; return ok(res, `session${logins}`); }
    calls++;
    if (params.session_id === "session1") return fault(res, "The Session is expired or does not exist.");
    if (method === "boom") return fault(res, `bad ${PASSWORD} ${params.session_id}`);
    return ok(res, [1]);
  }, async (url) => {
    const c = new ISPConfigClient({ url, username: "u", password: PASSWORD });
    assert.deepEqual(await c.call("mail_domain_get"), [1]);
    assert.deepEqual([logins, calls], [2, 2]);
    await assert.rejects(c.call("boom"), (e) => !e.message.includes(PASSWORD) && !e.message.includes("session2"));
  });
});

test("requests time out, redirects are refused, bad URLs and methods rejected", async () => {
  await withApi(() => {}, async (url) => {
    const c = new ISPConfigClient({ url, username: "u", password: PASSWORD, timeoutMs: 100 });
    await assert.rejects(c.login(), /timed out/);
  });
  await withApi((_m, _p, res) => res.writeHead(307, { location: "/x" }).end(), async (url) => {
    await assert.rejects(new ISPConfigClient({ url, username: "u", password: PASSWORD }).login(), /request failed/);
  });
  assert.throws(() => new ISPConfigClient({ url: "file:///etc/passwd", username: "u", password: "p" }));
  assert.throws(() => new ISPConfigClient({ url: "https://a:b@h", username: "u", password: "p" }));
});

test("read results are redacted and truncated", async () => {
  const rows = { password: "$6$hash", nested: [{ dkim_private: "KEY" }], email: "a@b" };
  let tools = fake(registerMailTools, { call: async () => rows }, { readonly: true });
  const text = (await tools.get("mail_user_get")({ user_id: 1 })).content[0].text;
  assert.ok(!text.includes("$6$hash") && !text.includes("KEY") && text.includes("a@b"));
  tools = fake(registerMailTools, { call: async () => "x".repeat(MAX_OUTPUT_CHARS * 2) }, { readonly: true });
  assert.match((await tools.get("mail_domain_list")({})).content[0].text, /TRUNCATED/);
});

test("a redacted placeholder cannot be written back", async () => {
  const tools = fake(registerMailTools, { call: async () => assert.fail("must not be called") }, { readonly: false });
  await assert.rejects(tools.get("mail_user_update")({ client_id: 1, user_id: 1, params: { password: "***REDACTED***" } }), /redacted/);
});

test("dns_zone_list asks for all zones", async () => {
  const calls = [];
  const tools = fake(registerDnsTools, { call: async (...a) => { calls.push(a); return []; } }, { readonly: true });
  await tools.get("dns_zone_list")({});
  assert.deepEqual(calls, [["dns_zone_get", { primary_id: -1 }]]);
});

test("import needs a destination and replaces redacted passwords", async () => {
  const source = { call: async (m) => (m === "mail_domain_get" ? { domain: "e.com", dkim_private: "K" } : m === "mail_user_get" ? [{ email: "a@e.com", password: "h" }] : []) };
  const exported = (await fake(registerMigrationTools, source, null, { readonly: false })
    .get("migrate_export_mail_domain")({ domain_id: 1, include_secrets: false })).content[0].text;
  const args = { bundle_json: exported, dest_server_id: 1, dest_client_id: 0 };
  await assert.rejects(fake(registerMigrationTools, source, null, { readonly: false }).get("migrate_import_mail_domain")(args), /No destination/);

  const calls = {};
  const dest = { call: async (m, p) => { calls[m] = p.params; return 1; } };
  await fake(registerMigrationTools, source, dest, { readonly: false }).get("migrate_import_mail_domain")(args);
  assert.ok(!("dkim_private" in calls.mail_domain_add));
  assert.ok(calls.mail_user_add.password.length >= 32 && !calls.mail_user_add.password.includes("REDACTED"));
});

test("read-only mode refuses to export secrets", async () => {
  const source = { call: async () => [] };
  const tools = fake(registerMigrationTools, source, null, { readonly: true });
  for (const [name, arg] of [["dns_zone", "zone_id"], ["mail_domain", "domain_id"], ["web_domain", "domain_id"], ["client", "client_id"]]) {
    await assert.rejects(tools.get(`migrate_export_${name}`)({ [arg]: 1, include_secrets: true }), /read-only/);
  }
});

test("import only calls allowlisted DNS record methods", async () => {
  const calls = [];
  const dest = { call: async (m) => { calls.push(m); return 1; } };
  const tools = fake(registerMigrationTools, dest, dest, { readonly: false });
  const bundle_json = JSON.stringify({ type: "dns_zone", data: {}, children: { a: [{}], slave: [{}], templatezone: [{}], zone: [{}] } });
  await tools.get("migrate_import_dns_zone")({ bundle_json, dest_server_id: 1, dest_client_id: 0 });
  assert.deepEqual(calls, ["dns_zone_add", "dns_a_add"]);
});

test("generated commands reject shell metacharacters", async () => {
  await withServer({}, async (c) => {
    const r = await c.callTool({ name: "migrate_data_commands", arguments: { type: "mail", domain: "a;rm -rf /", source_host: "a", dest_host: "b" } });
    assert.ok(r.isError);
  });
});

test("server.json lists exactly the served tools and the used environment", async () => {
  const manifest = JSON.parse(readFileSync(`${ROOT}server.json`, "utf8"));
  const ours = manifest._meta["io.modelcontextprotocol.registry/publisher-provided"]["cz.vitexsoftware.mcp"];
  assert.equal(ours.uuid, "06c079e9-bf92-4732-9b8e-377aa7a96464");
  assert.deepEqual(ours.tools.map((t) => t.name).sort(), (await listTools()).map((t) => t.name).sort());
  const used = new Set();
  for (const f of readdirSync(`${ROOT}src`, { recursive: true }).filter((f) => f.endsWith(".ts"))) {
    for (const [v] of readFileSync(`${ROOT}src/${f}`, "utf8").matchAll(/ISPCONFIG_[A-Z_]+/g)) used.add(v);
  }
  const declared = manifest.packages[0].environmentVariables.map((v) => v.name);
  assert.deepEqual(declared.sort(), [...used].sort());
  const readme = readFileSync(`${ROOT}README.md`, "utf8");
  for (const v of declared) assert.ok(readme.includes(`| \`${v}\``), `${v} in README table`);
  const { version } = JSON.parse(readFileSync(`${ROOT}package.json`, "utf8"));
  assert.equal(manifest.version, version);
});
