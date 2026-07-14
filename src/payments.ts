import { calculateTotals, type Invoice } from "./invoices.ts";
import type { Money } from "./money.ts";

export type PaymentIntentStatus = "requires_payment" | "succeeded" | "failed";

export interface PaymentIntent {
  id: string;
  invoiceId: string;
  amount: Money;
  status: PaymentIntentStatus;
  createdAt: Date;
}

export interface PaymentProvider {
  createIntent(request: { amount: Money; reference: string }): Promise<{ id: string }>;
}

export async function createPaymentIntent(
  provider: PaymentProvider,
  invoice: Invoice,
): Promise<PaymentIntent> {
  if (invoice.status !== "open") {
    throw new Error(`Invoice ${invoice.number} is ${invoice.status}, not open`);
  }
  const { total } = calculateTotals(invoice);
  const { id } = await provider.createIntent({ amount: total, reference: invoice.number });
  return {
    id,
    invoiceId: invoice.id,
    amount: total,
    status: "requires_payment",
    createdAt: new Date(),
  };
}
