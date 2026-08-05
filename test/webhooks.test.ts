import { test } from "node:test";
import assert from "node:assert/strict";
import { deliver, sign } from "../src/webhooks.ts";

const endpoint = { url: "https://example.test/hooks", secret: "whsec_test" };
const event = { id: "evt_1", type: "invoice.paid", payload: { invoiceId: "inv_1" } };

test("signs the timestamp and body", async () => {
  let headers: Record<string, string> = {};
  let body = "";
  await deliver(endpoint, event, async (_url, sentBody, sentHeaders) => {
    headers = sentHeaders;
    body = sentBody;
    return { status: 200 };
  }, 1_780_000_000_000);
  assert.equal(headers["tallyfin-signature"], `t=1780000000,v1=${sign("whsec_test", 1780000000, body)}`);
});

test("reports non-2xx responses as not delivered", async () => {
  const result = await deliver(endpoint, event, async () => ({ status: 503 }));
  assert.deepEqual(result, { delivered: false, status: 503 });
});
