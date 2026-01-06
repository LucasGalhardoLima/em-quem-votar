
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  console.log("Updating vote details...");

  const updates = [
    {
      id: "2196833-326", // Reforma Tributária
      voteSimDetails: "Aprovou a unificação dos impostos sobre consumo.",
      voteNaoDetails: "Rejeitou a mudança no sistema tributário."
    },
    {
      id: "345311-270", // Marco Temporal
      voteSimDetails: "Votou para limitar demarcações à data de 1988.",
      voteNaoDetails: "Votou contra o limite temporal para demarcações."
    },
    {
      id: "2357053-47", // Arcabouço Fiscal
      voteSimDetails: "Aprovou o novo regime fiscal de controle de gastos.",
      voteNaoDetails: "Rejeitou as novas regras fiscais."
    }
  ];

  for (const update of updates) {
    const bill = await db.bill.update({
      where: { id: update.id },
      data: { 
        voteSimDetails: update.voteSimDetails,
        voteNaoDetails: update.voteNaoDetails
      },
    });
    console.log(`Updated details for: ${bill.title}`);
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
