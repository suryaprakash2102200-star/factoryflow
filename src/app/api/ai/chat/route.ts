import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { getEnabledModules } from "@/lib/modules-server";
import { moduleEnabled } from "@/lib/modules";
import { buildTools, type ActionLog } from "@/lib/ai/tools";
import { runNvidia, NvidiaError, NVIDIA_MODEL } from "@/lib/ai/nvidia";

export const maxDuration = 60;

const Body = z.object({
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(20_000) })).min(1).max(40),
});

const SYSTEM = `You are the factory assistant inside FactoryFlow, an operations system for a small Indian manufacturer (fabrication, machining, sheet metal). Users are owners, sales staff, production managers and operators.

What you can do, always through the tools (never invent records, numbers or names):
- Answer questions about enquiries, customers, quotations, orders, production jobs, invoices, items and machines.
- Give the daily summary and period reports.
- Turn a pasted customer email / WhatsApp / RFQ into an enquiry and a draft quotation priced from the item master.
- Create and update records: customers, enquiries (stage, notes, follow-up tasks), quotations (status, convert to order), order status, production jobs (stage, output, operator).

How to work:
- Look things up before answering; quote real numbers (ORD-0012, QUO-0031) and give the page link when a tool returns one, as a markdown link like [ORD-0012](/orders/…).
- Before creating or changing anything, say in one short list exactly what you will do and ask "Shall I go ahead?" — unless the user has already clearly asked for that exact change in this conversation. Never delete anything.
- For an RFQ: identify the customer (search; create only if the user agrees), match each requested item to the item master by code/name/material, log the enquiry, then draft the quotation. Point out anything you couldn't match or had to assume (price, material, quantity).
- If a tool returns an error (for example no permission), explain it plainly; don't retry the same call.
- Money is in Indian rupees (₹), use Indian digit grouping (₹1,25,000). Dates as 12 Nov 2026.
- Be brief: short sentences, bullets or a small table. Lead with the answer.`;

export async function POST(req: Request) {
  let ctx;
  try { ctx = await requireAuth(); } catch { return Response.json({ error: "Please sign in again." }, { status: 401 }); }
  if (!moduleEnabled(await getEnabledModules(ctx.tenantId), "ai"))
    return Response.json({ error: "The AI assistant is switched off for this workspace (Setup → Modules)." }, { status: 403 });
  const useClaude = !!process.env.ANTHROPIC_API_KEY;
  if (!useClaude && !process.env.NVIDIA_API_KEY)
    return Response.json({ error: "The AI assistant isn't set up yet: add NVIDIA_API_KEY (or ANTHROPIC_API_KEY) to the server's environment and restart." }, { status: 503 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Bad request" }, { status: 400 });

  const log: ActionLog[] = [];
  const today = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

  if (!useClaude) {
    try {
      const reply = await runNvidia({
        system: `${SYSTEM}\n\nToday is ${today}. Signed-in user role: ${ctx.role}.\nCall tools with valid JSON arguments only. Never claim you created or changed something unless a tool returned ok: true.`,
        messages: parsed.data.messages,
        tools: buildTools(ctx, log),
      });
      return Response.json({ reply: reply || "Done.", actions: log });
    } catch (e) {
      if (e instanceof NvidiaError) {
        const msg = e.status === 401 || e.status === 403 ? "The NVIDIA API key was rejected. Check NVIDIA_API_KEY."
          : e.status === 429 ? "The AI service is busy — try again in a minute."
          : e.status === 404 ? `The NVIDIA model “${NVIDIA_MODEL}” wasn't found. Check NVIDIA_MODEL.`
          : `AI service error (${e.status}).`;
        return Response.json({ error: msg, actions: log }, { status: 502 });
      }
      if ((e as Error).name === "TimeoutError") return Response.json({ error: "The AI took too long to answer. Try a shorter question.", actions: log }, { status: 504 });
      throw e;
    }
  }

  const client = new Anthropic();
  try {
    const final = await client.beta.messages.toolRunner({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      max_iterations: 15,
      output_config: { effort: "medium" },
      // On a safety decline, the API re-runs the request on a fallback model.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: [
        { type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } },
        { type: "text", text: `Today is ${today}. Signed-in user role: ${ctx.role}.` },
      ],
      tools: buildTools(ctx, log),
      messages: parsed.data.messages,
    });

    if (final.stop_reason === "refusal")
      return Response.json({ reply: "I can't help with that request.", actions: log });
    const reply = final.content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
    return Response.json({ reply: reply || "Done.", actions: log });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return Response.json({ error: "The AI service is busy — try again in a minute.", actions: log }, { status: 429 });
    if (e instanceof Anthropic.AuthenticationError) return Response.json({ error: "The AI API key was rejected. Check ANTHROPIC_API_KEY.", actions: log }, { status: 502 });
    if (e instanceof Anthropic.APIError) return Response.json({ error: `AI service error (${e.status ?? "network"}).`, actions: log }, { status: 502 });
    throw e;
  }
}
