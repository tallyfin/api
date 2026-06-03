import { test } from "node:test";
import assert from "node:assert/strict";
import { add, formatMoney, money } from "../src/money.ts";

test("adds amounts in the same currency", () => {
  assert.deepEqual(add(money(1250, "EUR"), money(99, "EUR")), money(1349, "EUR"));
});

test("refuses to add different currencies", () => {
  assert.throws(() => add(money(100, "EUR"), money(100, "USD")), /Cannot add EUR to USD/);
});

test("rejects fractional minor units", () => {
  assert.throws(() => money(10.5, "EUR"), /minor units/);
});

test("formats for display", () => {
  assert.equal(formatMoney(money(123456, "USD")), "$1,234.56");
});
