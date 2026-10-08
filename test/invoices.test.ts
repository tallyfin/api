import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateTotals, createInvoice } from "../src/invoices.ts";
import { money } from "../src/money.ts";
import { InMemoryInvoiceNumbers } from "../src/sequences.ts";

const lineItems = [
  { description: "Design retainer", quantity: 1, unitPrice: money(250000, "EUR"), taxRate: 0.19 },
  { description: "Hosting", quantity: 3, unitPrice: money(1999, "EUR"), taxRate: 0.19 },
];

const base = { organizationId: "org_1", customerId: "cus_1", currency: "EUR" as const, lineItems };

test("calculates subtotal, tax and total", () => {
  const totals = calculateTotals({ currency: "EUR", lineItems });
  assert.equal(totals.subtotal.amount, 255997);
  assert.equal(totals.tax.amount, 48639);
  assert.equal(totals.total.amount, 304636);
});

test("new invoices are drafts due in 14 days", async () => {
  const invoice = await createInvoice(
    { id: "inv_1", ...base, issuedAt: new Date("2026-06-01T00:00:00Z") },
    new InMemoryInvoiceNumbers(),
  );
  assert.equal(invoice.status, "draft");
  assert.equal(invoice.dueAt.toISOString(), "2026-06-15T00:00:00.000Z");
});

test("invoice numbers are sequential per organization", async () => {
  const numbers = new InMemoryInvoiceNumbers();
  const first = await createInvoice({ id: "a", ...base }, numbers);
  const other = await createInvoice({ id: "b", ...base, organizationId: "org_2" }, numbers);
  const second = await createInvoice({ id: "c", ...base }, numbers);
  assert.deepEqual([first.number, other.number, second.number], ["INV-0001", "INV-0001", "INV-0002"]);
});
