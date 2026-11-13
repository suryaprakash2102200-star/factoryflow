"use client";

import { Attachments } from "@/components/Attachments";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Phone, Mail, Users, MapPin, FileText, RefreshCcw, MessageCircle, Pencil } from "lucide-react";
import {
  addNoteAction,
  addActivityAction,
  changeStageAction,
  addTaskAction,
} from "./actions";
import { EditLeadModal } from "./EditLeadModal";
import type { FieldDefinition } from "@/types/dynamic-lead";

interface Stage {
  id: string;
  name: string;
  color: string;
  orderIndex: number;
}

interface Props {
  lead: {
    id: string;
    title: string;
    stageId: string;
    source: string | null;
    estimatedValue: number | null;
    currency: string;
    customValues: unknown;
    createdAt: string;
    updatedAt: string;
    lastActivityAt: string | null;
    owner: { id: string; fullName: string } | null;
    stage: { id: string; name: string; color: string | null };
  };
  stages: Stage[];
  defs: FieldDefinition[];
  activities: {
    id: string;
    type: string;
    title: string;
    body: string | null;
    createdAt: string;
    createdByName: string;
  }[];
  notes: {
    id: string;
    body: string;
    createdAt: string;
    createdByName: string;
  }[];
  tasks: {
    id: string;
    item: string;
    status: string;
    priority: string;
    ecd: string | null;
    assigneeName: string | null;
  }[];
  users: { id: string; fullName: string }[];
  canEdit?: boolean;
  canDelete?: boolean;
}

export function LeadDetailClient({
  lead,
  stages,
  defs,
  activities,
  notes,
  tasks,
  users,
  canEdit = false,
  canDelete = false,
}: Props) {
  const [tab, setTab] = useState<"timeline" | "notes" | "tasks">("timeline");
  const [editOpen, setEditOpen] = useState(false);
  const cv = (lead.customValues ?? {}) as Record<string, unknown>;

  const ownerInitials = (lead.owner?.fullName ?? "U N")
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const openTasks = tasks.filter((t) => t.status === "open").length;
  const daysOld = Math.max(
    1,
    Math.floor(
      (Date.now() - new Date(lead.createdAt).getTime()) / 86400000,
    ),
  );

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-4 flex items-center gap-1.5 text-sm text-slate-500">
          <Link href="/leads" className="hover:text-blue-600">
            Leads
          </Link>
          <span className="text-slate-300">/</span>
          <span className="font-medium text-slate-900">{lead.title}</span>
        </div>

        <div className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="relative bg-blue-600 px-6 py-6 text-white">
            <div className="relative flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 text-lg font-bold backdrop-blur-sm ring-1 ring-white/20">
                  {ownerInitials}
                </div>
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                    {lead.title}
                  </h1>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/80">
                    <span>{lead.owner?.fullName ?? "Unassigned"}</span>
                    <span className="text-white/40">·</span>
                    <span>{lead.source ?? "No source"}</span>
                    <span className="text-white/40">·</span>
                    <span>{daysOld}d old</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <StageChanger
                  leadId={lead.id}
                  currentStageId={lead.stageId}
                  stages={stages}
                />
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => setEditOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-white/15 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm transition hover:bg-white/25"
                  >
                    <Pencil size={13} />
                    Edit
                  </button>
                )}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 divide-x divide-slate-100 sm:grid-cols-4">
            <HeroStat
              label="Value"
              value={
                lead.estimatedValue
                  ? `${lead.currency} ${lead.estimatedValue.toLocaleString()}`
                  : "—"
              }
            />
            <HeroStat label="Activities" value={String(activities.length)} />
            <HeroStat label="Open Tasks" value={String(openTasks)} />
            <HeroStat label="Notes" value={String(notes.length)} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left column: details */}
          <aside className="space-y-4 lg:col-span-1">
            <Card title="Enquiry details">
              <DetailRow label="Title" value={lead.title} />
              <DetailRow label="Source" value={lead.source ?? "—"} />
              <DetailRow
                label="Value"
                value={
                  lead.estimatedValue
                    ? `${lead.currency} ${lead.estimatedValue.toLocaleString()}`
                    : "—"
                }
              />
              <DetailRow
                label="Stage"
                value={
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: lead.stage.color ?? "#64748b" }}
                    />
                    {lead.stage.name}
                  </span>
                }
              />
            </Card>

            <Attachments entityType="lead" entityId={lead.id} canEdit={canEdit} title="Files (drawings, RFQ)" />

            <Card title="Enquiry fields">
              {defs.length === 0 ? (
                <div className="text-sm text-slate-400">None configured.</div>
              ) : (
                defs.map((d) => (
                  <DetailRow
                    key={d.id}
                    label={d.label}
                    value={formatValue(cv[d.key], d.type)}
                  />
                ))
              )}
            </Card>
          </aside>

          {/* Right column: tabs */}
          <section className="space-y-4 lg:col-span-2">
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex border-b border-slate-200">
                {(
                  [
                    ["timeline", "Timeline", activities.length],
                    ["notes", "Notes", notes.length],
                    ["tasks", "Tasks", tasks.length],
                  ] as const
                ).map(([key, label, count]) => {
                  const active = tab === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setTab(key)}
                      className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition ${
                        active
                          ? "border-b-2 border-blue-500 text-blue-600"
                          : "border-b-2 border-transparent text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      {label}
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${
                          active
                            ? "bg-blue-100 text-blue-700"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="p-6">
                {tab === "timeline" && (
                  <TimelineTab leadId={lead.id} activities={activities} />
                )}
                {tab === "notes" && <NotesTab leadId={lead.id} notes={notes} />}
                {tab === "tasks" && <TasksTab leadId={lead.id} tasks={tasks} />}
              </div>
            </div>
          </section>
        </div>
      </div>
      {canEdit && (
        <EditLeadModal
          open={editOpen}
          onClose={() => setEditOpen(false)}
          lead={{
            id: lead.id,
            title: lead.title,
            source: lead.source,
            estimatedValue: lead.estimatedValue,
            currency: lead.currency,
            ownerId: lead.owner?.id ?? null,
            customValues: cv,
          }}
          definitions={defs}
          users={users}
          canDelete={canDelete}
        />
      )}
    </main>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-5 py-4">
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
        {title}
      </h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-900">{value}</span>
    </div>
  );
}

function StageChanger({
  leadId,
  currentStageId,
  stages,
}: {
  leadId: string;
  currentStageId: string;
  stages: Stage[];
}) {
  const [isPending, start] = useTransition();
  return (
    <select
      disabled={isPending}
      value={currentStageId}
      onChange={(e) => {
        const toStageId = e.target.value;
        start(() => changeStageAction({ leadId, toStageId }));
      }}
      className="rounded-full border border-white/30 bg-white/15 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm outline-none ring-0 transition hover:bg-white/25 focus:border-white/60 [&>option]:text-slate-900"
    >
      {stages.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
        </option>
      ))}
    </select>
  );
}

function TimelineTab({
  leadId,
  activities,
}: {
  leadId: string;
  activities: Props["activities"];
}) {
  const [isPending, start] = useTransition();
  const [type, setType] = useState<"call" | "email" | "meeting" | "visit" | "other">("call");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  return (
    <div className="space-y-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            try {
              await addActivityAction({ leadId, type, title, body: body || undefined });
              setTitle("");
              setBody("");
              toast.success("Activity logged");
            } catch {
              toast.error("Failed to log activity");
            }
          });
        }}
        className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4"
      >
        <div className="flex gap-2">
          <select
            value={type}
            onChange={(e) => setType(e.target.value as typeof type)}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="call">Call</option>
            <option value="email">Email</option>
            <option value="meeting">Meeting</option>
            <option value="visit">Visit</option>
            <option value="other">Other</option>
          </select>
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Activity title…"
            className="flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          />
        </div>
        <textarea
          rows={2}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Details (optional)…"
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
        />
        <button
          disabled={isPending}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-blue-500/20 hover:bg-blue-700 disabled:opacity-50"
        >
          {isPending ? "Adding…" : "Log Activity"}
        </button>
      </form>

      {activities.length === 0 ? (
        <div className="py-10 text-center text-sm text-slate-400">
          No activity yet.
        </div>
      ) : (
        <ol className="relative space-y-4 border-l border-slate-200 pl-5">
          {activities.map((a) => (
            <li key={a.id} className="relative">
              <span
                className="absolute -left-[22px] top-0.5 flex h-5 w-5 items-center justify-center rounded-full ring-4 ring-white"
                style={{ background: activityColor(a.type) }}
              >
                {activityIcon(a.type)}
              </span>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-slate-900">
                    {a.title}
                  </div>
                  {a.body && (
                    <div className="mt-1 text-sm text-slate-600">{a.body}</div>
                  )}
                  <div className="mt-1 text-xs text-slate-400">
                    {a.createdByName} ·{" "}
                    {new Date(a.createdAt).toLocaleString()}
                  </div>
                </div>
                <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                  {a.type.replace("_", " ")}
                </span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function NotesTab({
  leadId,
  notes,
}: {
  leadId: string;
  notes: Props["notes"];
}) {
  const [isPending, start] = useTransition();
  const [body, setBody] = useState("");

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            try {
              await addNoteAction({ leadId, body });
              setBody("");
              toast.success("Note added");
            } catch {
              toast.error("Failed to add note");
            }
          });
        }}
        className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4"
      >
        <textarea
          required
          rows={3}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write a note…"
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
        />
        <button
          disabled={isPending}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-blue-500/20 hover:bg-blue-700 disabled:opacity-50"
        >
          {isPending ? "Saving…" : "Add Note"}
        </button>
      </form>

      {notes.length === 0 ? (
        <div className="py-10 text-center text-sm text-slate-400">
          No notes yet.
        </div>
      ) : (
        notes.map((n) => (
          <div
            key={n.id}
            className="rounded-lg border border-slate-200 bg-white p-4"
          >
            <div className="whitespace-pre-wrap text-sm text-slate-800">
              {n.body}
            </div>
            <div className="mt-2 text-xs text-slate-400">
              {n.createdByName} · {new Date(n.createdAt).toLocaleString()}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function TasksTab({
  leadId,
  tasks,
}: {
  leadId: string;
  tasks: Props["tasks"];
}) {
  const [isPending, start] = useTransition();
  const [item, setItem] = useState("");
  const [priority, setPriority] = useState<
    "low" | "medium" | "high" | "critical"
  >("medium");
  const [ecd, setEcd] = useState("");

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            try {
              await addTaskAction({
                leadId,
                item,
                priority,
                ecd: ecd ? new Date(ecd).toISOString() : undefined,
              });
              setItem("");
              setEcd("");
              setPriority("medium");
              toast.success("Task created");
            } catch {
              toast.error("Failed to create task");
            }
          });
        }}
        className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 md:grid-cols-[1fr_auto_auto_auto]"
      >
        <input
          required
          value={item}
          onChange={(e) => setItem(e.target.value)}
          placeholder="Task item…"
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
        />
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as typeof priority)}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </select>
        <input
          type="date"
          value={ecd}
          onChange={(e) => setEcd(e.target.value)}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
        />
        <button
          disabled={isPending}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-blue-500/20 hover:bg-blue-700 disabled:opacity-50"
        >
          {isPending ? "Adding…" : "Add Task"}
        </button>
      </form>

      {tasks.length === 0 ? (
        <div className="py-10 text-center text-sm text-slate-400">
          No tasks yet.
        </div>
      ) : (
        <div className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200">
          {tasks.map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between gap-4 bg-white p-4"
            >
              <div>
                <div className="text-sm font-medium text-slate-900">
                  {t.item}
                </div>
                <div className="mt-0.5 text-xs text-slate-500">
                  {t.assigneeName ?? "Unassigned"}
                  {t.ecd && ` · ECD ${new Date(t.ecd).toLocaleDateString()}`}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${priorityClass(
                    t.priority,
                  )}`}
                >
                  {t.priority}
                </span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                  {t.status.replace("_", " ")}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function activityColor(type: string): string {
  switch (type) {
    case "call": return "#3b82f6";
    case "email": return "#8b5cf6";
    case "meeting": return "#f59e0b";
    case "visit": return "#10b981";
    case "note": return "#64748b";
    case "stage_change": return "#ef4444";
    default: return "#94a3b8";
  }
}

function activityIcon(type: string) {
  const cls = "text-white";
  switch (type) {
    case "call": return <Phone size={10} className={cls} />;
    case "email": return <Mail size={10} className={cls} />;
    case "meeting": return <Users size={10} className={cls} />;
    case "visit": return <MapPin size={10} className={cls} />;
    case "note": return <FileText size={10} className={cls} />;
    case "stage_change": return <RefreshCcw size={10} className={cls} />;
    default: return <MessageCircle size={10} className={cls} />;
  }
}

function priorityClass(p: string): string {
  switch (p) {
    case "critical": return "bg-rose-100 text-rose-700";
    case "high": return "bg-blue-100 text-blue-700";
    case "medium": return "bg-amber-100 text-amber-700";
    default: return "bg-slate-100 text-slate-700";
  }
}

function formatValue(v: unknown, type: string): string {
  if (v === null || v === undefined || v === "") return "—";
  if (type === "currency" || type === "number")
    return typeof v === "number" ? v.toLocaleString() : String(v);
  if (type === "date" || type === "datetime")
    return new Date(String(v)).toLocaleDateString();
  if (Array.isArray(v)) return v.join(", ");
  return String(v);
}
