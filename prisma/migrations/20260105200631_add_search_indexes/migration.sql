-- CreateIndex
CREATE INDEX "Bill_voteDate_idx" ON "Bill"("voteDate");

-- CreateIndex
CREATE INDEX "Politician_name_idx" ON "Politician"("name");

-- CreateIndex
CREATE INDEX "Politician_party_idx" ON "Politician"("party");

-- CreateIndex
CREATE INDEX "PoliticianTag_tagId_idx" ON "PoliticianTag"("tagId");

-- CreateIndex
CREATE INDEX "PoliticianTag_politicianId_idx" ON "PoliticianTag"("politicianId");

-- CreateIndex
CREATE INDEX "VoteLog_politicianId_idx" ON "VoteLog"("politicianId");

-- CreateIndex
CREATE INDEX "VoteLog_billId_idx" ON "VoteLog"("billId");
