import { createHmac } from "node:crypto";

export interface WebhookEndpoint {
  url: string;
  secret: string;
}

export interface WebhookEvent {
  id: string;
  type: string;
  payload: unknown;
}

export interface TransportResponse {
  status: number;
  /** Parsed from the Retry-After header, when present. */
  retryAfterSeconds?: number;
}

export type Transport = (
  url: string,
  body: string,
  headers: Record<string, string>,
) => Promise<TransportResponse>;

export interface DeliveryResult {
  delivered: boolean;
  status: number;
}

export interface RetryPolicy {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

/** 8 attempts over roughly 13 hours. */
export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 8,
  baseDelayMs: 30_000,
  maxDelayMs: 6 * 60 * 60 * 1000,
};

export interface RetryOutcome {
  delivered: boolean;
  attempts: number;
  lastStatus: number;
  /** The endpoint answered 410 Gone and should be disabled. */
  endpointGone: boolean;
}

export function sign(secret: string, timestamp: number, body: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

export async function deliver(
  endpoint: WebhookEndpoint,
  event: WebhookEvent,
  transport: Transport,
  now = Date.now(),
): Promise<DeliveryResult> {
  const body = JSON.stringify({ id: event.id, type: event.type, data: event.payload });
  const timestamp = Math.floor(now / 1000);
  const { status } = await transport(endpoint.url, body, {
    "content-type": "application/json",
    "tallyfin-signature": `t=${timestamp},v1=${sign(endpoint.secret, timestamp, body)}`,
  });
  return { delivered: status >= 200 && status < 300, status };
}

/** Network errors and timeouts are reported as status 0. */
export function isRetryable(status: number): boolean {
  return status === 0 || status === 408 || status === 429 || status >= 500;
}

/** Exponential backoff with full jitter. `attempt` starts at 1. */
export function backoffDelay(attempt: number, policy: RetryPolicy, random = Math.random): number {
  const ceiling = Math.min(policy.maxDelayMs, policy.baseDelayMs * 2 ** (attempt - 1));
  return Math.floor(random() * ceiling);
}

export async function deliverWithRetry(
  endpoint: WebhookEndpoint,
  event: WebhookEvent,
  transport: Transport,
  options: {
    policy?: RetryPolicy;
    sleep?: (ms: number) => Promise<void>;
    random?: () => number;
  } = {},
): Promise<RetryOutcome> {
  const policy = options.policy ?? DEFAULT_RETRY_POLICY;
  const sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  let retryAfterSeconds: number | undefined;
  const recordingTransport: Transport = async (url, body, headers) => {
    try {
      const response = await transport(url, body, headers);
      retryAfterSeconds = response.retryAfterSeconds;
      return response;
    } catch {
      retryAfterSeconds = undefined;
      return { status: 0 };
    }
  };

  let lastStatus = 0;
  for (let attempt = 1; attempt <= policy.maxAttempts; attempt++) {
    const result = await deliver(endpoint, event, recordingTransport);
    lastStatus = result.status;
    if (result.delivered) {
      return { delivered: true, attempts: attempt, lastStatus, endpointGone: false };
    }
    if (result.status === 410) {
      return { delivered: false, attempts: attempt, lastStatus, endpointGone: true };
    }
    if (!isRetryable(result.status) || attempt === policy.maxAttempts) {
      return { delivered: false, attempts: attempt, lastStatus, endpointGone: false };
    }
    const delay = retryAfterSeconds !== undefined
      ? Math.min(retryAfterSeconds * 1000, policy.maxDelayMs)
      : backoffDelay(attempt, policy, options.random);
    await sleep(delay);
  }
  return { delivered: false, attempts: policy.maxAttempts, lastStatus, endpointGone: false };
}
