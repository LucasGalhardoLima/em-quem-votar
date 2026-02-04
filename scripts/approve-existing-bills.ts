/**
 * Script para marcar todas as votações existentes como aprovadas
 * 
 * Uso: npx tsx scripts/approve-existing-bills.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🔄 Marcando votações existentes como aprovadas...\n");

  const result = await prisma.bill.updateMany({
    data: {
      status: "approved",
      approvedAt: new Date(),
    },
  });

  console.log(`✅ ${result.count} votações marcadas como aprovadas`);
  console.log("\n🎉 Concluído!");
}

main()
  .catch((e) => {
    console.error("❌ Erro:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
