# Webhooks

Tallyfin sends a `POST` with a JSON body to each registered endpoint when an event happens.

## Signatures

Every request has a `Tallyfin-Signature` header:

```
Tallyfin-Signature: t=1780000000,v1=5257a869e7ecebeda32affa62cdca3fa51cad7e77a0e56ff536d0ce8e108d8bd
```

`v1` is an HMAC-SHA256 of `"{t}.{body}"` using the endpoint's signing secret. Reject requests
where `t` is more than 5 minutes old.

## Retries

A delivery counts as successful when the endpoint answers with any `2xx` status.

| Response | What happens |
|---|---|
| `2xx` | Delivered |
| Timeout, connection error, `408`, `429`, `5xx` | Retried with exponential backoff |
| `410 Gone` | Not retried. The endpoint is disabled |
| Any other `4xx` | Not retried |

Retries start 30 seconds after the first failure and double each time, up to 6 hours between
attempts, with random jitter. After 8 attempts (about 13 hours) the event is dropped.

If the endpoint sends a `Retry-After` header, the next attempt waits that long instead.
