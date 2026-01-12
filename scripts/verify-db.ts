import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const politicians = await prisma.politician.count();
  const votes = await prisma.voteLog.count();
  const bills = await prisma.bill.count();
  const tags = await prisma.tag.count();
  
  console.log(`📊 DB Status:`);
  console.log(`   - Politicians: ${politicians}`);
  console.log(`   - Bills: ${bills}`);
  console.log(`   - Votes (Logs): ${votes}`);
  console.log(`   - Tags: ${tags}`);
}

main().finally(() => prisma.$disconnect());
