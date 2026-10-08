import { test } from "node:test";
import assert from "node:assert/strict";
import { formatInvoiceNumber, InMemoryInvoiceNumbers, PostgresInvoiceNumbers, type Sql } from "../src/sequences.ts";

test("pads invoice numbers", () => {
  assert.equal(formatInvoiceNumber("INV-", 42, 4), "INV-0042");
  assert.equal(formatInvoiceNumber("2026/", 12345, 4), "2026/12345");
});

test("numbers each organization separately", async () => {
  const numbers = new InMemoryInvoiceNumbers();
  assert.equal(await numbers.next("org_a"), "INV-0001");
  assert.equal(await numbers.next("org_b"), "INV-0001");
  assert.equal(await numbers.next("org_a"), "INV-0002");
});

test("reads prefix and padding from the sequence row", async () => {
  const calls: unknown[][] = [];
  const sql: Sql = {
    async query<Row>(_text: string, params: unknown[]) {
      calls.push(params);
      return [{ value: "318", prefix: "BP-", padding: 5 }] as Row[];
    },
  };
  assert.equal(await new PostgresInvoiceNumbers(sql).next("org_a"), "BP-00318");
  assert.deepEqual(calls, [["org_a"]]);
});

test("fails loudly when an organization has no sequence", async () => {
  const sql: Sql = { query: async () => [] };
  await assert.rejects(new PostgresInvoiceNumbers(sql).next("org_missing"), /No invoice sequence/);
});
