# Attentium: Real-Time Human Attention Marketplace
> **The world's first decentralized marketplace for verified human attention.**
> Humans sell seconds of focused attention to AI agents in real-time.

## 🚀 Overview

Attentium is a **privacy-first** web platform where users (Attention Providers) verify their focus via on-device AI and earn crypto for every second of attention they provide to matched tasks.

**Core Features:**
- **Focus Portal**: Futuristic "Quantum Glass" web interface for users.
- **Privacy-First**: Facial analysis runs **entirely on-device** (MediaPipe). No raw video ever leaves the browser.
- **Real-Time Matching**: Low-latency engine matches AI bids ($/sec) with available human attention.
- **Instant Settlement**: Simulated high-speed payments (Solana/micropayments architecture).

## 🛠️ Quick Start

### Prerequisites
- Node.js (v18+)
- npm

### 1. Frontend (Focus Portal)
The user interface for Attention Providers.
```bash
cd frontend
npm install
npm run dev
# Open http://localhost:5173
```

### 2. Backend (API & Matcher)
Handles user sessions, order book, and matching logic.
```bash
cd backend
npm install
npm run dev
# API running on http://localhost:3000
```

### 3. Monitoring (Optional)
Debug dashboard to view real-time system state.
```bash
node serve_monitor.js
# Open http://localhost:8080/monitor.html
```

## 🏗️ Architecture

```mermaid
graph TD
    User[User (Browser)] -->|1. Connect Wallet| WebApp[Focus Portal (React/Vite)]
    WebApp -->|2. Liveness & Focus (MediaPipe)| OnDeviceAI[On-Device AI]
    OnDeviceAI -->|3. Verified Attention Signals| Gateway[Backend API]
    
    Gateway -->|4. Attention Supply| Matcher[Matching Engine]
    AI_Agent[AI Agent / Advertiser] -->|5. Bids ($/sec)| Matcher
    
    Matcher -->|6. Match Created| Gateway
    Gateway -->|7. Content & Settlement| WebApp
```

## 🔒 Privacy & Security
| Data Point | Storage/Transmission | Description |
|------------|----------------------|-------------|
| **Video Feed** | **Local Only** | Processed in browser memory (MediaPipe). Never transmitted. |
| **Face Landmarks** | **Local Only** | Used to calculate head pose and attention score. |
| **Attention Score** | Transmitted | boolean/float (0-1) sent to backend to proof work. |
| **Punt/Answer** | Transmitted | User interactions with content are recorded for validation. |

## 📂 Project Structure

| Directory | Purpose |
|-----------|---------|
| `/frontend` | **Focus Portal**: React/Vite web app with "Quantum Glass" UI & MediaPipe integration. |
| `/backend` | **Core Services**: Node.js API, Order Book, and Matching Engine. |
| `/solana-program` | **Smart Contracts**: Anchor program for escrow and settlement (Reference). |
| `/specs` | **API Definitions**: OpenAPI specs for backend limits. |

## ✅ Verification Flow
1.  **Connect Wallet** (Phantom/Mock).
2.  **Liveness Check**: Verify user is a real human (Smile/Blink/Head Tilt challenges).
3.  **Focus Session**:
    -   Camera tracks head pose (Pitch/Yaw).
    -   User watches content/tasks.
    -   Earnings accumulate in real-time ($/sec).
4.  **Completion**: Submit answer/verification to claim funds.

## 📄 License
MIT
