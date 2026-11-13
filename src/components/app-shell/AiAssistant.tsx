"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sparkles, X, Send, ClipboardList, Mail, BarChart3, RotateCcw, CheckCircle2 } from "lucide-react";

type Msg = { role: "user" | "assistant"; content: string; actions?: { label: string; href?: string }[]; error?: boolean };

const STARTERS = [
  { icon: ClipboardList, label: "Daily summary", prompt: "Give me today's summary: what's overdue, what's stuck and what needs follow-up." },
  { icon: BarChart3, label: "Last 30 days", prompt: "How did we do in the last 30 days? Enquiries, win rate, orders, on-time dispatch and rejects." },
  { icon: Mail, label: "RFQ → quote", prompt: "I'll paste a customer enquiry. Log it as an enquiry and draft a quotation from our item master:\n\n" },
];

/** Renders **bold**, [text](/path) links and line breaks. Nothing else is interpreted. */
function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split("\n").map((line, i) => (
        <Fragment key={i}>
          {i > 0 && <br />}
          {line.split(/(\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*)/g).map((part, k) => {
            const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
            if (link) {
              const href = link[2];
              return href.startsWith("/") ? <Link key={k} href={href} className="font-medium text-blue-600 underline-offset-2 hover:underline dark:text-blue-400">{link[1]}</Link> : <span key={k}>{link[1]}</span>;
            }
            const bold = part.match(/^\*\*([^*]+)\*\*$/);
            return bold ? <strong key={k}>{bold[1]}</strong> : <Fragment key={k}>{part}</Fragment>;
          })}
        </Fragment>
      ))}
    </>
  );
}

export function AiAssistant() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, busy]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "j") { e.preventDefault(); setOpen((o) => !o); }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function send(content: string) {
    const q = content.trim();
    if (!q || busy) return;
    const next: Msg[] = [...msgs, { role: "user", content: q }];
    setMsgs(next);
    setText("");
    setBusy(true);
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next.filter((m) => !m.error).map(({ role, content }) => ({ role, content })) }),
      });
      const data = await res.json().catch(() => ({ error: "The assistant returned an unreadable response." }));
      setMsgs((m) => [...m, data.error ? { role: "assistant", content: data.error, error: true, actions: data.actions } : { role: "assistant", content: data.reply, actions: data.actions }]);
      if (data.actions?.length) router.refresh();
    } catch {
      setMsgs((m) => [...m, { role: "assistant", content: "Couldn't reach the server. Check your connection and try again.", error: true }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2.5 text-sm font-medium text-background shadow-lg transition hover:opacity-90 ${open ? "hidden" : ""}`}
        aria-label="Open AI assistant"
        title="AI assistant (Ctrl J)"
      >
        <Sparkles size={16} /> Ask AI
      </button>

      {open && (
        <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-border bg-background shadow-2xl" aria-label="AI assistant">
          <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
            <Sparkles size={16} className="text-blue-600" />
            <h2 className="text-sm font-semibold text-foreground">Factory assistant</h2>
            <div className="ml-auto flex items-center gap-1">
              {msgs.length > 0 && <button onClick={() => setMsgs([])} className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground" title="New conversation" aria-label="New conversation"><RotateCcw size={15} /></button>}
              <button onClick={() => setOpen(false)} className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Close assistant"><X size={16} /></button>
            </div>
          </header>

          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 text-sm">
            {msgs.length === 0 && (
              <div className="space-y-3">
                <p className="text-muted-foreground">Ask about orders, jobs, quotes or customers — or tell me what to update. I only see what your role can see, and I&apos;ll check with you before changing anything.</p>
                <div className="grid gap-2">
                  {STARTERS.map((s) => (
                    <button key={s.label} onClick={() => (s.prompt.endsWith("\n\n") ? (setText(s.prompt), box.current?.focus()) : send(s.prompt))}
                      className="flex items-center gap-2.5 rounded-lg border border-border px-3 py-2.5 text-left text-foreground transition hover:bg-accent">
                      <s.icon size={15} className="text-muted-foreground" /> {s.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">Try: “Which jobs are on CNC-01?”, “Move ORD-0031 to ready for dispatch”, “Record 120 good and 3 rejected on JOB-0040”.</p>
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : ""}>
                <div className={m.role === "user"
                  ? "max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-foreground px-3.5 py-2 text-background"
                  : `leading-relaxed ${m.error ? "text-rose-600" : "text-foreground"}`}>
                  {m.role === "user" ? m.content : <Rich text={m.content} />}
                  {m.actions && m.actions.length > 0 && (
                    <ul className="mt-2 space-y-1 rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-xs dark:border-emerald-900 dark:bg-emerald-950/40">
                      {m.actions.map((a, k) => (
                        <li key={k} className="flex items-start gap-1.5 text-emerald-800 dark:text-emerald-300">
                          <CheckCircle2 size={13} className="mt-px shrink-0" />
                          {a.href ? <Link href={a.href} className="hover:underline">{a.label}</Link> : a.label}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ))}
            {busy && <p className="animate-pulse text-muted-foreground">Looking through your records…</p>}
            <div ref={end} />
          </div>

          <form onSubmit={(e) => { e.preventDefault(); send(text); }} className="shrink-0 border-t border-border p-3">
            <div className="flex items-end gap-2 rounded-xl border border-border bg-background px-3 py-2 focus-within:ring-2 focus-within:ring-blue-500">
              <textarea
                ref={box}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(text); } }}
                rows={Math.min(8, Math.max(1, text.split("\n").length))}
                placeholder="Ask or paste an enquiry…"
                className="max-h-48 flex-1 resize-none bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
              <button disabled={busy || !text.trim()} className="rounded-lg bg-blue-600 p-1.5 text-white disabled:opacity-40" aria-label="Send"><Send size={15} /></button>
            </div>
            <p className="mt-1.5 text-[11px] text-muted-foreground">Enter to send · Shift+Enter for a new line · AI can make mistakes, check before sending to customers.</p>
          </form>
        </aside>
      )}
    </>
  );
}
