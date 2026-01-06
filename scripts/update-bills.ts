
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  console.log("Updating bill descriptions...");

  const updates = [
    {
      id: "2196833-326", // Reforma Tributária
      description: "Altera o sistema tributário nacional para simplificar impostos sobre o consumo (unificando PIS, Cofins, IPI, ICMS e ISS), criar um sistema de cashback para famílias de baixa renda e tributar bens de luxo como jatinhos e iates."
    },
    {
      id: "345311-270", // Marco Temporal
      description: "Define que indígenas só têm direito à demarcação de terras que já ocupavam na data da promulgação da Constituição de 1988 (5 de outubro), alterando os critérios atuais de reconhecimento de terras ancestrais."
    },
    {
      id: "2357053-47", // Arcabouço Fiscal
      description: "Novo regime fiscal que substitui o Teto de Gastos, estabelecendo regras para o crescimento das despesas públicas atrelado ao aumento da arrecadação, com o objetivo de equilibrar as contas públicas sem congelar investimentos."
    }
  ];

  for (const update of updates) {
    const bill = await db.bill.update({
      where: { id: update.id },
      data: { description: update.description },
    });
    console.log(`Updated: ${bill.title}`);
  }

  console.log("Done!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
