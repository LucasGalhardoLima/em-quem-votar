import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const CAMARA_API = "https://dadosabertos.camara.leg.br/api/v2";

// Config: Look back how many days?
const DAYS_LOOKBACK = 7; 
const MIN_DIVERGENCE_RATIO = 0.2; // Minorias must be at least 20% of votes to be "controversial"

async function fetchJson(url: string) {
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
  return response.json();
}

/**
 * Heuristic to determine if a vote is "Relevant" enough to show in the app.
 * We want controversial votes (Polarization), not unanimous "Moção de Aplauso".
 */
function isRelevant(sim: number, nao: number, total: number): boolean {
    if (total < 50) return false; // Quorum too low
    
    const ratioSim = sim / total;
    const ratioNao = nao / total;

    // Divergence check: Neither side should have > (1 - MIN_DIVERGENCE)
    // e.g. if MIN=0.2 (20%), then if SIM > 80% or NAO > 80%, it's "Consensus" (ignore).
    // EXCEPT if it's a huge Constitutional Amendment (PEC), maybe we keep it? 
    // For now, strict divergence filter.
    const isConsensus = ratioSim > (1 - MIN_DIVERGENCE_RATIO) || ratioNao > (1 - MIN_DIVERGENCE_RATIO);
    
    return !isConsensus;
}

async function main() {
    console.log("🕷️ Starting Vote Crawler...");

    // 1. Calculate Date Range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - DAYS_LOOKBACK);
    
    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];
    
    console.log(`📅 Searching votes from ${startStr} to ${endStr}...`);

    // 2. Fetch Votes Summary
    // Ordem DESC dataHoraRegistro to get newest first
    const url = `${CAMARA_API}/votacoes?dataInicio=${startStr}&dataFim=${endStr}&ordem=DESC&ordenarPor=dataHoraRegistro`;
    const data = await fetchJson(url);
    const votacoes = data.dados;

    console.log(`🔎 Found ${votacoes.length} raw voting events.`);

    let processedCount = 0;
    let savedCount = 0;

    // 3. Process Each Vote
    for (const resumo of votacoes) {
        processedCount++;
        
        // Filter: Must be a Proposition (PL, PEC, MPV)
        // siglaUf usually null for federal laws.
        // We look at 'uriProposicaoPrincipal' or description parsing.
        // The summary has 'proposicaoObjeto' sometimes.
        
        // Let's fetch details to be sure.
        let details;
        try {
            const res = await fetchJson(resumo.uri);
            details = res.dados;
        } catch(e) {
            console.error(`❌ Error fetching details for ${resumo.id}`);
            continue;
        }

        // Check Type
        // We only want: PL, PEC, PLP, MPV
        // details.proposicaoObjeto generally has the "PL 1234/2024" text
        // or check details.proposicoesAfetadas
        const propTitle = details.proposicaoObjeto || details.descricao; 
        const isLegislative = /^(PL|PEC|PLP|MPV)/i.test(propTitle);

        if (!isLegislative) {
            // console.log(`   Skipping ${resumo.id}: Not legislative (${propTitle})`);
            continue;
        }

        // Fetch Individual Votes to check Divergence
        let votosResp;
        try {
            votosResp = await fetchJson(`${CAMARA_API}/votacoes/${resumo.id}/votos`);
        } catch (e) { continue; }
        
        const votosList = votosResp.dados; // Array of { deputado_: { siglaPartido, ... }, tipoVoto: "Sim" }

        if (!votosList || votosList.length === 0) continue;

        // Count Votes
        let countSim = 0;
        let countNao = 0;
        
        votosList.forEach((v: any) => {
            const t = v.tipoVoto.toUpperCase().trim();
            if (t === "SIM") countSim++;
            if (t === "NÃO" || t === "NAO") countNao++;
        });

        const total = countSim + countNao;
        
        if (!isRelevant(countSim, countNao, total)) {
            // console.log(`   Skipping ${propTitle}: Consensus or Irrelevant (Sim: ${countSim}, Não: ${countNao})`);
            continue;
        }

        console.log(`✅ MATCH! Saving: ${propTitle} (Sim: ${countSim}, Não: ${countNao})`);

        // 4. Save Bill (Upsert)
        await prisma.bill.upsert({
            where: { id: resumo.id },
            update: {
                title: propTitle.substring(0, 100) + (propTitle.length > 100 ? "..." : ""), // Truncate title if needed? Model string usually 256. Prisma String is text.
                description: details.descricao,
                voteDate: new Date(details.dataHoraRegistro)
            },
            create: {
                id: resumo.id,
                title: propTitle.substring(0, 100) + (propTitle.length > 100 ? "..." : ""),
                description: details.descricao,
                voteDate: new Date(details.dataHoraRegistro)
            }
        });

        // 5. Save VoteLogs
        // Need to ensure Politician exists? 
        // Ideally yes, but if we seed frequently we assume they exist.
        // Or we ignore votes from unknown politicians (substitutes).
        
        // Get known politicians ID set for perf
        const depIds = new Set((await prisma.politician.findMany({ select: { id: true } })).map(p => p.id));
        
        const logsToCreate = [];

        for (const v of votosList) {
            const depId = String(v.deputado_.id);
            if (!depIds.has(depId)) continue; // Skip unknown deputy

             logsToCreate.push({
                politicianId: depId,
                billId: resumo.id,
                voteType: v.tipoVoto.toUpperCase().trim()
            });
        }

        if (logsToCreate.length > 0) {
            // Use createMany with skipDuplicates (requires unique constraint)
            // If unique constraint is not applied yet, this WILL fail or duplicate.
            try {
                await prisma.voteLog.createMany({
                    data: logsToCreate,
                    skipDuplicates: true
                });
                console.log(`      Saved ${logsToCreate.length} votes.`);
                savedCount++;
            } catch (e) {
                console.error(`      Error saving votes for ${resumo.id}:`, e);
            }
        }
    }

    console.log(`🏁 Done. Scanned ${processedCount}, Saved ${savedCount} new relevant votes.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
