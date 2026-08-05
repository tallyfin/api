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

export type Transport = (
  url: string,
  body: string,
  headers: Record<string, string>,
) => Promise<{ status: number }>;

export interface DeliveryResult {
  delivered: boolean;
  status: number;
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
