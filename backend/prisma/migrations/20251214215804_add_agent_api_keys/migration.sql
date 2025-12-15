-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "pubkey" TEXT NOT NULL,
    "reputation" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Agent" (
    "id" TEXT NOT NULL,
    "pubkey" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "name" TEXT,
    "webhookUrl" TEXT,
    "builderCode" TEXT,
    "tier" TEXT NOT NULL DEFAULT 'anonymous',
    "escrowBalance" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Agent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuilderCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "builderPubkey" TEXT NOT NULL,
    "revenueShareBps" INTEGER NOT NULL DEFAULT 5000,
    "tier" TEXT NOT NULL DEFAULT 'pending',
    "totalVolume" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),

    CONSTRAINT "BuilderCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformConfig" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "mode" TEXT NOT NULL DEFAULT 'beta',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userPubkey" TEXT NOT NULL,
    "priceFloor" INTEGER NOT NULL,
    "deviceAttestation" TEXT,
    "connected" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bid" (
    "id" TEXT NOT NULL,
    "agentPubkey" TEXT,
    "maxPricePerSecond" INTEGER NOT NULL,
    "requiredAttentionScore" DOUBLE PRECISION NOT NULL,
    "targetUrl" TEXT,
    "contentUrl" TEXT,
    "expiry" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "targetQuantity" INTEGER NOT NULL DEFAULT 1,
    "durationPerUser" INTEGER NOT NULL DEFAULT 10,
    "validationQuestion" TEXT,

    CONSTRAINT "Bid_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "bidId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'offered',
    "startTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endTime" TIMESTAMP(3),
    "validationAnswer" TEXT,
    "validationSubmittedAt" TIMESTAMP(3),
    "validationResult" TEXT,
    "completedAt" TIMESTAMP(3),
    "humanExitedEarly" BOOLEAN NOT NULL DEFAULT false,
    "actualDuration" INTEGER,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settlement" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "transactionSig" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Settlement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_pubkey_key" ON "User"("pubkey");

-- CreateIndex
CREATE UNIQUE INDEX "Agent_pubkey_key" ON "Agent"("pubkey");

-- CreateIndex
CREATE UNIQUE INDEX "Agent_apiKey_key" ON "Agent"("apiKey");

-- CreateIndex
CREATE UNIQUE INDEX "BuilderCode_code_key" ON "BuilderCode"("code");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userPubkey_fkey" FOREIGN KEY ("userPubkey") REFERENCES "User"("pubkey") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_agentPubkey_fkey" FOREIGN KEY ("agentPubkey") REFERENCES "Agent"("pubkey") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_bidId_fkey" FOREIGN KEY ("bidId") REFERENCES "Bid"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
