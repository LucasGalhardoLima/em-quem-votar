-- Reposicionamento 002: eleição real de 2026.
-- Acrescenta as situações de registro que o TSE de fato usa, os campos da
-- chapa e dos documentos oficiais, e a rastreabilidade de fonte por posição.

-- AlterEnum: novos valores só são ADICIONADOS (nenhum é usado nesta mesma
-- migration, o que mantém a operação válida dentro da transação no PG 12+).
ALTER TYPE "RegistrationStatus" ADD VALUE IF NOT EXISTS 'PENDING_JUDGMENT';
ALTER TYPE "RegistrationStatus" ADD VALUE IF NOT EXISTS 'SUB_JUDICE';
ALTER TYPE "RegistrationStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

-- AlterTable: Candidate
ALTER TABLE "Candidate"
  ADD COLUMN IF NOT EXISTS "tseStatusLabel"    TEXT,
  ADD COLUMN IF NOT EXISTS "tseStatusDetail"   TEXT,
  ADD COLUMN IF NOT EXISTS "viceName"          TEXT,
  ADD COLUMN IF NOT EXISTS "viceParty"         TEXT,
  ADD COLUMN IF NOT EXISTS "coalitionParties"  TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "governmentPlanUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "officialSiteUrl"   TEXT,
  ADD COLUMN IF NOT EXISTS "socialLinks"       JSONB,
  ADD COLUMN IF NOT EXISTS "dataSource"        TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS "sourceUrl"         TEXT,
  ADD COLUMN IF NOT EXISTS "lastSyncedAt"      TIMESTAMP(3);

-- AlterTable: CandidatePosition (documento, página e trecho citado)
ALTER TABLE "CandidatePosition"
  ADD COLUMN IF NOT EXISTS "sourceDocument" TEXT,
  ADD COLUMN IF NOT EXISTS "sourcePage"     INTEGER,
  ADD COLUMN IF NOT EXISTS "sourceQuote"    TEXT;

-- Índice para a listagem por situação de registro dentro da eleição atual.
CREATE INDEX IF NOT EXISTS "Candidate_electionType_registrationStatus_idx"
  ON "Candidate" ("electionType", "registrationStatus");
