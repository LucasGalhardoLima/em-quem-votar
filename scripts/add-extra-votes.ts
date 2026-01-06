
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

// Data for new votes
const NEW_VOTES = [
  {
    id: "pl-2253-2022",
    title: "Fim da \"Saidinha\" (PL 2253/22)",
    description: "Projeto de Lei que restringe o benefício da saída temporária para presos condenados, mantendo apenas para estudos e trabalho, excluindo visitas familiares.",
    voteSimDetails: "Aprovou a restrição, dificultando a saída de presos.",
    voteNaoDetails: "Votou para manter as regras atuais de ressocialização.",
    date: new Date("2024-03-20"),
    // Alignment assumptions for simulation (Simplified)
    simParties: ["PL", "PP", "UNIÃO", "REPUBLICANOS", "PSD", "MDB", "NOVO"],
    naoParties: ["PT", "PSOL", "PCdoB", "PV", "REDE"],
  },
  {
    id: "pec-9-2023",
    title: "PEC da Anistia (PEC 9/23)",
    description: "Proposta de Emenda à Constituição que perdoa multas de partidos políticos que não cumpriram cotas mínimas de financiamento para candidaturas de negros e mulheres.",
    voteSimDetails: "Aprovou o perdão das dívidas dos partidos.",
    voteNaoDetails: "Votou contra a anistia, defendendo a punição.",
    date: new Date("2024-07-11"),
    // Broad support ("Centrão" + major parties often vote YES on self-interest)
    simParties: ["PL", "PT", "PP", "UNIÃO", "REPUBLICANOS", "PSD", "MDB", "PDT", "PSB"],
    naoParties: ["PSOL", "NOVO"], // Usually anti-system/purists oppose this
  },
  {
    id: "pl-4173-2023",
    title: "Taxação das Offshores (PL 4173/23)",
    description: "Projeto que institui a tributação periódica de fundos exclusivos e investimentos de brasileiros no exterior (offshores).",
    voteSimDetails: "Aprovou a cobrança de impostos sobre super-ricos.",
    voteNaoDetails: "Rejeitou o aumento da carga tributária.",
    date: new Date("2023-10-25"),
    simParties: ["PT", "PCdoB", "PV", "PSB", "PDT", "PSOL", "REDE", "PSD", "MDB", "UNIÃO"], 
    naoParties: ["PL", "NOVO"], 
  },
  {
    id: "pec-45-2023",
    title: "PEC das Drogas (PEC 45/2023)",
    description: "Proposta de Emenda à Constituição que criminaliza o porte e a posse de qualquer quantidade de drogas.",
    voteSimDetails: "Votou A FAVOR da criminalização do porte de drogas.",
    voteNaoDetails: "Votou CONTRA a criminalização, defendendo a distinção entre usuário e traficante.",
    date: new Date("2024-04-16"),
    simParties: ["PL", "PP", "UNIÃO", "REPUBLICANOS", "PSD", "MDB", "NOVO"],
    naoParties: ["PT", "PSOL", "PCdoB", "PV", "REDE"],
  }
];

// Tag Definitions for the script
const TAGS_TO_APPLY = [
    { slug: "linha-dura", name: "Linha Dura", category: "Segurança" },
    { slug: "garantista", name: "Garantista", category: "Segurança" },
    { slug: "conservador-costumes", name: "Conservador (Costumes)", category: "Costumes" },
    { slug: "progressista-costumes", name: "Progressista (Costumes)", category: "Costumes" },
    { slug: "baixo-custo", name: "Baixo Custo", category: "Uso de Verba" },
    { slug: "gastao", name: "Alto Custo", category: "Uso de Verba" },
    { slug: "assiduo", name: "Assíduo", category: "Assiduidade" },
    { slug: "gazeteiro", name: "Gazeteiro", category: "Assiduidade" },
    { slug: "jovem", name: "Jovem", category: "Perfil" },
    { slug: "novato", name: "Novato", category: "Perfil" },
    { slug: "veterano", name: "Veterano", category: "Perfil" },
];

async function main() {
  console.log("🗳️ Adding Extra Votes & Enriching Data...");

  // 0. Ensure Tags Exist
  for (const tag of TAGS_TO_APPLY) {
      await db.tag.upsert({
          where: { slug: tag.slug },
          update: { name: tag.name, category: tag.category },
          create: { name: tag.name, category: tag.category, slug: tag.slug }
      });
  }

  const politicians = await db.politician.findMany();
  
  // Track votes for tagging
  const politicianVotes: Record<string, Record<string, string>> = {}; // politicianId -> { billId: voteType }

  for (const vote of NEW_VOTES) {
    console.log(`Processing Vote: ${vote.title}...`);

    // 1. Create/Update Bill
    await db.bill.upsert({
      where: { id: vote.id },
      update: {
        title: vote.title,
        description: vote.description,
        voteSimDetails: vote.voteSimDetails,
        voteNaoDetails: vote.voteNaoDetails,
        voteDate: vote.date,
      },
      create: {
        id: vote.id,
        title: vote.title,
        description: vote.description,
        voteSimDetails: vote.voteSimDetails,
        voteNaoDetails: vote.voteNaoDetails,
        voteDate: vote.date,
      }
    });

    // 2. Simulate Votes
    const voteLogs = [];
    for (const politician of politicians) {
      let voteType = "ABSTENÇÃO";
      
      const isSimParty = vote.simParties.includes(politician.party);
      const isNaoParty = vote.naoParties.includes(politician.party);

      if (isSimParty) {
        voteType = Math.random() > 0.1 ? "SIM" : "NÃO"; 
      } else if (isNaoParty) {
        voteType = Math.random() > 0.1 ? "NÃO" : "SIM";
      } else {
        voteType = Math.random() > 0.5 ? "SIM" : "NÃO";
      }

      voteLogs.push({
        politicianId: politician.id,
        billId: vote.id,
        voteType: voteType
      });

      if (!politicianVotes[politician.id]) politicianVotes[politician.id] = {};
      politicianVotes[politician.id][vote.id] = voteType;
    }

    // Clear existing votes for this bill
    await db.voteLog.deleteMany({ where: { billId: vote.id } });
    await db.voteLog.createMany({ data: voteLogs });

    console.log(`  - Registered ${voteLogs.length} simulated votes.`);
  }

  // 3. Simulate Metrics & Profiling
  console.log("📊 Simulating Metrics (Spending, Attendance, Age)...");
  
  const AVG_SPENDING = 45000; // Monthly average assumption
  
  for (const politician of politicians) {
      // Metrics Simulation
      const spending = Math.floor(Math.random() * (60000 - 15000) + 15000); // 15k to 60k
      const attendanceRate = parseFloat((Math.random() * (100 - 60) + 60).toFixed(1)); // 60% to 100%
      
      // Demographics Simulation
      const age = Math.floor(Math.random() * (80 - 25) + 25);
      const isNovato = Math.random() > 0.6; // 40% chance of being novato

      await db.politician.update({
          where: { id: politician.id },
          data: {
              spending: spending,
              attendanceRate: attendanceRate,
              // Note: We don't have age/terms columns in the simplified schema yet, 
              // so we'll just deduce tags from these "virtual" values for now.
              // If schema update is needed, user didn't explicitly ask for schema migration, 
              // but we can store these as tags. 
          }
      });

      // --- Tag Assignment Logic ---
      const tagsToAdd: string[] = [];

      // A. Security (PL 2253/22 - Saidinha)
      const voteSaidinha = politicianVotes[politician.id]?.["pl-2253-2022"];
      if (voteSaidinha === "SIM") tagsToAdd.push("linha-dura");
      if (voteSaidinha === "NÃO") tagsToAdd.push("garantista");

      // B. Customs (PEC 45/23 - Drogas)
      const voteDrogas = politicianVotes[politician.id]?.["pec-45-2023"];
      if (voteDrogas === "SIM") tagsToAdd.push("conservador-costumes");
      if (voteDrogas === "NÃO") tagsToAdd.push("progressista-costumes");

      // C. Performance
      if (spending < AVG_SPENDING * 0.8) tagsToAdd.push("baixo-custo");
      if (spending > AVG_SPENDING * 1.2) tagsToAdd.push("gastao");
      
      if (attendanceRate < 80) tagsToAdd.push("gazeteiro");
      if (attendanceRate >= 95) tagsToAdd.push("assiduo");

      // D. Demographics
      if (age < 35) tagsToAdd.push("jovem");
      if (isNovato) tagsToAdd.push("novato");
      else tagsToAdd.push("veterano");


      // Clean up old tags from these categories to avoid duplicates/conflicts if re-run
      // (Simplified: we just try to add them. The join table unique constraint might hit if we don't handle it,
      // but upserting or `connect` with ignore might be tricky. Best to list IDs and connect.)
      
      // Actually, let's just create the relations. `createMany` with `skipDuplicates` is good for join tables.
      if (tagsToAdd.length > 0) {
          const tags = await db.tag.findMany({ where: { slug: { in: tagsToAdd } } });
          
          // Delete existing tags of these categories for this politician (to reset)
          const categoriesToStartFresh = ["Segurança", "Costumes", "Performance", "Uso de Verba", "Assiduidade", "Perfil"];
          const tagsToDelete = await db.tag.findMany({ where: { category: { in: categoriesToStartFresh } } });
          const tagIdsToDelete = tagsToDelete.map(t => t.id);
          
          await db.politicianTag.deleteMany({
              where: {
                  politicianId: politician.id,
                  tagId: { in: tagIdsToDelete }
              }
          });

          const data = tags.map(t => ({
              politicianId: politician.id,
              tagId: t.id
          }));
          
          await db.politicianTag.createMany({
              data,
              skipDuplicates: true
          });
      }
  }

  console.log("✅ Data Enrichment Complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
