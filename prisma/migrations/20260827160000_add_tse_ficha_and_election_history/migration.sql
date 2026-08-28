-- Ficha da candidatura no DivulgaCandContas: aptidão em três estados, número
-- do processo de registro, descrição do bem declarado e histórico eleitoral.
--
-- Tudo aditivo e anulável de propósito: o sync completo roda 4x/dia contra
-- este mesmo banco e não pode falhar linha a linha por coluna obrigatória
-- recém-criada.

-- AlterTable
ALTER TABLE "Candidate" ADD COLUMN     "tseApto" BOOLEAN,
ADD COLUMN     "tseProcessNumber" TEXT;

-- AlterTable
ALTER TABLE "SpendingRecord" ADD COLUMN     "description" TEXT;

-- CreateTable
CREATE TABLE "CandidateElectionHistory" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "tsePriorId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "office" TEXT NOT NULL,
    "ue" TEXT,
    "party" TEXT,
    "resultLabel" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CandidateElectionHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CandidateElectionHistory_candidateId_idx" ON "CandidateElectionHistory"("candidateId");

-- CreateIndex
CREATE INDEX "CandidateElectionHistory_year_idx" ON "CandidateElectionHistory"("year");

-- CreateIndex
CREATE UNIQUE INDEX "CandidateElectionHistory_candidateId_tsePriorId_key" ON "CandidateElectionHistory"("candidateId", "tsePriorId");

-- AddForeignKey
ALTER TABLE "CandidateElectionHistory" ADD CONSTRAINT "CandidateElectionHistory_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
