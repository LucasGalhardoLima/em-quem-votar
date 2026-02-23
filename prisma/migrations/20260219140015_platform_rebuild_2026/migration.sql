-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('PRE_CANDIDATE', 'REGISTERED', 'APPROVED', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "PositionSourceType" AS ENUM ('PLATFORM', 'PUBLIC_STATEMENT', 'VOTE_RECORD', 'INTERVIEW', 'MANUAL');

-- CreateEnum
CREATE TYPE "LegislativeSource" AS ENUM ('CAMARA', 'SENADO');

-- CreateEnum
CREATE TYPE "SpendingType" AS ENUM ('CEAP', 'CAMPAIGN', 'DECLARED_ASSETS');

-- DropIndex
DROP INDEX "Bill_id_key";

-- AlterTable: Add columns to Bill with defaults for existing data
ALTER TABLE "Bill" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "sourceType" TEXT NOT NULL DEFAULT 'camara',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Tag" ADD COLUMN     "description" TEXT;

-- CreateTable
CREATE TABLE "Candidate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "party" TEXT NOT NULL,
    "coalition" TEXT,
    "photoUrl" TEXT,
    "biography" TEXT,
    "registrationStatus" "RegistrationStatus" NOT NULL DEFAULT 'PRE_CANDIDATE',
    "tseId" TEXT,
    "electionType" TEXT NOT NULL DEFAULT 'presidential',
    "number" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Candidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PoliticalTopic" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PoliticalTopic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CandidatePosition" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "stance" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "sourceType" "PositionSourceType" NOT NULL,
    "sourceUrl" TEXT,
    "sourceDate" TIMESTAMP(3),
    "confidence" DOUBLE PRECISION,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CandidatePosition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CandidateTag" (
    "candidateId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "CandidateTag_pkey" PRIMARY KEY ("candidateId","tagId")
);

-- CreateTable
CREATE TABLE "CandidateLegislativeLink" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "sourceType" "LegislativeSource" NOT NULL,
    "sourceId" TEXT NOT NULL,
    "legislaturePeriod" TEXT,

    CONSTRAINT "CandidateLegislativeLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoteRecord" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "voteType" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL DEFAULT 'camara',

    CONSTRAINT "VoteRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpendingRecord" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "type" "SpendingType" NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "category" TEXT,
    "source" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpendingRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizQuestion" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "QuizQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizOption" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "stanceValue" INTEGER NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "icon" TEXT,

    CONSTRAINT "QuizOption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Candidate_tseId_key" ON "Candidate"("tseId");

-- CreateIndex
CREATE INDEX "Candidate_name_idx" ON "Candidate"("name");

-- CreateIndex
CREATE INDEX "Candidate_party_idx" ON "Candidate"("party");

-- CreateIndex
CREATE INDEX "Candidate_registrationStatus_idx" ON "Candidate"("registrationStatus");

-- CreateIndex
CREATE INDEX "Candidate_electionType_idx" ON "Candidate"("electionType");

-- CreateIndex
CREATE UNIQUE INDEX "PoliticalTopic_slug_key" ON "PoliticalTopic"("slug");

-- CreateIndex
CREATE INDEX "CandidatePosition_topicId_idx" ON "CandidatePosition"("topicId");

-- CreateIndex
CREATE UNIQUE INDEX "CandidatePosition_candidateId_topicId_key" ON "CandidatePosition"("candidateId", "topicId");

-- CreateIndex
CREATE INDEX "CandidateTag_tagId_idx" ON "CandidateTag"("tagId");

-- CreateIndex
CREATE INDEX "CandidateTag_candidateId_idx" ON "CandidateTag"("candidateId");

-- CreateIndex
CREATE UNIQUE INDEX "CandidateLegislativeLink_candidateId_key" ON "CandidateLegislativeLink"("candidateId");

-- CreateIndex
CREATE UNIQUE INDEX "CandidateLegislativeLink_sourceType_sourceId_key" ON "CandidateLegislativeLink"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "VoteRecord_candidateId_idx" ON "VoteRecord"("candidateId");

-- CreateIndex
CREATE INDEX "VoteRecord_billId_idx" ON "VoteRecord"("billId");

-- CreateIndex
CREATE UNIQUE INDEX "VoteRecord_candidateId_billId_key" ON "VoteRecord"("candidateId", "billId");

-- CreateIndex
CREATE INDEX "SpendingRecord_candidateId_type_idx" ON "SpendingRecord"("candidateId", "type");

-- CreateIndex
CREATE INDEX "QuizQuestion_topicId_idx" ON "QuizQuestion"("topicId");

-- CreateIndex
CREATE INDEX "QuizQuestion_order_idx" ON "QuizQuestion"("order");

-- CreateIndex
CREATE INDEX "QuizOption_questionId_idx" ON "QuizOption"("questionId");

-- CreateIndex
CREATE INDEX "Bill_sourceType_idx" ON "Bill"("sourceType");

-- AddForeignKey
ALTER TABLE "CandidatePosition" ADD CONSTRAINT "CandidatePosition_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidatePosition" ADD CONSTRAINT "CandidatePosition_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "PoliticalTopic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateTag" ADD CONSTRAINT "CandidateTag_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateTag" ADD CONSTRAINT "CandidateTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateLegislativeLink" ADD CONSTRAINT "CandidateLegislativeLink_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoteRecord" ADD CONSTRAINT "VoteRecord_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoteRecord" ADD CONSTRAINT "VoteRecord_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpendingRecord" ADD CONSTRAINT "SpendingRecord_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizQuestion" ADD CONSTRAINT "QuizQuestion_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "PoliticalTopic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizOption" ADD CONSTRAINT "QuizOption_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "QuizQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

