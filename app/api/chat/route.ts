import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { resolve } from "path";

const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 4096;
const MAX_TOOL_ROUNDS = 6;

// Absolute path to the MCP server entry — resolves correctly regardless of cwd
const MCP_SERVER = resolve(
  process.cwd(),
  "node_modules/@ansvar/qatari-law-mcp/dist/src/index.js"
);

const SYSTEM = `You are a legal assistant specialising in Qatari law.
You have access to tools that search the official Qatari legislation database.
When answering a question:
1. Use search_legislation or build_legal_stance to find relevant provisions.
2. Use get_provision to fetch the full article text once you know which one applies.
3. Cite every claim with the exact law name and article number (e.g., "Article 54, Labour Law No. 14 of 2004").
4. Write clearly — explain legal terms in plain language after citing them.
5. If a provision cannot be found in the database, say so honestly.
6. Never invent or assume legal provisions.
Answer in the same language the user writes in (Arabic or English).`;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.messages || !Array.isArray(body.messages)) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
  }

  const anthropic = new Anthropic({ apiKey });

  const dbPath = resolve(process.cwd(), "data/database.db");

  const transport = new StdioClientTransport({
    command: "node",
    args: [MCP_SERVER],
    env: {
      ...process.env,
      QATARI_LAW_DB_PATH: dbPath,
    } as Record<string, string>,
  });

  const mcpClient = new Client(
    { name: "qatari-law-website", version: "1.0.0" },
    { capabilities: {} }
  );

  let anthropicTools: Anthropic.Tool[] = [];
  let useMcp = true;

  try {
    await mcpClient.connect(transport);
    const { tools } = await mcpClient.listTools();
    anthropicTools = tools.map((t) => ({
      name: t.name,
      description: t.description ?? "",
      input_schema: t.inputSchema as Anthropic.Tool["input_schema"],
    }));
  } catch (e) {
    console.error("[chat] MCP connect failed:", e);
    useMcp = false;
  }

  const messages: Anthropic.MessageParam[] = body.messages.map(
    (m: { role: string; content: string }) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })
  );

  const sources: string[] = [];
  let answer = "";

  try {
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: SYSTEM,
        tools: useMcp && anthropicTools.length > 0 ? anthropicTools : undefined,
        messages,
      });

      if (response.stop_reason === "end_turn" || !useMcp) {
        answer = response.content
          .filter((b): b is Anthropic.TextBlock => b.type === "text")
          .map((b) => b.text)
          .join("\n")
          .trim();
        break;
      }

      if (response.stop_reason === "tool_use") {
        messages.push({ role: "assistant", content: response.content });

        const toolResults: Anthropic.ToolResultBlockParam[] = [];
        for (const block of response.content) {
          if (block.type !== "tool_use") continue;

          let resultContent = "";
          try {
            const result = await mcpClient.callTool({
              name: block.name,
              arguments: block.input as Record<string, unknown>,
            });
            resultContent = JSON.stringify(result.content);

            // Collect citation hints
            const arg = block.input as Record<string, unknown>;
            const hint = arg.document_id ?? arg.query ?? block.name;
            if (hint && !sources.includes(String(hint))) {
              sources.push(String(hint));
            }
          } catch (e) {
            resultContent = `Tool error: ${e instanceof Error ? e.message : "unknown"}`;
          }

          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: resultContent,
          });
        }
        messages.push({ role: "user", content: toolResults });
        continue;
      }

      answer = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      break;
    }
  } finally {
    if (useMcp) await mcpClient.close().catch(() => {});
  }

  if (!answer) answer = "I was unable to retrieve an answer. Please try again.";

  return NextResponse.json({ answer, sources });
}
