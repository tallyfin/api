import { add, money, type Currency, type Money } from "./money.ts";
import type { InvoiceNumberSource } from "./sequences.ts";

export interface LineItem {
  description: string;
  quantity: number;
  unitPrice: Money;
  /** For example 0.19 for 19% VAT. */
  taxRate: number;
}

export type InvoiceStatus = "draft" | "open" | "paid" | "void";

export interface Invoice {
  id: string;
  number: string;
  organizationId: string;
  customerId: string;
  currency: Currency;
  lineItems: LineItem[];
  issuedAt: Date;
  dueAt: Date;
  status: InvoiceStatus;
}

export interface InvoiceTotals {
  subtotal: Money;
  tax: Money;
  total: Money;
}

const PAYMENT_TERMS_DAYS = 14;

export function calculateTotals(invoice: Pick<Invoice, "currency" | "lineItems">): InvoiceTotals {
  let subtotal = money(0, invoice.currency);
  let tax = money(0, invoice.currency);
  for (const item of invoice.lineItems) {
    const net = money(item.quantity * item.unitPrice.amount, invoice.currency);
    subtotal = add(subtotal, net);
    tax = add(tax, money(Math.round(net.amount * item.taxRate), invoice.currency));
  }
  return { subtotal, tax, total: add(subtotal, tax) };
}

export async function createInvoice(
  input: {
    id: string;
    organizationId: string;
    customerId: string;
    currency: Currency;
    lineItems: LineItem[];
    issuedAt?: Date;
  },
  numbers: InvoiceNumberSource,
): Promise<Invoice> {
  const issuedAt = input.issuedAt ?? new Date();
  const dueAt = new Date(issuedAt);
  dueAt.setUTCDate(dueAt.getUTCDate() + PAYMENT_TERMS_DAYS);
  return {
    ...input,
    number: await numbers.next(input.organizationId),
    issuedAt,
    dueAt,
    status: "draft",
  };
}
