-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "gameId" INTEGER NOT NULL,
    "senderSubdivisionId" INTEGER,
    "senderUserId" TEXT,
    "recipientSubdivisionId" INTEGER,
    "recipientIsAdmin" BOOLEAN NOT NULL DEFAULT false,
    "channel" TEXT NOT NULL DEFAULT 'COMMS',
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Message_gameId_createdAt_idx" ON "Message"("gameId", "createdAt");

-- CreateIndex
CREATE INDEX "Message_gameId_recipientSubdivisionId_idx" ON "Message"("gameId", "recipientSubdivisionId");

-- CreateIndex
CREATE INDEX "Message_gameId_senderSubdivisionId_idx" ON "Message"("gameId", "senderSubdivisionId");

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderUserId_fkey" FOREIGN KEY ("senderUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
