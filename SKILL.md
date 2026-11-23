---
name: mcp-server-ispconfig
description: Manage ISPConfig 3 hosting (DNS zones and records, mail domains and mailboxes, websites, databases, FTP/shell users, cron, clients) and migrate between two ISPConfig instances. Use when asked to inspect or change something in ISPConfig.
---

Start with the `*_list` tools to find IDs; `*_get`, `*_update` and `*_delete` take numeric IDs. In read-only mode only listing, reading, export, plan and verify tools exist.

- Confirm with the user before any tool annotated destructive (`*_update`, `*_delete`, `api_call`, `shell_user_add`, `cron_*`, `migrate_import_web_domain`).
- Secrets come back as `***REDACTED***`. Never send that value back; omit the field instead.
- Use `api_call` only when no dedicated tool exists.
- Migration order: `migrate_plan`, `migrate_export_*`, `migrate_import_*` (needs `ISPCONFIG_DEST_URL`), `migrate_data_commands`, `migrate_verify`. Passwords redacted in the export are random after import and must be reset.
