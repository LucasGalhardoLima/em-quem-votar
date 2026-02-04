/**
 * Script para limpar votações genéricas e gerar descrições simplificadas
 * 
 * Remove votações como "Mantido o texto", "Rejeitado o Requerimento"
 * E gera descrições simplificadas com IA para as que ficarem
 * 
 * Uso: npx tsx scripts/cleanup-and-simplify-bills.ts
 */

import { PrismaClient } from "@prisma/client";
import { VoteClassifierService } from "../app/services/vote-classifier.server";

const prisma = new PrismaClient();

// Padrões de votações genéricas que devem ser removidas
const GENERIC_PATTERNS = [
  /^mantido o texto/i,
  /^rejeitado o requerimento/i,
  /^aprovado o requerimento/i,
  /^arquivado/i,
  /^tramitação/i,
  /^retirada de pauta/i,
];

function isGeneric(title: string, description: string | null): boolean {
  const fullText = (title + " " + (description || "")).toLowerCase();
  return GENERIC_PATTERNS.some(pattern => pattern.test(fullText));
}

async function main() {
  console.log("🧹 Limpando votações genéricas...\n");

  // 1. Buscar todas as votações
  const allBills = await prisma.bill.findMany({
    select: {
      id: true,
      title: true,
      description: true,
      simplifiedDescription: true,
    },
  });

  console.log(`📊 Total de votações: ${allBills.length}\n`);

  // 2. Identificar genéricas
  const genericBills = allBills.filter(bill => 
    isGeneric(bill.title, bill.description)
  );

  console.log(`🗑️  Votações genéricas encontradas: ${genericBills.length}`);
  genericBills.forEach(bill => {
    console.log(`   - ${bill.title.substring(0, 80)}...`);
  });

  // 3. Deletar genéricas
  if (genericBills.length > 0) {
    const genericIds = genericBills.map(b => b.id);
    
    // Deletar vote logs primeiro (FK constraint)
    await prisma.voteLog.deleteMany({
      where: { billId: { in: genericIds } },
    });

    // Deletar bills
    await prisma.bill.deleteMany({
      where: { id: { in: genericIds } },
    });

    console.log(`✅ ${genericBills.length} votações genéricas removidas\n`);
  }

  // 4. Buscar votações relevantes sem descrição simplificada
  const billsNeedingSimplification = await prisma.bill.findMany({
    where: {
      OR: [
        { simplifiedTitle: null },
        { simplifiedTitle: "" },
        { simplifiedDescription: null },
        { simplifiedDescription: "" },
      ],
    },
    select: {
      id: true,
      title: true,
      description: true,
    },
  });

  console.log(`\n🤖 Gerando títulos e descrições simplificadas para ${billsNeedingSimplification.length} votações...\n`);

  // 5. Gerar conteúdo simplificado
  for (const bill of billsNeedingSimplification) {
    console.log(`   Processando: ${bill.title.substring(0, 60)}...`);
    
    const simplified = await VoteClassifierService.simplifyDescription(
      bill.title,
      bill.description
    );

    await prisma.bill.update({
      where: { id: bill.id },
      data: { 
        simplifiedTitle: simplified.title,
        simplifiedDescription: simplified.description,
      },
    });

    console.log(`   ✓ Conteúdo gerado`);
    
    // Rate limiting
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log(`\n🎉 Concluído!`);
  console.log(`   Removidas: ${genericBills.length} votações genéricas`);
  console.log(`   Simplificadas: ${billsNeedingSimplification.length} votações (título + descrição)`);
}

main()
  .catch((e) => {
    console.error("❌ Erro:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
