-- CreateEnum
CREATE TYPE "Role" AS ENUM ('PLAYER', 'ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "GameStatus" AS ENUM ('SETUP', 'ACTIVE', 'PAUSED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('DRAFT', 'SUBMITTED');

-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'PLAYER',
    "status" "UserStatus" NOT NULL DEFAULT 'PENDING',
    "displayName" TEXT,
    "prefParentCompany" TEXT,
    "prefParentPerk" TEXT,
    "prefChoicePersonnel" JSONB,
    "prefDesiredName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Game" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "seed" TEXT NOT NULL,
    "turnNumber" INTEGER NOT NULL DEFAULT 1,
    "status" "GameStatus" NOT NULL DEFAULT 'SETUP',
    "turnLengthHours" INTEGER NOT NULL DEFAULT 96,
    "turnDeadline" TIMESTAMP(3),
    "stateJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubdivisionAssignment" (
    "id" TEXT NOT NULL,
    "gameId" INTEGER NOT NULL,
    "subdivisionId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubdivisionAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Submission" (
    "id" TEXT NOT NULL,
    "gameId" INTEGER NOT NULL,
    "turnNumber" INTEGER NOT NULL,
    "subdivisionId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "submissionJson" JSONB NOT NULL,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'SUBMITTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TurnLog" (
    "id" TEXT NOT NULL,
    "gameId" INTEGER NOT NULL,
    "turnNumber" INTEGER NOT NULL,
    "logJson" JSONB NOT NULL,
    "eventJson" JSONB,
    "scoreboardJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TurnLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL,
    "gameId" INTEGER NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "gameId" INTEGER,
    "adminUserId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "beforeJson" JSONB,
    "afterJson" JSONB,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchProposal" (
    "id" TEXT NOT NULL,
    "gameId" INTEGER NOT NULL,
    "subdivisionId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "proposalText" TEXT NOT NULL,
    "status" "ProposalStatus" NOT NULL DEFAULT 'PENDING',
    "adminResponse" TEXT,
    "grantedEffectsJson" JSONB,
    "resolvedByUserId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResearchProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminQueuedAction" (
    "id" TEXT NOT NULL,
    "gameId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "payloadJson" JSONB NOT NULL,
    "appliedTurn" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminQueuedAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubdivisionState" (
    "gameId" INTEGER NOT NULL,
    "subdivisionId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "parentCompany" TEXT NOT NULL,
    "parentPerk" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "earthRelations" INTEGER NOT NULL,
    "resourcesJson" JSONB NOT NULL,
    "composite" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rank" INTEGER NOT NULL DEFAULT 0,
    "categoriesJson" JSONB,
    "turnNumber" INTEGER NOT NULL,

    CONSTRAINT "SubdivisionState_pkey" PRIMARY KEY ("gameId","subdivisionId")
);

-- CreateTable
CREATE TABLE "BuildingState" (
    "gameId" INTEGER NOT NULL,
    "buildingId" INTEGER NOT NULL,
    "subdivisionId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "col" INTEGER NOT NULL,
    "row" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "garrisonJson" JSONB NOT NULL,
    "modulesJson" JSONB NOT NULL,

    CONSTRAINT "BuildingState_pkey" PRIMARY KEY ("gameId","buildingId")
);

-- CreateTable
CREATE TABLE "ModuleState" (
    "gameId" INTEGER NOT NULL,
    "moduleId" INTEGER NOT NULL,
    "buildingId" INTEGER NOT NULL,
    "subdivisionId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,

    CONSTRAINT "ModuleState_pkey" PRIMARY KEY ("gameId","moduleId")
);

-- CreateTable
CREATE TABLE "PersonnelState" (
    "gameId" INTEGER NOT NULL,
    "personnelId" INTEGER NOT NULL,
    "subdivisionId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "assignedBuildingId" INTEGER,
    "assignedVehicleId" INTEGER,

    CONSTRAINT "PersonnelState_pkey" PRIMARY KEY ("gameId","personnelId")
);

-- CreateTable
CREATE TABLE "VehicleState" (
    "gameId" INTEGER NOT NULL,
    "vehicleId" INTEGER NOT NULL,
    "subdivisionId" INTEGER NOT NULL,
    "hull" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "col" INTEGER NOT NULL,
    "row" INTEGER NOT NULL,
    "crewJson" JSONB NOT NULL,
    "modulesJson" JSONB NOT NULL,

    CONSTRAINT "VehicleState_pkey" PRIMARY KEY ("gameId","vehicleId")
);

-- CreateTable
CREATE TABLE "HexState" (
    "gameId" INTEGER NOT NULL,
    "col" INTEGER NOT NULL,
    "row" INTEGER NOT NULL,
    "terrain" TEXT NOT NULL,
    "ownerSubdivisionId" INTEGER,
    "surveyed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "HexState_pkey" PRIMARY KEY ("gameId","col","row")
);

-- CreateTable
CREATE TABLE "MarketPriceState" (
    "gameId" INTEGER NOT NULL,
    "resource" TEXT NOT NULL,
    "livePrice" INTEGER NOT NULL,
    "cumulativeBought" INTEGER NOT NULL,
    "cumulativeSold" INTEGER NOT NULL,
    "turnNumber" INTEGER NOT NULL,

    CONSTRAINT "MarketPriceState_pkey" PRIMARY KEY ("gameId","resource")
);

-- CreateTable
CREATE TABLE "EquityPriceState" (
    "gameId" INTEGER NOT NULL,
    "issuerSubdivisionId" INTEGER NOT NULL,
    "sharePrice" INTEGER NOT NULL,

    CONSTRAINT "EquityPriceState_pkey" PRIMARY KEY ("gameId","issuerSubdivisionId")
);

-- CreateTable
CREATE TABLE "EquityHoldingState" (
    "gameId" INTEGER NOT NULL,
    "issuerSubdivisionId" INTEGER NOT NULL,
    "holderSubdivisionId" INTEGER NOT NULL,
    "shares" INTEGER NOT NULL,

    CONSTRAINT "EquityHoldingState_pkey" PRIMARY KEY ("gameId","issuerSubdivisionId","holderSubdivisionId")
);

-- CreateTable
CREATE TABLE "ActiveEffectState" (
    "gameId" INTEGER NOT NULL,
    "effectId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "turnsRemaining" INTEGER NOT NULL,
    "magnitude" INTEGER,
    "subdivisionId" INTEGER,
    "buildingId" INTEGER,

    CONSTRAINT "ActiveEffectState_pkey" PRIMARY KEY ("gameId","effectId")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SubdivisionAssignment_userId_key" ON "SubdivisionAssignment"("userId");

-- CreateIndex
CREATE INDEX "SubdivisionAssignment_gameId_idx" ON "SubdivisionAssignment"("gameId");

-- CreateIndex
CREATE UNIQUE INDEX "SubdivisionAssignment_gameId_subdivisionId_key" ON "SubdivisionAssignment"("gameId", "subdivisionId");

-- CreateIndex
CREATE INDEX "Submission_gameId_turnNumber_idx" ON "Submission"("gameId", "turnNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Submission_gameId_turnNumber_subdivisionId_key" ON "Submission"("gameId", "turnNumber", "subdivisionId");

-- CreateIndex
CREATE INDEX "TurnLog_gameId_idx" ON "TurnLog"("gameId");

-- CreateIndex
CREATE UNIQUE INDEX "TurnLog_gameId_turnNumber_key" ON "TurnLog"("gameId", "turnNumber");

-- CreateIndex
CREATE INDEX "Announcement_gameId_idx" ON "Announcement"("gameId");

-- CreateIndex
CREATE INDEX "AuditLog_gameId_idx" ON "AuditLog"("gameId");

-- CreateIndex
CREATE INDEX "AuditLog_adminUserId_idx" ON "AuditLog"("adminUserId");

-- CreateIndex
CREATE INDEX "ResearchProposal_gameId_subdivisionId_idx" ON "ResearchProposal"("gameId", "subdivisionId");

-- CreateIndex
CREATE INDEX "AdminQueuedAction_gameId_idx" ON "AdminQueuedAction"("gameId");

-- CreateIndex
CREATE INDEX "SubdivisionState_gameId_idx" ON "SubdivisionState"("gameId");

-- CreateIndex
CREATE INDEX "BuildingState_gameId_subdivisionId_idx" ON "BuildingState"("gameId", "subdivisionId");

-- CreateIndex
CREATE INDEX "ModuleState_gameId_buildingId_idx" ON "ModuleState"("gameId", "buildingId");

-- CreateIndex
CREATE INDEX "PersonnelState_gameId_subdivisionId_idx" ON "PersonnelState"("gameId", "subdivisionId");

-- CreateIndex
CREATE INDEX "VehicleState_gameId_subdivisionId_idx" ON "VehicleState"("gameId", "subdivisionId");

-- CreateIndex
CREATE INDEX "HexState_gameId_idx" ON "HexState"("gameId");

-- CreateIndex
CREATE INDEX "MarketPriceState_gameId_idx" ON "MarketPriceState"("gameId");

-- CreateIndex
CREATE INDEX "EquityPriceState_gameId_idx" ON "EquityPriceState"("gameId");

-- CreateIndex
CREATE INDEX "EquityHoldingState_gameId_idx" ON "EquityHoldingState"("gameId");

-- CreateIndex
CREATE INDEX "ActiveEffectState_gameId_idx" ON "ActiveEffectState"("gameId");

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubdivisionAssignment" ADD CONSTRAINT "SubdivisionAssignment_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubdivisionAssignment" ADD CONSTRAINT "SubdivisionAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TurnLog" ADD CONSTRAINT "TurnLog_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchProposal" ADD CONSTRAINT "ResearchProposal_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResearchProposal" ADD CONSTRAINT "ResearchProposal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminQueuedAction" ADD CONSTRAINT "AdminQueuedAction_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubdivisionState" ADD CONSTRAINT "SubdivisionState_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuildingState" ADD CONSTRAINT "BuildingState_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModuleState" ADD CONSTRAINT "ModuleState_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonnelState" ADD CONSTRAINT "PersonnelState_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleState" ADD CONSTRAINT "VehicleState_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HexState" ADD CONSTRAINT "HexState_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketPriceState" ADD CONSTRAINT "MarketPriceState_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquityPriceState" ADD CONSTRAINT "EquityPriceState_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquityHoldingState" ADD CONSTRAINT "EquityHoldingState_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActiveEffectState" ADD CONSTRAINT "ActiveEffectState_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;
