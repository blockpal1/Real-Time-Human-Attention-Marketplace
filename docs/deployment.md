# Deployment Guide

This guide covers how to launch the Attentium platform in both **Local Development** and **Production** environments.

## 1. Local Development
For rapid iteration with hot-reloading.

### 1.1 Start Backend (Port 3000)
Run the matching engine and API server.
```bash
cd backend
npm install
npm run dev
# Expected Output: [Server] Listening on port 3000
```

### 1.2 Start Frontend (Port 5173)
Run the React/Vite development server.
```bash
cd frontend
npm install
npm run dev
# Expected Output: Local: http://localhost:5173/
```

---

## 2. Production Deployment
For live environments (Ubuntu/Docker/Vercel).

### 2.1 Backend (Node.js)
The backend should be compiled to JavaScript and run with a process manager.

1.  **Build**:
    ```bash
    cd backend
    npm ci
    npm run build
    ```
    *This compiles TypeScript `src/` to `dist/`.*

2.  **Run with PM2 (Recommended)**:
    It is best practice to use PM2 to keep the server alive.
    ```bash
    npm install -g pm2
    pm2 start dist/server.js --name "attentium-backend"
    pm2 save
    ```

3.  **Environment Variables**:
    Ensure your `.env` file is present in the `backend/` root with production values (Solana RPC, Redis URL, Admin Keys).

### 2.2 Frontend (Static Site)
The frontend builds to a static bundle of HTML/CSS/JS.

1.  **Build**:
    ```bash
    cd frontend
    npm ci
    npm run build
    ```
    *Output will be in the `dist/` directory.*

2.  **Serve**:
    - **Nginx/Apache**: Point your web root to `frontend/dist`.
    - **Vercel/Netlify**: Connect your repo and set the "Build Command" to `npm run build` and "Output Directory" to `dist`.
    - **Docker**: Copy `dist/` into an Nginx container.

---

## 3. Infrastructure Requirements

### Redis (Required)
The backend requires a Redis instance for the order book.
- **Local**: `redis-server`
- **Production**: Managed Redis (e.g., AWS ElastiCache, Upstash) or a secured local instance.
- **Config**: Set `REDIS_URL` in `backend/.env`.

### Solana RPC
Using public devnet nodes in production is unreliable.
- **Recommended**: Use a dedicated RPC provider (Helius, Alchemy, QuickNode).
- **Config**: Set `SOLANA_RPC_URL` in `backend/.env`.
