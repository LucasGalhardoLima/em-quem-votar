import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🧨 WIPING ALL VOTES AND BILLS...");
  
  // Delete VoteLogs first (foreign key to Bill)
  console.log("Deleting VoteLogs...");
  await prisma.voteLog.deleteMany({});
  
  // Delete PoliticianTags (some are created by votes, we'll wipe all to be safe and let seed recreate tags)
  // Actually, wait. Tags like 'Liberal' might be used for manual categorization?
  // The seed uses 'upsert' for Tags, so it's fine.
  // But PoliticianTag is the link. The seed creates these links based on votes.
  // So we should delete PoliticianTags too to avoid ghosts.
  console.log("Deleting PoliticianTags...");
  await prisma.politicianTag.deleteMany({});

  // Delete Bills
  console.log("Deleting Bills...");
  await prisma.bill.deleteMany({});

  console.log("✅ Database cleansed of votes.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
