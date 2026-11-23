import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";

export const READ_ONLY_ANNOTATIONS: ToolAnnotations = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true };
/** Purely local computation, no request is sent. */
export const LOCAL_READ_ONLY_ANNOTATIONS: ToolAnnotations = { ...READ_ONLY_ANNOTATIONS, openWorldHint: false };
export const CREATE_ANNOTATIONS: ToolAnnotations = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true };
export const MUTATE_ANNOTATIONS: ToolAnnotations = { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true };
/** Code execution, shell access or arbitrary API calls. */
export const SIDE_EFFECT_ANNOTATIONS: ToolAnnotations = { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true };

export interface ToolMeta {
  title: string;
  annotations: ToolAnnotations;
}

const R = READ_ONLY_ANNOTATIONS;
const C = CREATE_ANNOTATIONS;
const M = MUTATE_ANNOTATIONS;
const S = SIDE_EFFECT_ANNOTATIONS;
const m = (title: string, annotations: ToolAnnotations): ToolMeta => ({ title, annotations });

/** Title and annotation class of every tool. Kept apart from the tool code so
 * that merges from upstream stay small; a tool missing here fails at startup. */
export const TOOL_META: Record<string, ToolMeta> = {
  dns_zone_list: m("List DNS Zones", R),
  dns_zone_get: m("Get DNS Zone", R),
  dns_record_get: m("Get DNS Record", R),
  dns_zone_add: m("Create DNS Zone", C),
  dns_zone_update: m("Update DNS Zone", M),
  dns_zone_delete: m("Delete DNS Zone", M),
  dns_record_add: m("Create DNS Record", C),
  dns_record_update: m("Update DNS Record", M),
  dns_record_delete: m("Delete DNS Record", M),

  mail_domain_list: m("List Mail Domains", R),
  mail_domain_get: m("Get Mail Domain", R),
  mail_user_get: m("Get Mailbox", R),
  mail_domain_add: m("Create Mail Domain", C),
  mail_domain_delete: m("Delete Mail Domain", M),
  mail_user_add: m("Create Mailbox", C),
  mail_user_update: m("Update Mailbox", M),
  mail_user_delete: m("Delete Mailbox", M),
  mail_alias_add: m("Create Mail Alias", C),
  mail_alias_delete: m("Delete Mail Alias", M),
  mail_forward_add: m("Create Mail Forward", C),
  mail_forward_delete: m("Delete Mail Forward", M),
  mail_catchall_add: m("Create Mail Catchall", C),
  mail_spamfilter_whitelist_add: m("Add Spamfilter Whitelist Entry", C),
  mail_spamfilter_blacklist_add: m("Add Spamfilter Blacklist Entry", C),

  web_domain_list: m("List Websites", R),
  web_domain_get: m("Get Website", R),
  ftp_user_list: m("List FTP Users", R),
  database_list: m("List Databases", R),
  cron_list: m("List Cron Jobs", R),
  web_domain_add: m("Create Website", C),
  web_domain_update: m("Update Website", M),
  web_domain_delete: m("Delete Website", M),
  web_subdomain_add: m("Create Subdomain", C),
  web_subdomain_delete: m("Delete Subdomain", M),
  web_aliasdomain_add: m("Create Alias Domain", C),
  ftp_user_add: m("Create FTP User", C),
  ftp_user_update: m("Update FTP User", M),
  ftp_user_delete: m("Delete FTP User", M),
  shell_user_add: m("Create Shell User", S),
  shell_user_delete: m("Delete Shell User", M),
  database_add: m("Create Database", C),
  database_delete: m("Delete Database", M),
  cron_add: m("Create Cron Job", S),
  cron_update: m("Update Cron Job", S),
  cron_delete: m("Delete Cron Job", M),

  client_get: m("Get Client", R),
  server_get: m("Get Server Configuration", R),
  server_get_by_ip: m("Find Server by IP", R),
  client_add: m("Create Client", C),
  client_update: m("Update Client", M),
  client_delete: m("Delete Client", M),
  api_call: m("Call Any ISPConfig API Method", S),

  migrate_export_dns_zone: m("Export DNS Zone", R),
  migrate_export_mail_domain: m("Export Mail Domain", R),
  migrate_export_web_domain: m("Export Website", R),
  migrate_export_client: m("Export Client", R),
  migrate_plan: m("Plan Migration", R),
  migrate_data_commands: m("Generate Data Transfer Commands", LOCAL_READ_ONLY_ANNOTATIONS),
  migrate_verify: m("Verify Migration", R),
  migrate_import_dns_zone: m("Import DNS Zone", C),
  migrate_import_mail_domain: m("Import Mail Domain", C),
  migrate_import_web_domain: m("Import Website", S),
};
