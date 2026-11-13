-- Kairo CRM — Row-Level Security policies
-- Quoted camelCase columns match Prisma's default naming.

ALTER TABLE users             ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_stages       ENABLE ROW LEVEL SECURITY;
ALTER TABLE field_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads             ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities        ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes             ENABLE ROW LEVEL SECURITY;
ALTER TABLE stage_history     ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks             ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions  ENABLE ROW LEVEL SECURITY;

ALTER TABLE users             FORCE ROW LEVEL SECURITY;
ALTER TABLE lead_stages       FORCE ROW LEVEL SECURITY;
ALTER TABLE field_definitions FORCE ROW LEVEL SECURITY;
ALTER TABLE leads             FORCE ROW LEVEL SECURITY;
ALTER TABLE activities        FORCE ROW LEVEL SECURITY;
ALTER TABLE notes             FORCE ROW LEVEL SECURITY;
ALTER TABLE stage_history     FORCE ROW LEVEL SECURITY;
ALTER TABLE tasks             FORCE ROW LEVEL SECURITY;
ALTER TABLE roles             FORCE ROW LEVEL SECURITY;
ALTER TABLE role_permissions  FORCE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid
$$;

DROP POLICY IF EXISTS tenant_iso_users       ON users;
DROP POLICY IF EXISTS tenant_iso_stages      ON lead_stages;
DROP POLICY IF EXISTS tenant_iso_fielddefs   ON field_definitions;
DROP POLICY IF EXISTS tenant_iso_leads       ON leads;
DROP POLICY IF EXISTS tenant_iso_activities  ON activities;
DROP POLICY IF EXISTS tenant_iso_notes       ON notes;
DROP POLICY IF EXISTS tenant_iso_stagehist   ON stage_history;
DROP POLICY IF EXISTS tenant_iso_tasks       ON tasks;

CREATE POLICY tenant_iso_users ON users FOR ALL
  USING (
    "tenantId" = current_tenant_id()
    OR NULLIF(current_setting('app.tenant_id', true), '') IS NULL
  )
  WITH CHECK ("tenantId" = current_tenant_id());

CREATE POLICY tenant_iso_stages ON lead_stages FOR ALL
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

CREATE POLICY tenant_iso_fielddefs ON field_definitions FOR ALL
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

CREATE POLICY tenant_iso_leads ON leads FOR ALL
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

CREATE POLICY tenant_iso_activities ON activities FOR ALL
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

CREATE POLICY tenant_iso_notes ON notes FOR ALL
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

CREATE POLICY tenant_iso_stagehist ON stage_history FOR ALL
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

CREATE POLICY tenant_iso_tasks ON tasks FOR ALL
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

DROP POLICY IF EXISTS tenant_iso_roles       ON roles;
DROP POLICY IF EXISTS tenant_iso_roleperms   ON role_permissions;

CREATE POLICY tenant_iso_roles ON roles FOR ALL
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

CREATE POLICY tenant_iso_roleperms ON role_permissions FOR ALL
  USING ("tenantId" = current_tenant_id())
  WITH CHECK ("tenantId" = current_tenant_id());

CREATE INDEX IF NOT EXISTS leads_custom_values_gin ON leads USING GIN ("customValues");

-- ── Tenant isolation for CRM/billing tables (previously unprotected) and
--    FactoryFlow tables. Child tables without tenantId (quote_items,
--    invoice_items, order_items) are reached only through their parent.
ALTER TABLE accounts             ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts             ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes               ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices             ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders               ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_jobs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_updates          ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs           ENABLE ROW LEVEL SECURITY;

ALTER TABLE accounts             FORCE ROW LEVEL SECURITY;
ALTER TABLE contacts             FORCE ROW LEVEL SECURITY;
ALTER TABLE quotes               FORCE ROW LEVEL SECURITY;
ALTER TABLE invoices             FORCE ROW LEVEL SECURITY;
ALTER TABLE orders               FORCE ROW LEVEL SECURITY;
ALTER TABLE order_status_history FORCE ROW LEVEL SECURITY;
ALTER TABLE production_jobs      FORCE ROW LEVEL SECURITY;
ALTER TABLE job_updates          FORCE ROW LEVEL SECURITY;
ALTER TABLE audit_logs           FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_iso_accounts  ON accounts;
DROP POLICY IF EXISTS tenant_iso_contacts  ON contacts;
DROP POLICY IF EXISTS tenant_iso_quotes    ON quotes;
DROP POLICY IF EXISTS tenant_iso_invoices  ON invoices;
DROP POLICY IF EXISTS tenant_iso_orders    ON orders;
DROP POLICY IF EXISTS tenant_iso_orderhist ON order_status_history;
DROP POLICY IF EXISTS tenant_iso_jobs      ON production_jobs;
DROP POLICY IF EXISTS tenant_iso_jobupd    ON job_updates;
DROP POLICY IF EXISTS tenant_iso_audit     ON audit_logs;

CREATE POLICY tenant_iso_accounts ON accounts FOR ALL
  USING ("tenantId" = current_tenant_id()) WITH CHECK ("tenantId" = current_tenant_id());
CREATE POLICY tenant_iso_contacts ON contacts FOR ALL
  USING ("tenantId" = current_tenant_id()) WITH CHECK ("tenantId" = current_tenant_id());
CREATE POLICY tenant_iso_quotes ON quotes FOR ALL
  USING ("tenantId" = current_tenant_id()) WITH CHECK ("tenantId" = current_tenant_id());
CREATE POLICY tenant_iso_invoices ON invoices FOR ALL
  USING ("tenantId" = current_tenant_id()) WITH CHECK ("tenantId" = current_tenant_id());
CREATE POLICY tenant_iso_orders ON orders FOR ALL
  USING ("tenantId" = current_tenant_id()) WITH CHECK ("tenantId" = current_tenant_id());
CREATE POLICY tenant_iso_orderhist ON order_status_history FOR ALL
  USING ("tenantId" = current_tenant_id()) WITH CHECK ("tenantId" = current_tenant_id());
CREATE POLICY tenant_iso_jobs ON production_jobs FOR ALL
  USING ("tenantId" = current_tenant_id()) WITH CHECK ("tenantId" = current_tenant_id());
CREATE POLICY tenant_iso_jobupd ON job_updates FOR ALL
  USING ("tenantId" = current_tenant_id()) WITH CHECK ("tenantId" = current_tenant_id());
CREATE POLICY tenant_iso_audit ON audit_logs FOR ALL
  USING ("tenantId" = current_tenant_id()) WITH CHECK ("tenantId" = current_tenant_id());

-- FactoryFlow v1.1: quote revisions, notifications, attachments
ALTER TABLE quote_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications   ENABLE ROW LEVEL SECURITY;
ALTER TABLE attachments     ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_revisions FORCE ROW LEVEL SECURITY;
ALTER TABLE notifications   FORCE ROW LEVEL SECURITY;
ALTER TABLE attachments     FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_iso_quoterev ON quote_revisions;
DROP POLICY IF EXISTS tenant_iso_notif    ON notifications;
DROP POLICY IF EXISTS tenant_iso_attach   ON attachments;

CREATE POLICY tenant_iso_quoterev ON quote_revisions FOR ALL
  USING ("tenantId" = current_tenant_id()) WITH CHECK ("tenantId" = current_tenant_id());
CREATE POLICY tenant_iso_notif ON notifications FOR ALL
  USING ("tenantId" = current_tenant_id()) WITH CHECK ("tenantId" = current_tenant_id());
CREATE POLICY tenant_iso_attach ON attachments FOR ALL
  USING ("tenantId" = current_tenant_id()) WITH CHECK ("tenantId" = current_tenant_id());

-- organizations: keyed by id, not tenantId. Readable when no tenant is set (login,
-- signup) or for the current tenant only. Supabase may enable RLS here by default.
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_access ON organizations;
CREATE POLICY org_access ON organizations FOR ALL
  USING (current_tenant_id() IS NULL OR id = current_tenant_id())
  WITH CHECK (current_tenant_id() IS NULL OR id = current_tenant_id());

-- Line items have no tenantId: they inherit isolation from their parent row,
-- which is itself filtered by RLS.
ALTER TABLE quote_items   ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items   ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS parent_iso_quote_items   ON quote_items;
DROP POLICY IF EXISTS parent_iso_invoice_items ON invoice_items;
DROP POLICY IF EXISTS parent_iso_order_items   ON order_items;
CREATE POLICY parent_iso_quote_items ON quote_items FOR ALL
  USING (EXISTS (SELECT 1 FROM quotes p WHERE p.id = "quoteId"))
  WITH CHECK (EXISTS (SELECT 1 FROM quotes p WHERE p.id = "quoteId"));
CREATE POLICY parent_iso_invoice_items ON invoice_items FOR ALL
  USING (EXISTS (SELECT 1 FROM invoices p WHERE p.id = "invoiceId"))
  WITH CHECK (EXISTS (SELECT 1 FROM invoices p WHERE p.id = "invoiceId"));
CREATE POLICY parent_iso_order_items ON order_items FOR ALL
  USING (EXISTS (SELECT 1 FROM orders p WHERE p.id = "orderId"))
  WITH CHECK (EXISTS (SELECT 1 FROM orders p WHERE p.id = "orderId"));

-- Masters: products, machines, pick-lists
ALTER TABLE products      ENABLE ROW LEVEL SECURITY;
ALTER TABLE machines      ENABLE ROW LEVEL SECURITY;
ALTER TABLE master_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE products      FORCE ROW LEVEL SECURITY;
ALTER TABLE machines      FORCE ROW LEVEL SECURITY;
ALTER TABLE master_values FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_iso_products ON products;
DROP POLICY IF EXISTS tenant_iso_machines ON machines;
DROP POLICY IF EXISTS tenant_iso_mvalues  ON master_values;
CREATE POLICY tenant_iso_products ON products FOR ALL
  USING ("tenantId" = current_tenant_id()) WITH CHECK ("tenantId" = current_tenant_id());
CREATE POLICY tenant_iso_machines ON machines FOR ALL
  USING ("tenantId" = current_tenant_id()) WITH CHECK ("tenantId" = current_tenant_id());
CREATE POLICY tenant_iso_mvalues ON master_values FOR ALL
  USING ("tenantId" = current_tenant_id()) WITH CHECK ("tenantId" = current_tenant_id());
GRANT SELECT, INSERT, UPDATE, DELETE ON products, machines, master_values TO crm_app;
