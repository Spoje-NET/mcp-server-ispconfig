# Changelog

## 0.3.0 - 2026-11-23

Based on DayZAnder/ispconfig-mcp 0.2.0 (f1ac881).

### Changed
- Renamed to mcp-server-ispconfig (`ispconfig-mcp` stays as an alias).
- All tools have a title and explicit annotations; IDs are validated.
- zod 4, current MCP SDK and undici (security fixes).
- Imports require `ISPCONFIG_DEST_URL`; they used to write into the source.

### Added
- `ISPCONFIG_READ_ONLY`, `ISPCONFIG_TIMEOUT`, `--help`, `--version`.
- Request timeout, response and output limits, redaction of secrets in results.

### Fixed
- Re-login after "The Session is expired or does not exist." (from jachim/ispconfig-mcp).
- `dns_zone_list`, `migrate_plan` and `migrate_verify` never saw any DNS zone.
- Importing a redacted bundle created accounts with the placeholder as password.
- `migrate_export_client` passed the client id instead of the group id.
- `include_secrets` is refused in read-only mode; imported DNS record types are allowlisted.
- Shell metacharacters are rejected in `migrate_data_commands`.
