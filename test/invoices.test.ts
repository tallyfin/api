import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateTotals, createInvoice } from "../src/invoices.ts";
import { money } from "../src/money.ts";

const lineItems = [
  { description: "Design retainer", quantity: 1, unitPrice: money(250000, "EUR"), taxRate: 0.19 },
  { description: "Hosting", quantity: 3, unitPrice: money(1999, "EUR"), taxRate: 0.19 },
];

test("calculates subtotal, tax and total", () => {
  const totals = calculateTotals({ currency: "EUR", lineItems });
  assert.equal(totals.subtotal.amount, 255997);
  assert.equal(totals.tax.amount, 48639);
  assert.equal(totals.total.amount, 304636);
});

test("new invoices are drafts due in 14 days", () => {
  const invoice = createInvoice({
    id: "inv_1",
    organizationId: "org_1",
    customerId: "cus_1",
    currency: "EUR",
    lineItems,
    issuedAt: new Date("2026-06-01T00:00:00Z"),
  });
  assert.equal(invoice.status, "draft");
  assert.equal(invoice.dueAt.toISOString(), "2026-06-15T00:00:00.000Z");
});

test("invoice numbers increase", () => {
  const base = { organizationId: "org_1", customerId: "cus_1", currency: "EUR" as const, lineItems };
  const first = createInvoice({ id: "a", ...base });
  const second = createInvoice({ id: "b", ...base });
  assert.ok(Number(second.number.slice(4)) > Number(first.number.slice(4)));
});
