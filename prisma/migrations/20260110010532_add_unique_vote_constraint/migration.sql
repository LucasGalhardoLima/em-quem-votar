/*
  Warnings:

  - A unique constraint covering the columns `[id]` on the table `Bill` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[politicianId,billId]` on the table `VoteLog` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateTable
CREATE TABLE "Subscriber" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Subscriber_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Subscriber_email_key" ON "Subscriber"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Bill_id_key" ON "Bill"("id");

-- CreateIndex
CREATE INDEX "Politician_state_idx" ON "Politician"("state");

-- CreateIndex
CREATE UNIQUE INDEX "VoteLog_politicianId_billId_key" ON "VoteLog"("politicianId", "billId");
