-- Fase A: Presidente + Governador.
-- `uf` é nula para Presidente (âmbito nacional) e obrigatória na prática para
-- governador. Não há NOT NULL porque as 13 candidaturas presidenciais já
-- gravadas ficariam inválidas — a obrigatoriedade vive na aplicação.
ALTER TABLE "Candidate" ADD COLUMN "uf" TEXT;

-- (electionType, uf) é o recorte de toda listagem por estado.
CREATE INDEX "Candidate_electionType_uf_idx" ON "Candidate"("electionType", "uf");
CREATE INDEX "Candidate_uf_idx" ON "Candidate"("uf");
