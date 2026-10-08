import { test } from "node:test";
import assert from "node:assert/strict";
import {
  backoffDelay,
  DEFAULT_RETRY_POLICY,
  deliver,
  deliverWithRetry,
  isRetryable,
  sign,
  type Transport,
} from "../src/webhooks.ts";

const endpoint = { url: "https://example.test/hooks", secret: "whsec_test" };
const event = { id: "evt_1", type: "invoice.paid", payload: { invoiceId: "inv_1" } };

function respond(...statuses: number[]): { transport: Transport; calls: () => number } {
  let calls = 0;
  return {
    transport: async () => ({ status: statuses[Math.min(calls++, statuses.length - 1)] }),
    calls: () => calls,
  };
}

function recordSleeps() {
  const delays: number[] = [];
  return { delays, sleep: async (ms: number) => void delays.push(ms) };
}

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

test("retries server errors until delivered", async () => {
  const { transport, calls } = respond(502, 503, 200);
  const { delays, sleep } = recordSleeps();
  const outcome = await deliverWithRetry(endpoint, event, transport, { sleep, random: () => 1 });
  assert.equal(outcome.delivered, true);
  assert.equal(outcome.attempts, 3);
  assert.equal(calls(), 3);
  assert.deepEqual(delays, [30_000, 60_000]);
});

test("gives up after the last attempt", async () => {
  const { transport, calls } = respond(500);
  const { sleep } = recordSleeps();
  const outcome = await deliverWithRetry(endpoint, event, transport, { sleep });
  assert.equal(outcome.delivered, false);
  assert.equal(calls(), DEFAULT_RETRY_POLICY.maxAttempts);
});

test("does not retry client errors", async () => {
  const { transport, calls } = respond(400);
  const outcome = await deliverWithRetry(endpoint, event, transport, recordSleeps());
  assert.deepEqual([outcome.delivered, calls()], [false, 1]);
});

test("stops on 410 Gone and flags the endpoint", async () => {
  const outcome = await deliverWithRetry(endpoint, event, respond(410).transport, recordSleeps());
  assert.equal(outcome.endpointGone, true);
});

test("treats network errors as retryable", async () => {
  let calls = 0;
  const transport: Transport = async () => {
    if (calls++ === 0) throw new Error("ECONNRESET");
    return { status: 204 };
  };
  const outcome = await deliverWithRetry(endpoint, event, transport, recordSleeps());
  assert.deepEqual([outcome.delivered, outcome.attempts], [true, 2]);
});

test("waits as long as Retry-After asks", async () => {
  let calls = 0;
  const transport: Transport = async () => (calls++ === 0 ? { status: 429, retryAfterSeconds: 120 } : { status: 200 });
  const { delays, sleep } = recordSleeps();
  await deliverWithRetry(endpoint, event, transport, { sleep });
  assert.deepEqual(delays, [120_000]);
});

test("caps the backoff at the policy maximum", () => {
  assert.equal(backoffDelay(20, DEFAULT_RETRY_POLICY, () => 1), DEFAULT_RETRY_POLICY.maxDelayMs);
});

test("classifies retryable statuses", () => {
  assert.deepEqual([0, 408, 429, 500, 503].map(isRetryable), [true, true, true, true, true]);
  assert.deepEqual([400, 401, 404, 422].map(isRetryable), [false, false, false, false]);
});
