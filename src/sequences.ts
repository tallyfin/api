export interface InvoiceNumberSource {
  /** Reserves the next invoice number for the organization. */
  next(organizationId: string): Promise<string>;
}

export function formatInvoiceNumber(prefix: string, value: number, padding: number): string {
  return `${prefix}${String(value).padStart(padding, "0")}`;
}

export interface Sql {
  query<Row>(text: string, params: unknown[]): Promise<Row[]>;
}

interface SequenceRow {
  value: string;
  prefix: string;
  padding: number;
}

export class PostgresInvoiceNumbers implements InvoiceNumberSource {
  readonly #sql: Sql;

  constructor(sql: Sql) {
    this.#sql = sql;
  }

  async next(organizationId: string): Promise<string> {
    const [row] = await this.#sql.query<SequenceRow>(
      `UPDATE invoice_sequences
          SET value = value + 1, updated_at = now()
        WHERE organization_id = $1
    RETURNING value, prefix, padding`,
      [organizationId],
    );
    if (!row) {
      throw new Error(`No invoice sequence for organization ${organizationId}`);
    }
    return formatInvoiceNumber(row.prefix, Number(row.value), row.padding);
  }
}

/** For tests and local development. */
export class InMemoryInvoiceNumbers implements InvoiceNumberSource {
  readonly #values = new Map<string, number>();
  readonly #prefix: string;

  constructor(prefix = "INV-") {
    this.#prefix = prefix;
  }

  async next(organizationId: string): Promise<string> {
    const value = (this.#values.get(organizationId) ?? 0) + 1;
    this.#values.set(organizationId, value);
    return formatInvoiceNumber(this.#prefix, value, 4);
  }
}
