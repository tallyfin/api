# tallyfin/api

Invoice, payment and webhook service behind Tallyfin.

## Development

Requires Node 22 or later. No install step is needed to run the tests.

```sh
npm test
```

Money is always stored in minor units (cents). Never use floats for amounts.
