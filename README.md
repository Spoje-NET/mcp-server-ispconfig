# mcp-server-ispconfig

MCP (Model Context Protocol) server for [ISPConfig 3](https://www.ispconfig.org/) — manage DNS zones, mail domains, websites, databases, FTP users, cron jobs, and more through AI assistants like Claude.

## Features

- **DNS Management** — zones, A/AAAA/CNAME/MX/NS/TXT/SRV/PTR records
- **Mail Management** — domains, mailboxes, aliases, forwards, catchall, spamfilter
- **Site Management** — web domains, subdomains, alias domains
- **Database Management** — create/delete MySQL databases
- **FTP & Shell Users** — create and manage access accounts
- **Cron Jobs** — schedule and manage cron tasks
- **Client Management** — create/update/delete ISPConfig clients
- **Server Info** — query server details by ID or IP
- **Generic API Call** — escape hatch for any of the ~246 ISPConfig API methods
- **Server Migration** — export/import DNS zones, mail domains, websites, databases between ISPConfig instances

## Installation

From the VitexSoftware repository (<http://repo.vitexsoftware.com/>):

```bash
sudo apt install mcp-server-ispconfig
# optional: register the server in the local mcprack (read-only by default)
sudo apt install mcprack-mcp-server-ispconfig
```

An ISPConfig 3 installation with the Remote API enabled is required.
Run `mcp-server-ispconfig --help` for the options; the server speaks MCP over stdio.

## Configuration

| Variable | Required | Secret | Description |
|---|---|---|---|
| `ISPCONFIG_URL` | yes | no | ISPConfig panel URL, e.g. https://ispconfig.example.com:8080 |
| `ISPCONFIG_USER` | yes | no | Remote user name (System > Remote Users) |
| `ISPCONFIG_PASSWORD` | yes | **secret** | Remote user password |
| `ISPCONFIG_READ_ONLY` | no | no | Register only read-only tools |
| `ISPCONFIG_READONLY` | no | no | Legacy alias of ISPCONFIG_READ_ONLY |
| `ISPCONFIG_INSECURE` | no | no | Skip TLS certificate verification (not recommended) |
| `ISPCONFIG_TIMEOUT` | no | no | Request timeout in seconds |
| `ISPCONFIG_DEST_URL` | no | no | Destination panel URL for migrations |
| `ISPCONFIG_DEST_USER` | no | no | Destination remote user (default: ISPCONFIG_USER) |
| `ISPCONFIG_DEST_PASSWORD` | no | **secret** | Destination password (default: ISPCONFIG_PASSWORD) |

```json
{
  "mcpServers": {
    "ispconfig": {
      "command": "/usr/bin/mcp-server-ispconfig",
      "env": {
        "ISPCONFIG_URL": "https://your-server:8080",
        "ISPCONFIG_USER": "api_user",
        "ISPCONFIG_PASSWORD": "your_password",
        "ISPCONFIG_READ_ONLY": "true"
      }
    }
  }
}
```

### Read-only mode

With `ISPCONFIG_READ_ONLY=true` no tool that changes anything is registered, including `api_call`.

### Safety

- Passwords, hashes and private keys are redacted in all results; only `migrate_export_*` with `include_secrets=true` returns them, and not in read-only mode.
- Redacted placeholders are refused by writing tools. On import, redacted passwords become random values that must be reset.
- Requests have a timeout, responses are limited to 20 MB and tool output to 100 000 characters.
- Imports require `ISPCONFIG_DEST_URL`.

## ISPConfig Setup

1. Log into ISPConfig panel → **System** → **Remote Users**
2. Create a new remote user with API access
3. Grant **only** the functions this integration needs — do not grant all.
   The `api_call` escape hatch and the write tools can only reach methods this
   remote user is permitted to use, so a narrow permission set is your main
   guardrail. Combine with `ISPCONFIG_READ_ONLY=true` for read-only use.
4. Use these credentials as `ISPCONFIG_USER` / `ISPCONFIG_PASSWORD`

## Available Tools

### DNS

| Tool | Class | Description |
|------|-------|-------------|
| `dns_zone_list` | READ_ONLY | List all DNS zones |
| `dns_zone_get` | READ_ONLY | Get zone details by ID |
| `dns_zone_add` | CREATE | Create a new zone |
| `dns_zone_update` | MUTATE | Update zone settings |
| `dns_zone_delete` | MUTATE | Delete a zone |
| `dns_record_get` | READ_ONLY | Get a record by type and ID |
| `dns_record_add` | CREATE | Add a DNS record (A, AAAA, CNAME, MX, TXT, etc.) |
| `dns_record_update` | MUTATE | Update a DNS record |
| `dns_record_delete` | MUTATE | Delete a DNS record |

### Mail

| Tool | Class | Description |
|------|-------|-------------|
| `mail_domain_list` | READ_ONLY | List all mail domains |
| `mail_domain_get` | READ_ONLY | Get mail domain details |
| `mail_domain_add` | CREATE | Create a mail domain |
| `mail_domain_delete` | MUTATE | Delete a mail domain |
| `mail_user_get` | READ_ONLY | Get mailbox details |
| `mail_user_add` | CREATE | Create a mailbox |
| `mail_user_update` | MUTATE | Update mailbox settings |
| `mail_user_delete` | MUTATE | Delete a mailbox |
| `mail_alias_add` | CREATE | Create a mail alias |
| `mail_alias_delete` | MUTATE | Delete a mail alias |
| `mail_forward_add` | CREATE | Create a mail forward |
| `mail_forward_delete` | MUTATE | Delete a mail forward |
| `mail_catchall_add` | CREATE | Create a catchall |
| `mail_spamfilter_whitelist_add` | CREATE | Add to spamfilter whitelist |
| `mail_spamfilter_blacklist_add` | CREATE | Add to spamfilter blacklist |

### Sites & Hosting

| Tool | Class | Description |
|------|-------|-------------|
| `web_domain_list` | READ_ONLY | List all websites |
| `web_domain_get` | READ_ONLY | Get website details |
| `web_domain_add` | CREATE | Create a website |
| `web_domain_update` | MUTATE | Update website settings |
| `web_domain_delete` | MUTATE | Delete a website |
| `web_subdomain_add` | CREATE | Create a subdomain |
| `web_subdomain_delete` | MUTATE | Delete a subdomain |
| `web_aliasdomain_add` | CREATE | Create an alias domain |
| `ftp_user_list` | READ_ONLY | List FTP users |
| `ftp_user_add` | CREATE | Create an FTP user |
| `ftp_user_update` | MUTATE | Update FTP user |
| `ftp_user_delete` | MUTATE | Delete an FTP user |
| `shell_user_add` | SIDE_EFFECT | Create a shell user |
| `shell_user_delete` | MUTATE | Delete a shell user |
| `database_list` | READ_ONLY | List databases |
| `database_add` | CREATE | Create a database |
| `database_delete` | MUTATE | Delete a database |
| `cron_list` | READ_ONLY | List cron jobs |
| `cron_add` | SIDE_EFFECT | Create a cron job |
| `cron_update` | SIDE_EFFECT | Update a cron job |
| `cron_delete` | MUTATE | Delete a cron job |

### Admin

| Tool | Class | Description |
|------|-------|-------------|
| `client_get` | READ_ONLY | Get client details |
| `client_add` | CREATE | Create a client |
| `client_update` | MUTATE | Update a client |
| `client_delete` | MUTATE | Delete a client |
| `server_get` | READ_ONLY | Get server info |
| `server_get_by_ip` | READ_ONLY | Find server by IP |
| `api_call` | SIDE_EFFECT | Call any ISPConfig API method directly |

### Migration

| Tool | Class | Description |
|------|-------|-------------|
| `migrate_plan` | READ_ONLY | Inventory all DNS/mail/sites on source — dry run, no changes |
| `migrate_export_dns_zone` | READ_ONLY | Export a DNS zone + all records as JSON bundle |
| `migrate_export_mail_domain` | READ_ONLY | Export a mail domain + mailboxes/aliases/forwards as JSON |
| `migrate_export_web_domain` | READ_ONLY | Export a website + FTP/shell users/databases/cron as JSON |
| `migrate_export_client` | READ_ONLY | Export a client account + associated domains as JSON |
| `migrate_import_dns_zone` | CREATE | Import a DNS zone bundle into destination instance |
| `migrate_import_mail_domain` | CREATE | Import a mail domain bundle (config only — rsync maildir separately) |
| `migrate_import_web_domain` | SIDE_EFFECT | Import a website bundle (config only — rsync files separately) |
| `migrate_verify` | READ_ONLY | Compare source and destination after migration |
| `migrate_data_commands` | READ_ONLY (local) | Generate rsync/mysqldump commands for actual data transfer |

## Migration Between Servers

The MCP supports migrating accounts between ISPConfig instances. The workflow:

1. **Plan** — `migrate_plan` inventories everything on the source
2. **Export** — `migrate_export_*` dumps config as portable JSON bundles
3. **Import** — `migrate_import_*` recreates config on the destination
4. **Data** — `migrate_data_commands` generates rsync/mysqldump commands for actual files/mail/databases

### Migration Config

For direct source→destination migration, configure both instances:

```json
{
  "mcpServers": {
    "ispconfig": {
      "command": "/usr/bin/mcp-server-ispconfig",
      "env": {
        "ISPCONFIG_URL": "https://old-server:8080",
        "ISPCONFIG_USER": "api_user",
        "ISPCONFIG_PASSWORD": "password",
        "ISPCONFIG_DEST_URL": "https://new-server:8080",
        "ISPCONFIG_DEST_USER": "api_user",
        "ISPCONFIG_DEST_PASSWORD": "password"
      }
    }
  }
}
```

Without `ISPCONFIG_DEST_URL`, export tools still work — you can save the JSON and import later.

### What gets migrated (config)

- DNS zones + all record types
- Mail domains + mailboxes + aliases + forwards + catchall
- Web domains + subdomains + alias domains
- FTP and shell users
- Database definitions
- Cron jobs
- Client accounts

### What needs manual transfer (data)

The ISPConfig API manages configuration, not file data. These must be transferred separately:

- **Mail spools** — `rsync /var/vmail/domain/`
- **Website files** — `rsync /var/www/domain/`
- **Database content** — `mysqldump` / `pg_dump`

The `migrate_data_commands` tool generates the exact commands needed.

## Example Prompts

Once connected, you can ask your AI assistant things like:

- "List all DNS zones on my server"
- "Add an A record for app.example.com pointing to 1.2.3.4"
- "Create a mailbox info@example.com with 1GB quota"
- "Add a mail forward from sales@example.com to team@example.com"
- "Show me all websites and their domains"
- "Create a cron job that runs /usr/local/bin/backup.sh every night at 2am"
- "Find all zones missing SPF records"
- "Export everything from the old server and show me a migration plan"
- "Migrate the DNS zone for example.com to the new server"
- "What rsync commands do I need to transfer mail data for example.com?"

## Development

```bash
git clone https://github.com/Spoje-NET/mcp-server-ispconfig.git
cd mcp-server-ispconfig
npm install
npm test
```

## Upstream

Fork of [DayZAnder/ispconfig-mcp](https://github.com/DayZAnder/ispconfig-mcp), based on 0.2.0 (`f1ac881`),
last synchronised 2026-11-23. The session-expiry fix originates from
[jachim/ispconfig-mcp](https://github.com/jachim/ispconfig-mcp/pull/1).

## License

BSD 3-Clause — same license as [ISPConfig 3](https://git.ispconfig.org/ispconfig/ispconfig3/-/blob/develop/LICENSE).
