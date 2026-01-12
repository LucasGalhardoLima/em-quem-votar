import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🧹 Iniciando limpeza de votos duplicados...");

  // 1. Encontrar duplicatas
  // Como o Prisma não tem um "groupBy" com "having" nativo que retorne os IDs facilmente para deletar,
  // vamos fazer uma query raw ou buscar tudo e processar (se não for muitos dados).
  // Para ser seguro e eficiente com SQL:
  
  // Buscar grupos de (politicianId, billId) que aparecem mais de uma vez
  const duplicates = await prisma.voteLog.groupBy({
    by: ['politicianId', 'billId'],
    _count: {
      id: true
    },
    having: {
      id: {
        _count: {
          gt: 1
        }
      }
    }
  });

  console.log(`🔍 Encontrados ${duplicates.length} pares (politico, pauta) com votos duplicados.`);

  for (const dup of duplicates) {
    // Buscar todos os registros para esse par
    const votes = await prisma.voteLog.findMany({
      where: {
        politicianId: dup.politicianId,
        billId: dup.billId
      },
      orderBy: {
        // Tentar manter o mais "oficial" ou recente se tivesse data, mas voteLog não tem createdAt
        // Então vamos manter o primeiro e deletar o resto
        id: 'asc'
      }
    });

    if (votes.length > 1) {
      // Manter o primeiro
      const toKeep = votes[0];
      const toDelete = votes.slice(1);

      console.log(`   - Político ${dup.politicianId}, Pauta ${dup.billId}: Mantendo ${toKeep.id}, deletando ${toDelete.length} duplicatas.`);

      await prisma.voteLog.deleteMany({
        where: {
          id: {
            in: toDelete.map(v => v.id)
          }
        }
      });
    }
  }

  console.log("✅ Limpeza concluída!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
