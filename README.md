# Attentium (MVP v0.1)

> **Privacy-First Marketplace** where humans sell verified seconds of attention to AI agents.

## Quick Start

```bash
# 1. Chrome Extension
cd chrome-extension && npm install && npm run build
# Load `dist/` as unpacked extension in Chrome

# 2. Backend Gateway
cd backend/gateway && npm install && npx ts-node src/index.ts

# 3. Matcher (Separate Terminal)
cd backend/matcher && npx ts-node src/index.ts

# 4. Payment Simulation
cd payments/simulation && npx ts-node src/main.ts
```

## Architecture

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│ Chrome Extension│ WSS  │    Gateway      │      │    Matcher      │
│  (Attention     │─────▶│   (Node.js)     │─────▶│   (Node.js)     │
│   Provider)     │      │   Port 3000     │      │   [OrderBook]   │
└─────────────────┘      └─────────────────┘      └────────┬────────┘
                                                           │
                          ┌────────────────────────────────▼────────┐
                          │        Payment Router (Simulation)       │
                          │   Escrow -> Settle -> User Wallet        │
                          └──────────────────────────────────────────┘
```

## Key Privacy Guarantees

| Data Type          | Leaves Device? | Notes                              |
|--------------------|----------------|------------------------------------|
| Raw Video/Audio    | **NO**         | Processed entirely on-device       |
| Face Mesh Coords   | **NO**         | Used only for local score compute  |
| Engagement Score   | Yes (0-1)      | Transmitted via WebSocket          |
| Wallet Address     | Yes            | For payment settlement             |

## Modules

| Path                      | Description                        |
|---------------------------|------------------------------------|
| `/chrome-extension`       | Manifest V3 Extension (React)      |
| `/backend/gateway`        | WebSocket + REST Gateway (Fastify) |
| `/backend/matcher`        | Greedy OrderBook Matcher           |
| `/payments/simulation`    | Mock Solana Ledger & Router        |
| `/specs`                  | OpenAPI + Anchor IDL Definitions   |

## Integration Checklist for PM

- [ ] Load Chrome Extension and grant camera permission
- [ ] Start Gateway (`npm run dev` or `ts-node`)
- [ ] Start Matcher
- [ ] Open Extension Popup -> Connect Wallet -> Start Earning
- [ ] Run `payments/simulation` to verify settlement math

## License

MIT
