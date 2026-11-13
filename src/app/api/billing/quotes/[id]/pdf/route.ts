import { requireAuth } from "@/lib/auth";
import { withTenant } from "@/lib/tenant-context";
import { renderToBuffer, Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import React from "react";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (!auth.permissions.includes("quote:view")) {
    return new Response("Forbidden", { status: 403 });
  }

  const { id } = await params;

  const quote = await withTenant(auth.tenantId, async (tx) =>
    tx.quote.findFirst({
      where: { id },
      include: {
        items: { orderBy: { orderIndex: "asc" } },
        contact: { select: { fullName: true, email: true, phone: true } },
        account: { select: { name: true } },
        owner: { select: { fullName: true } },
      },
    })
  );

  if (!quote) return new Response("Not Found", { status: 404 });

  const styles = StyleSheet.create({
    page: { padding: 40, fontFamily: "Helvetica", fontSize: 10, color: "#1e293b" },
    header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 32 },
    logo: { fontSize: 20, fontFamily: "Helvetica-Bold", color: "#1e40af" },
    title: { fontSize: 24, fontFamily: "Helvetica-Bold", color: "#1e293b", textAlign: "right" },
    badge: { fontSize: 10, color: "#64748b", textAlign: "right", marginTop: 4 },
    section: { marginBottom: 20 },
    label: { fontSize: 8, color: "#94a3b8", fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 },
    value: { fontSize: 10, color: "#1e293b" },
    row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
    tableHeader: { flexDirection: "row", backgroundColor: "#f8fafc", padding: "8 10", borderRadius: 4, marginBottom: 4 },
    tableRow: { flexDirection: "row", padding: "6 10", borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
    col1: { flex: 3 },
    col2: { flex: 1, textAlign: "right" },
    totalRow: { flexDirection: "row", justifyContent: "flex-end", marginTop: 4 },
    totalLabel: { width: 120, textAlign: "right", color: "#64748b" },
    totalValue: { width: 100, textAlign: "right" },
    grandTotal: { flexDirection: "row", justifyContent: "flex-end", marginTop: 8, paddingTop: 8, borderTopWidth: 2, borderTopColor: "#1e40af" },
    grandLabel: { width: 120, textAlign: "right", fontFamily: "Helvetica-Bold", fontSize: 12 },
    grandValue: { width: 100, textAlign: "right", fontFamily: "Helvetica-Bold", fontSize: 12, color: "#1e40af" },
    notes: { marginTop: 24, padding: 12, backgroundColor: "#f8fafc", borderRadius: 4 },
    footer: { position: "absolute", bottom: 30, left: 40, right: 40, textAlign: "center", fontSize: 8, color: "#94a3b8" },
  });

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: quote!.currency }).format(n);
  const fmtDate = (d: Date | null) =>
    d ? new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "—";

  const subtotal = quote.items.reduce(
    (s, i) => s + Number(i.quantity) * Number(i.unitPrice),
    0
  );
  const discountAmt = quote.items.reduce((s, i) => {
    const b = Number(i.quantity) * Number(i.unitPrice);
    return s + (b * Number(i.discount)) / 100;
  }, 0);
  const taxAmt = quote.items.reduce((s, i) => {
    const b = Number(i.quantity) * Number(i.unitPrice);
    const a = b - (b * Number(i.discount)) / 100;
    return s + (a * Number(i.taxRate)) / 100;
  }, 0);

  const doc = React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      { size: "A4", style: styles.page },
      // Header
      React.createElement(
        View,
        { style: styles.header },
        React.createElement(View, null, React.createElement(Text, { style: styles.logo }, "FactoryFlow")),
        React.createElement(
          View,
          null,
          React.createElement(Text, { style: styles.title }, "QUOTATION"),
          React.createElement(Text, { style: styles.badge }, quote.revision > 1 ? `${quote.number} · Rev ${quote.revision}` : quote.number)
        )
      ),
      // Bill to + dates
      React.createElement(
        View,
        { style: styles.row },
        React.createElement(
          View,
          { style: { flex: 1 } },
          React.createElement(Text, { style: styles.label }, "Prepared For"),
          React.createElement(
            Text,
            { style: styles.value },
            quote.contact?.fullName ?? quote.account?.name ?? "—"
          ),
          quote.contact?.email
            ? React.createElement(Text, { style: { ...styles.value, color: "#64748b" } }, quote.contact.email)
            : null,
          quote.contact?.phone
            ? React.createElement(Text, { style: { ...styles.value, color: "#64748b" } }, quote.contact.phone)
            : null,
          quote.account?.name && quote.contact
            ? React.createElement(Text, { style: { ...styles.value, color: "#64748b" } }, quote.account.name)
            : null
        ),
        React.createElement(
          View,
          { style: { flex: 1, alignItems: "flex-end" } },
          React.createElement(Text, { style: styles.label }, "Issue Date"),
          React.createElement(Text, { style: styles.value }, fmtDate(quote.issueDate)),
          quote.expiryDate
            ? React.createElement(
                React.Fragment,
                null,
                React.createElement(Text, { style: { ...styles.label, marginTop: 10 } }, "Valid Until"),
                React.createElement(Text, { style: styles.value }, fmtDate(quote.expiryDate))
              )
            : null
        )
      ),
      // Line items table
      React.createElement(
        View,
        { style: { marginTop: 16, marginBottom: 8 } },
        React.createElement(
          View,
          { style: styles.tableHeader },
          React.createElement(
            Text,
            { style: { ...styles.col1, fontFamily: "Helvetica-Bold", fontSize: 8, color: "#64748b" } },
            "DESCRIPTION"
          ),
          React.createElement(
            Text,
            { style: { ...styles.col2, fontFamily: "Helvetica-Bold", fontSize: 8, color: "#64748b" } },
            "QTY"
          ),
          React.createElement(
            Text,
            { style: { ...styles.col2, fontFamily: "Helvetica-Bold", fontSize: 8, color: "#64748b" } },
            "UNIT PRICE"
          ),
          React.createElement(
            Text,
            { style: { ...styles.col2, fontFamily: "Helvetica-Bold", fontSize: 8, color: "#64748b" } },
            "DISC %"
          ),
          React.createElement(
            Text,
            { style: { ...styles.col2, fontFamily: "Helvetica-Bold", fontSize: 8, color: "#64748b" } },
            "TAX %"
          ),
          React.createElement(
            Text,
            { style: { ...styles.col2, fontFamily: "Helvetica-Bold", fontSize: 8, color: "#64748b" } },
            "AMOUNT"
          )
        ),
        ...quote.items.map((item, i) =>
          React.createElement(
            View,
            { key: i, style: styles.tableRow },
            React.createElement(Text, { style: styles.col1 }, item.description),
            React.createElement(Text, { style: styles.col2 }, String(Number(item.quantity))),
            React.createElement(Text, { style: styles.col2 }, fmt(Number(item.unitPrice))),
            React.createElement(
              Text,
              { style: styles.col2 },
              Number(item.discount) > 0 ? `${Number(item.discount)}%` : "—"
            ),
            React.createElement(
              Text,
              { style: styles.col2 },
              Number(item.taxRate) > 0 ? `${Number(item.taxRate)}%` : "—"
            ),
            React.createElement(Text, { style: styles.col2 }, fmt(Number(item.amount)))
          )
        )
      ),
      // Totals
      React.createElement(
        View,
        { style: styles.totalRow },
        React.createElement(Text, { style: styles.totalLabel }, "Subtotal"),
        React.createElement(Text, { style: styles.totalValue }, fmt(subtotal))
      ),
      discountAmt > 0
        ? React.createElement(
            View,
            { style: styles.totalRow },
            React.createElement(Text, { style: styles.totalLabel }, "Discount"),
            React.createElement(
              Text,
              { style: { ...styles.totalValue, color: "#16a34a" } },
              `-${fmt(discountAmt)}`
            )
          )
        : null,
      taxAmt > 0
        ? React.createElement(
            View,
            { style: styles.totalRow },
            React.createElement(Text, { style: styles.totalLabel }, "Tax"),
            React.createElement(Text, { style: styles.totalValue }, fmt(taxAmt))
          )
        : null,
      React.createElement(
        View,
        { style: styles.grandTotal },
        React.createElement(Text, { style: styles.grandLabel }, "Total"),
        React.createElement(Text, { style: styles.grandValue }, fmt(Number(quote.total)))
      ),
      // Notes / Terms
      quote.notes || quote.terms
        ? React.createElement(
            View,
            { style: styles.notes },
            quote.notes
              ? React.createElement(
                  React.Fragment,
                  null,
                  React.createElement(Text, { style: styles.label }, "Notes"),
                  React.createElement(Text, { style: { ...styles.value, marginBottom: 8 } }, quote.notes)
                )
              : null,
            quote.terms
              ? React.createElement(
                  React.Fragment,
                  null,
                  React.createElement(Text, { style: styles.label }, "Terms & Conditions"),
                  React.createElement(Text, { style: styles.value }, quote.terms)
                )
              : null
          )
        : null,
      React.createElement(
        Text,
        { style: styles.footer },
        `Generated by FactoryFlow · ${new Date().toLocaleDateString()}`
      )
    )
  );

  const buffer = await renderToBuffer(doc);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${quote.number}.pdf"`,
    },
  });
}
