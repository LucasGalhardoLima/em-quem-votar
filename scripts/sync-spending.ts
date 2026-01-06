
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function syncSpending() {
  console.log("🚀 Iniciando sincronização de gastos reais...");

  const politicians = await prisma.politician.findMany({
    select: { id: true, name: true }
  });

  console.log(`📊 Processando ${politicians.length} políticos...`);

  // We'll calculate the global average to apply tags correctly
  const results: { id: string; avgMonthly: number }[] = [];

  for (const p of politicians) {
    try {
      const url = `https://dadosabertos.camara.leg.br/api/v2/deputados/${p.id}/despesas?ano=2024&ordem=ASC&ordenarPor=mes`;
      const response = await fetch(url, {
        headers: { 'Accept': 'application/json' }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: any = await response.json();
      const expenses = data.dados;
      
      if (expenses.length === 0) {
        results.push({ id: p.id, avgMonthly: 0 });
        continue;
      }

      // Group by month to find monthly totals
      const monthlyTotals: Record<number, number> = {};
      expenses.forEach((e: any) => {
        monthlyTotals[e.mes] = (monthlyTotals[e.mes] || 0) + e.valorLiquido;
      });

      const months = Object.keys(monthlyTotals).length;
      const total = Object.values(monthlyTotals).reduce((a, b) => a + b, 0);
      const avgMonthly = months > 0 ? total / months : 0;

      results.push({ id: p.id, avgMonthly });
      console.log(`✅ ${p.name}: R$ ${avgMonthly.toFixed(2)}/mês`);
    } catch (error) {
      console.error(`❌ Erro ao buscar gastos de ${p.name} (ID: ${p.id}):`, error.message);
    }
    
    // Rate limit precaution
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Calculate Global Average
  const nonZeroResults = results.filter(r => r.avgMonthly > 0);
  const globalSum = nonZeroResults.reduce((sum, r) => sum + r.avgMonthly, 0);
  const globalAvg = nonZeroResults.length > 0 ? globalSum / nonZeroResults.length : 45000;

  console.log(`\n📈 Média Global Calculada: R$ ${globalAvg.toFixed(2)}`);

  // Update Database
  console.log("💾 Salvando no banco de dados e atualizando tags...");

  for (const r of results) {
    const isLowCost = r.avgMonthly > 0 && r.avgMonthly < globalAvg * 0.8;
    const isHighCost = r.avgMonthly > globalAvg * 1.2;

    // 1. Update Spending & Attendance (simulated attendance for now if not available)
    await prisma.politician.update({
      where: { id: r.id },
      data: { spending: r.avgMonthly }
    });

    // 2. Manage Tags
    // First, remove existing spending tags to avoid duplicates/conflicts
    await prisma.politicianTag.deleteMany({
      where: {
        politicianId: r.id,
        tag: { slug: { in: ["baixo-custo", "gastao"] } }
      }
    });

    if (isLowCost) {
      const tag = await prisma.tag.findUnique({ where: { slug: "baixo-custo" } });
      if (tag) {
        await prisma.politicianTag.create({
          data: { politicianId: r.id, tagId: tag.id }
        });
      }
    } else if (isHighCost) {
      const tag = await prisma.tag.findUnique({ where: { slug: "gastao" } });
      if (tag) {
        await prisma.politicianTag.create({
          data: { politicianId: r.id, tagId: tag.id }
        });
      }
    }
  }

  console.log("\n✨ Sincronização concluída com sucesso!");
}

syncSpending()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
