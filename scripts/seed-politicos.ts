import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const CAMARA_API = "https://dadosabertos.camara.leg.br/api/v2";

const KEY_VOTES = [
  {
    id: '2196833-326', // Verified: Reforma Tributária (PEC 45/2019) - 1º Turno (Sim: 382, Não: 118)
    name: 'Reforma Tributária (1º Turno)',
    tagNameSim: 'Reformista Econômico',
    tagSlugSim: 'reformista-economico',
    tagNameNao: 'Conservador Econômico',
    tagSlugNao: 'conservador-economico',
    category: 'Economia'
  },
  {
    id: '345311-270', // Verified: Marco Temporal (PL 490/2007) - Substitutivo (Sim: 283, Não: 155)
    name: 'Marco Temporal',
    tagNameSim: 'Ruralista',
    tagSlugSim: 'ruralista',
    tagNameNao: 'Ambientalista',
    tagSlugNao: 'ambientalista',
    category: 'Agro & Meio Ambiente'
  },
  {
    id: '2357053-47', // Verified: Arcabouço Fiscal (PLP 93/2023) - Substitutivo (Sim: 372, Não: 108)
    name: 'Arcabouço Fiscal',
    tagNameSim: 'Governista/Flexível',
    tagSlugSim: 'governista-flexivel',
    tagNameNao: 'Oposição/Rigoroso',
    tagSlugNao: 'oposicao-rigoroso',
    category: 'Economia'
  }
];

async function fetchJson(url: string) {
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
  return response.json();
}

async function seedPoliticians() {
  console.log("🌱 Fetching politicians from API...");
  const data = await fetchJson(`${CAMARA_API}/deputados?ordem=ASC&ordenarPor=nome`);
  const deputados = data.dados;
  
  console.log(`Found ${deputados.length} politicians. Preparing Batch Upsert...`);
  
  const upsertOperations = deputados.map((deputy: any) => 
    prisma.politician.upsert({
      where: { id: String(deputy.id) },
      update: {
        name: deputy.nome,
        party: deputy.siglaPartido,
        state: deputy.siglaUf,
        photoUrl: deputy.urlFoto,
      },
      create: {
        id: String(deputy.id),
        name: deputy.nome,
        party: deputy.siglaPartido,
        state: deputy.siglaUf,
        photoUrl: deputy.urlFoto,
      },
    })
  );

  // Chunking to avoid giant transaction hanging
  const chunkSize = 50;
  for (let i = 0; i < upsertOperations.length; i += chunkSize) {
    const chunk = upsertOperations.slice(i, i + chunkSize);
    console.log(`  - Processing chunk ${i / chunkSize + 1}/${Math.ceil(upsertOperations.length / chunkSize)}...`);
    await prisma.$transaction(chunk);
  }
  
  console.log("✅ Politicians seeded.");
}

async function seedVotes() {
  console.log("🗳️ Starting Sniper Voting Seed (Optimized)...");

  const allPoliticians = await prisma.politician.findMany({ select: { id: true } });
  const politicianIds = new Set(allPoliticians.map(p => p.id));

  for (const voteMeta of KEY_VOTES) {
    console.log(`Processing: ${voteMeta.name} (ID: ${voteMeta.id})...`);

    const [tagSim, tagNao] = await Promise.all([
      prisma.tag.upsert({
        where: { slug: voteMeta.tagSlugSim },
        update: {},
        create: { name: voteMeta.tagNameSim, slug: voteMeta.tagSlugSim, category: voteMeta.category }
      }),
      prisma.tag.upsert({
        where: { slug: voteMeta.tagSlugNao },
        update: {},
        create: { name: voteMeta.tagNameNao, slug: voteMeta.tagSlugNao, category: voteMeta.category }
      })
    ]);

    let voteDate = new Date();
    let voteDescription = `Votação sobre ${voteMeta.name}`;
    try {
        const details = await fetchJson(`${CAMARA_API}/votacoes/${voteMeta.id}`);
        if(details.dados.dataHoraRegistro) voteDate = new Date(details.dados.dataHoraRegistro);
        if(details.dados.descricao) voteDescription = details.dados.descricao;
    } catch(e) { console.warn("Details fetch failed, using defaults"); }

    const bill = await prisma.bill.upsert({
        where: { id: voteMeta.id },
        update: { title: voteMeta.name },
        create: { id: voteMeta.id, title: voteMeta.name, description: voteDescription, voteDate }
    });

    const response = await fetch(`${CAMARA_API}/votacoes/${voteMeta.id}/votos`);
    const data = await response.json();
    const votosAPI = data.dados;

    const voteLogsToCreate: any[] = [];
    const politicianTagsToCreate: any[] = [];

    for (const voto of votosAPI) {
      const depId = String(voto.deputado_.id);
      if (!politicianIds.has(depId)) continue; 

      const tipoVoto = voto.tipoVoto.toUpperCase();

      voteLogsToCreate.push({
        politicianId: depId,
        billId: bill.id,
        voteType: tipoVoto
      });

      if (tipoVoto === 'SIM') {
        politicianTagsToCreate.push({ politicianId: depId, tagId: tagSim.id });
      } else if (tipoVoto === 'NÃO') {
        politicianTagsToCreate.push({ politicianId: depId, tagId: tagNao.id });
      }
    }

    if (voteLogsToCreate.length > 0) {
      await prisma.voteLog.createMany({
        data: voteLogsToCreate,
        skipDuplicates: true 
      });
    }

    if (politicianTagsToCreate.length > 0) {
      await prisma.politicianTag.createMany({
        data: politicianTagsToCreate,
        skipDuplicates: true
      });
    }

    console.log(`  - Batch Inserted: ${voteLogsToCreate.length} logs and ${politicianTagsToCreate.length} tags.`);
  }
}

async function main() {
    try {
        console.time("Total Seed Time");
        // await seedPoliticians(); // Already seeded 513 politicians
        await seedVotes();
        console.timeEnd("Total Seed Time");
    } catch(e) {
        console.error(e);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
