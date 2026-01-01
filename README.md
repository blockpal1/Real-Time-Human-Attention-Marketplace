# Attentium: Real-Time Human Attention Marketplace

> **The world's first decentralized marketplace for verified human attention.**
> Humans sell seconds of focused attention to AI agents in real-time, settled on Solana.

---

## 🚀 Overview

Attentium is a **privacy-first** web platform where specialized "human nodes" verify content/data for AI agents.
We use a **Hybrid x402 Architecture**:
1.  **Payment (L1)**: USDC settlement on Solana via the x402 (Payment Required) standard.
2.  **Matching (L2)**: High-frequency, atomic order book running on Redis.
3.  **Privacy (Edge)**: Facial analysis runs **entirely on-device** (MediaPipe). No raw video ever leaves the browser.

---

## 📚 Documentation

- **[Setup Guide](./docs/setup-guide.md)**: Zero-to-One deployment guide (Solana Playground).
- **[Introduction](./docs/introduction.mdx)**: For AI Agent Developers integrating the API.
- **[API Reference](./docs/api-reference.mdx)**: Full endpoint documentation.
- **[Protocol Spec](./PROTOCOL.md)**: Deep dive into the economic model and on-chain logic.

---

## 📂 Project Structure

| Directory | Purpose |
|-----------|---------|
| `/frontend` | **Focus Portal**: React/Vite web app where humans earn crypto. |
| `/backend` | **Matching Engine**: Node.js/Redis engine handling bids and orders. |
| `/payment-router` | **Smart Contracts**: Anchor program managing non-custodial escrows. |
| `/docs` | **Documentation**: Guides, API references, and architecture specs. |

---

## 🛠️ Quick Start

### Prerequisites
- Node.js (v18+)
- Redis (for backend matching engine)

### 1. Payment Router (One-Time Setup)
Before running the app, you need to deploy and initialize the smart contract.
👉 **[Follow the Setup Guide](./docs/setup-guide.md)**

### 2. Backend (API & Matcher)
Handles user sessions, order book, and matching logic.
```bash
cd backend
# Create .env from example (see setup-guide)
npm install
npm run dev
# API running on http://localhost:3000
```

### 3. Frontend (Focus Portal)
The user interface for Attention Providers.
```bash
cd frontend
# Create .env from example (see setup-guide)
npm install
npm run dev
# Open http://localhost:5173
```

---

## 🏗️ Architecture

```mermaid
graph TD
    User[User (Browser)] -->|1. Connect Wallet| WebApp[Focus Portal (React/Vite)]
    WebApp -->|2. Liveness & Focus (MediaPipe)| OnDeviceAI[On-Device AI]
    OnDeviceAI -->|3. Verified Attention Signals| Gateway[Backend API]
    
    Gateway -->|4. Attention Supply| Matcher[Matching Engine]
    AI_Agent[AI Agent / Advertiser] -->|5. Bids (x402 Protocol)| Gateway
    
    Gateway -->|6. Escrow Settlement| Solana[Solana Blockchain]
    Solana -->|7. Payout| User
```

## 🔒 Privacy & Security

| Data Point | Storage/Transmission | Description |
|------------|----------------------|-------------|
| **Video Feed** | **Local Only** | Processed in browser memory (MediaPipe). Never transmitted. |
| **Face Landmarks** | **Local Only** | Used to calculate head pose and attention score. |
| **Attention Score** | Transmitted | boolean/float (0-1) sent to backend to proof work. |
| **Verification** | Transmitted | User answers/clicks are recorded to validate the session. |

---

## ✅ License
MIT
