# FactoryFlow: Phase 0 audit of the existing CRM

Date: 2026-11-12. Compared `D:\CRM` (Kairo CRM, Next.js 16 + Prisma + Postgres) against
`factoryflow_product_architecture.html` (blueprint v1).

## 1. Verdict

The CRM is a sound base to reuse. It already has workspaces (tenants), role permissions,
row-level security (RLS) on most tables, an enquiry pipeline, contacts and customers, quotations
with PDF output, tasks and invoices. What was missing for the FactoryFlow v1 release was
**Order Management**, **Production Lite**, **module activation** and an **audit log**. All
four are now built (section 4).

A **critical security bug** was found and fixed in code (section 2.1). The database fix
takes effect only after you run `npm run db:upgrade`.

## 2. Issues found

| # | Severity | Finding | Status |
|---|---|---|---|
| 2.1 | **Critical** | `accounts`, `contacts`, `quotes` and `invoices` had **no RLS policy**, and pages query them without a tenant filter (for example `tx.quote.findMany()` in `billing/quotes/page.tsx`). Any signed-in workspace could read and edit every other workspace's customers, contacts, quotes and invoices. | Fixed in `prisma/rls.sql`. **Apply with `npm run db:upgrade`.** |
| 2.2 | High | Schema drift: the migration files create only the first ~11 tables. Accounts, contacts, quotes and invoices exist only in `schema.prisma`, so the database was built with `prisma db push`. `npm run db:reset` would build an incomplete database. | Worked around: added `db:push` / `db:upgrade`. Create a baseline migration (section 6) before production. |
| 2.3 | High | Built-in roles are stored in the database (`role_permissions`) as fixed lists, so new resources (`order`, `production`, `audit`) don't reach existing users automatically. | `npm run db:upgrade` runs `scripts/seed-roles.ts`, which re-syncs owner/admin/manager/agent/viewer. Note: that script overwrites manual edits to those five built-in roles. Custom roles must be granted the new permissions in Roles & Permissions. |
| 2.4 | Medium | Quote and invoice numbers come from `count() + 1` with no unique index, so two users saving at once can get the same number. | New orders and jobs use a `(tenantId, number)` unique index, so a clash fails instead of duplicating. Quotes and invoices are unchanged. Add the same index there. |
| 2.5 | Medium | Hosted `DATABASE_URL` (Render) refuses connections, and the app can't load data. | Your action: reactivate it, or switch to local Docker Postgres. |
| 2.6 | Low | Pre-existing lint errors: `NavProgress.tsx` (function used before declared, setState in effect), `QuotesClient.tsx` (setState in effect), `quotes/page.tsx` (`any`). | Left as is. Not caused by this work. |
| 2.7 | Low | A nested git worktree (`.claude/worktrees/...`) is staged in git. | Run `git rm --cached -r .claude/worktrees` and add `.claude/worktrees/` to `.gitignore`. |

## 3. Blueprint coverage

| Blueprint module | Before | Now |
|---|---|---|
| Workspace tenancy, users, roles | ✅ | ✅ (+ RLS on all business tables) |
| Module activation | ❌ | ✅ `Setup → Modules`, enforced in pages, actions and export |
| Audit log | ❌ | ✅ `Setup → Audit log` (orders, jobs, module changes) |
| 01 CRM & Customers | ✅ Leads/Contacts/Accounts | ✅ Renamed in the menu to Enquiries / Contacts / Customers |
| 02 Quotations & Sales | ✅ with PDF | ✅ + "Create order" on accepted quotes |
| 03 Order Management | ❌ | ✅ new |
| 06 Production (Lite) | ❌ | ✅ new |
| 10 Reports | ⚠️ dashboard | ✅ Dashboard: Operations panel (quotes awaiting reply, active/overdue orders, jobs running/overdue) |
| 11 Workforce & Tasks | ✅ Action Tracker | ✅ (menu: Tasks) |
| 04 Product & BOM, 05 Inventory, 07 Maintenance, 08 Purchasing, 09 Quality, 12 AI | ❌ | Listed as "Coming later". Not built, per the blueprint ("don't build before a customer pays"). |

## 4. What was added

**Database** (`prisma/schema.prisma`)
- `Organization.enabledModules`, defaulting to CRM, Quotations, Orders, Production, Tasks, Invoices and Reports.
- `Order`, `OrderItem` and `OrderStatusHistory`. Each status change is stored as a new history row and old rows are never overwritten.
- `ProductionJob` and `JobUpdate` (stage changes and output/reject entries).
- `AuditLog`.

**Rules** (`src/lib/factory.ts`)
- Orders: Draft → Confirmed → In production → Ready for dispatch → Dispatched → Closed. Cancelled is allowed only before dispatch. Any other jump is rejected on the server.
- Jobs: Planned, In progress, Paused, Quality check, Completed, Cancelled. Only a manager (`production:delete`) can reopen a finished job.
- Production v1 has no BOM or stock: each job has a specification, free-text material notes and a drawing link. No stock balances are created.

**Access**: a user can use a module only if the workspace has switched it on (`requireModule`) **and** their role has the permission. Both checks run in the server actions, not only in the menu.

**Screens** (built from the existing components: `Modal`, sonner toasts, and the Quotes table, toolbar and status-pill styles)
- `/orders`: summary cards, search, status filter, Excel export, "New order", "From quotation".
- `/orders/[id]`: status stepper, next-step buttons with a note, line items, linked jobs with progress, status history, edit and cancel.
- `/production`: job board by stage, filters for assigned to me / unassigned, overdue count, quick Start/Next/Pause buttons.
- `/production/[id]`: stage switcher, recording good and rejected quantities, spec and material notes, work-update timeline.
- `/admin/modules` and `/admin/audit`.
- From an order, "Plan jobs from line items" creates one job card per line and moves the order to In production.

## 5. To run it

```bash
# 1. make the database reachable (Render, or local Docker: npm run db:up and point DATABASE_URL at it)
npm run db:upgrade   # db push  →  RLS policies (incl. the 2.1 fix)  →  re-sync built-in roles
npm run dev -- --port 3001
```

Sign out and back in afterwards, because permissions are cached in the login session.

## 6. Recommended next steps

1. Create a baseline migration so `migrate deploy` works in production. Generate the SQL with
   `npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > prisma/migrations/<ts>_baseline/migration.sql`,
   then `npx prisma migrate resolve --applied <ts>_baseline` on the existing database.
2. Add `@@unique([tenantId, number])` to quotes and invoices (finding 2.4).
3. Have one or two factories try the enquiry → quote → order → job → dispatch flow before building the paid modules.
4. Plug in the landing page and in-app UI designs once they're shared.

## 7. Follow-up fixes (2026-11-13)

Tested end to end on Supabase as the restricted `crm_app` login.

| Item | Change |
|---|---|
| Real-estate demo fields | Replaced with a factory template (`src/lib/factory-template.ts`): stages New enquiry → Qualified → Quoted → Negotiation → Won/Lost; fields product, quantity, material, required by, drawing ref, source. New signups get it too. Existing workspaces: `npm run db:factory`. |
| Old labels | Leads/Accounts/Action Tracker wording replaced with Enquiries/Customers/Tasks across pages, buttons and toasts. |
| New enquiry redirect | Goes to the new enquiry instead of the dashboard. |
| Invoice cards | Use the invoice currency; drafts shown separately. |
| Quote revisions | Editing a sent/accepted quote snapshots it (`quote_revisions`), bumps Rev N, returns it to Draft. "Rev N" badge opens the history. PDF shows the revision. Quotes with an order can't be edited. Quotes link to an enquiry. |
| Reports | New `/reports`: enquiry → quote → order funnel, win rate, on-time dispatch, order-to-dispatch days, open order book, top customers, output/rejects, reject rate, output by person. |
| Notifications | Bell in the header. Sent for: job assigned, job completed / all jobs on an order done, order status change, quote accepted/rejected. |
| Files | Attachments (≤ 5 MB, stored in Postgres) on orders, jobs and enquiries via `/api/attachments`. |
| Audit log | Now also covers quotes, enquiries (stage, delete), customers and file uploads. |
| **Security: enquiry permissions** | Enquiry actions had no permission checks (a viewer could delete). Now each checks `lead:*`, `note:create`, `activity:create`, `task:create`. |
| **Security: RLS bypass** | App now connects as `crm_app` (NOBYPASSRLS). `DIRECT_URL` keeps the owner login for schema changes. Verified: other workspace's rows return 0. Script: `npm run db:app-role` (rotates the password). |
| RLS gaps found by the above | `organizations`, `quote_items`, `order_items`, `invoice_items` had RLS on with no policy (Supabase default) — added policies. |
| Unique numbers | `@@unique([tenantId, number])` on quotes and invoices. |

Not changed (your decision): orders stay "In production" until someone marks them ready; the owner gets an "All jobs done" notification instead.

## 8. Masters, demo data and AI assistant (2026-11-13)

**Masters** (`Setup → Masters`, permission `master:view` / `master:edit`)
- Items: code, name, category, unit, HSN, GST %, default price, material. Typing a code or name in a quotation line fills price and GST.
- Machines / work centres: selectable on production jobs, shown on the board and job page.
- Lists: units, materials, GST rates, payment terms (default fills new quotations), delivery terms, product categories, machine types.

**Demo data** — `npm run db:demo` (replaces the first workspace's business records; users/roles kept). Fictional Pune fabrication shop: 25 customers, 40 items, 9 machines, 70 enquiries over six months and the quotes, revisions, orders, jobs with shift output, dispatches, invoices and follow-up tasks that follow from them. Extra logins (all `password123`): priya.sales@, rahul.sales@, santosh.prod@, imran.op@, ganesh.op@ (`@acme.test`).

**AI assistant** (module `ai`, "Ask AI" button or Ctrl+J)
- Built on the Anthropic TypeScript SDK tool runner, model `claude-opus-5-5`, effort medium, server-side refusal fallback enabled.
- Tools: search records, record details, daily summary, period report; create customer, log enquiry, move enquiry / add note / follow-up task, draft quotation from the item master, change quote status or convert to order, change order status, update job stage / output / operator.
- Every write goes through the existing server actions, so the user's permissions, module switches, audit log and notifications apply. The assistant asks before changing anything and never deletes.
- **Needs `ANTHROPIC_API_KEY` in `.env`** (server restart after adding). Until then the panel says it isn't set up.

**Bugs fixed on the way:** dashboard counted Lost enquiries as Won (KPI, leaderboard, win rate); dashboard and orders showed $ / US number format instead of ₹ / Indian grouping.
