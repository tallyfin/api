export type Currency = "EUR" | "USD" | "GBP";

/** An amount in minor units (cents). */
export interface Money {
  amount: number;
  currency: Currency;
}

export function money(amount: number, currency: Currency): Money {
  if (!Number.isInteger(amount)) {
    throw new Error(`Amounts must be in minor units, got ${amount}`);
  }
  return { amount, currency };
}

export function add(a: Money, b: Money): Money {
  if (a.currency !== b.currency) {
    throw new Error(`Cannot add ${a.currency} to ${b.currency}`);
  }
  return { amount: a.amount + b.amount, currency: a.currency };
}

export function formatMoney(value: Money, locale = "en-US"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: value.currency,
  }).format(value.amount / 100);
}
