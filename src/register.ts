import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { z } from "zod";
import { TOOL_META } from "./annotations.js";
import { containsRedacted } from "./redact.js";
import type { ToolOptions } from "./tools/types.js";

export type ToolResult = { content: { type: "text"; text: string }[]; isError?: boolean };

/** Upper bound of one tool result, protects the model context. */
export const MAX_OUTPUT_CHARS = 100_000;

function truncate(text: string): string {
  if (text.length <= MAX_OUTPUT_CHARS) return text;
  return (
    text.slice(0, MAX_OUTPUT_CHARS) +
    `\n\n[TRUNCATED: ${text.length} characters, limit ${MAX_OUTPUT_CHARS}. Request a narrower result; truncated bundles cannot be imported.]`
  );
}

/** Register a tool with its title and annotations from TOOL_META. Mutating
 * tools are never registered in read-only mode. */
export function registerTool<S extends z.ZodRawShape>(
  server: McpServer,
  opts: ToolOptions,
  name: string,
  description: string,
  inputSchema: S,
  handler: (args: z.infer<z.ZodObject<S>>) => Promise<ToolResult>,
): void {
  const meta = TOOL_META[name];
  if (!meta) throw new Error(`Tool ${name} has no entry in TOOL_META`);
  const { readOnlyHint, destructiveHint } = meta.annotations;
  if (opts.readonly && !readOnlyHint) return;

  const wrapped = async (args: z.infer<z.ZodObject<S>>): Promise<ToolResult> => {
    // A value read back redacted must never be stored as a real password.
    // Import tools handle the placeholder themselves.
    if (!readOnlyHint && !name.startsWith("migrate_import_") && containsRedacted(args)) {
      throw new Error("Arguments contain a redacted placeholder; omit the field or supply a real value.");
    }
    const result = await handler(args);
    return { ...result, content: result.content.map((c) => ({ ...c, text: truncate(c.text) })) };
  };

  server.registerTool(
    name,
    {
      title: meta.title,
      description: destructiveHint ? `${description} Destructive: confirm with the user before calling.` : description,
      inputSchema,
      annotations: meta.annotations,
    },
    // The SDK's callback type cannot be resolved for a generic shape.
    wrapped as never,
  );
}
