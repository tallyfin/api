import { test } from "node:test";
import assert from "node:assert/strict";
import { createInvoice } from "../src/invoices.ts";
import { money } from "../src/money.ts";
import { createPaymentIntent, type PaymentProvider } from "../src/payments.ts";

function openInvoice() {
  const invoice = createInvoice({
    id: "inv_42",
    organizationId: "org_1",
    customerId: "cus_9",
    currency: "USD",
    lineItems: [{ description: "Seats", quantity: 5, unitPrice: money(1200, "USD"), taxRate: 0 }],
  });
  return { ...invoice, status: "open" as const };
}

test("creates an intent for the invoice total", async () => {
  const requests: unknown[] = [];
  const provider: PaymentProvider = {
    async createIntent(request) {
      requests.push(request);
      return { id: "pi_123" };
    },
  };
  const intent = await createPaymentIntent(provider, openInvoice());
  assert.equal(intent.id, "pi_123");
  assert.equal(intent.amount.amount, 6000);
  assert.equal(requests.length, 1);
});

test("refuses invoices that are not open", async () => {
  const provider: PaymentProvider = { createIntent: async () => ({ id: "unused" }) };
  const draft = { ...openInvoice(), status: "draft" as const };
  await assert.rejects(createPaymentIntent(provider, draft), /is draft, not open/);
});
