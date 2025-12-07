# Backend Gateway

> Fastify-based WebSocket and REST gateway for the Attention Marketplace.

## Run

```bash
npm install
npx ts-node src/index.ts
```

Server runs on `http://localhost:3000`.

## Endpoints

| Endpoint        | Type      | Description                        |
|-----------------|-----------|------------------------------------|
| `/ws/events`    | WebSocket | Receives `EngagementEvent` streams |
| `/v1/bids`      | POST      | Agents submit attention bids       |

## Security Notes

- CORS enabled for development (restrict in production).
- Attestation verification is stubbed; implement signature checks before prod.
