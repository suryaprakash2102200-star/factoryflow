/**
 * NVIDIA (build.nvidia.com / NIM) provider for the assistant.
 * NVIDIA's API is OpenAI-compatible, so this is a small chat-completions tool loop
 * that reuses the same tools as the Claude path (name, description, input_schema, parse, run).
 */
type RunnableTool = {
  name: string;
  description?: string;
  input_schema: unknown;
  parse: (input: unknown) => unknown;
  run: (args: never) => unknown;
};

type ChatMsg =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };
type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };

const BASE = process.env.NVIDIA_BASE_URL ?? "https://integrate.api.nvidia.com/v1";
export const NVIDIA_MODEL = process.env.NVIDIA_MODEL ?? "meta/llama-3.3-70b-instruct";

/** Some OpenAI-compatible servers reject JSON Schema meta keys like $schema. */
function stripMeta(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(stripMeta);
  if (schema && typeof schema === "object")
    return Object.fromEntries(Object.entries(schema).filter(([k]) => k !== "$schema").map(([k, v]) => [k, stripMeta(v)]));
  return schema;
}

export class NvidiaError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function runNvidia(opts: {
  system: string;
  messages: { role: "user" | "assistant"; content: string }[];
  tools: readonly object[];
  maxIterations?: number;
}): Promise<string> {
  const key = process.env.NVIDIA_API_KEY!;
  // every tool from buildTools() is a custom tool with input_schema/parse/run
  const list = opts.tools as RunnableTool[];
  const byName = new Map(list.map((t) => [t.name, t]));
  const tools = list.map((t) => ({
    type: "function" as const,
    function: { name: t.name, description: t.description ?? "", parameters: stripMeta(t.input_schema) },
  }));
  const msgs: ChatMsg[] = [{ role: "system", content: opts.system }, ...opts.messages];

  for (let i = 0; i < (opts.maxIterations ?? 12); i++) {
    const res = await fetch(`${BASE}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ model: NVIDIA_MODEL, messages: msgs, tools, tool_choice: "auto", temperature: 0.2, max_tokens: 4096 }),
      signal: AbortSignal.timeout(90_000),
    });
    if (!res.ok) throw new NvidiaError(res.status, (await res.text().catch(() => "")).slice(0, 300));
    const data = await res.json();
    const msg = data.choices?.[0]?.message;
    if (!msg) throw new NvidiaError(502, "Empty response");

    const calls: ToolCall[] = msg.tool_calls ?? [];
    if (!calls.length) return (msg.content ?? "").trim();

    msgs.push({ role: "assistant", content: msg.content ?? null, tool_calls: calls });
    for (const call of calls) {
      const tool = byName.get(call.function.name);
      let out: string;
      if (!tool) out = JSON.stringify({ error: `Unknown tool ${call.function.name}` });
      else {
        try {
          // validate against the tool's schema before running it
          const args = tool.parse(JSON.parse(call.function.arguments || "{}"));
          const r = await tool.run(args as never);
          out = typeof r === "string" ? r : JSON.stringify(r);
        } catch (e) {
          out = JSON.stringify({ error: `Invalid arguments: ${(e as Error).message.slice(0, 200)}` });
        }
      }
      msgs.push({ role: "tool", tool_call_id: call.id, content: out });
    }
  }
  return "I stopped after too many steps. Please ask a narrower question.";
}
