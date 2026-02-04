/**
 * Script de Sincronização de Votações
 * 
 * Busca votações recentes da API da Câmara, classifica via IA,
 * e salva como pendentes para aprovação no dashboard admin.
 * 
 * Uso: npx tsx scripts/sync-votacoes.ts
 */

import { PrismaClient } from "@prisma/client";
import { VoteClassifierService } from "../app/services/vote-classifier.server";

const prisma = new PrismaClient();
const CAMARA_API = "https://dadosabertos.camara.leg.br/api/v2";

// Configuração
const DAYS_TO_SYNC = 30; // Buscar votações dos últimos N dias
const MIN_VOTES = 100;   // Mínimo de votos para considerar relevante

// Padrões de votações que devem ser ignoradas (irrelevantes/burocráticas)
const IRRELEVANT_PATTERNS = [
  /^mantido o texto/i,
  /^rejeitado o requerimento/i,
  /^aprovado o requerimento/i,
  /^arquivad/i,
  /^tramitação/i,
  /^retirada de pauta/i,
  /^prejudicad/i,
  /^devolvid/i,
  /^retirado de pauta/i,
];

function isIrrelevant(title: string): boolean {
  return IRRELEVANT_PATTERNS.some(pattern => pattern.test(title));
}

interface VotacaoAPI {
  id: string;
  dataHoraRegistro: string;
  descricao: string;
  aprovacao: boolean;
  uriProposicaoPrincipal: string | null;
  siglaOrgao: string;
}

interface VotoAPI {
  deputado_: {
    id: number;
    nome: string;
  };
  tipoVoto: string;
}

async function fetchJson(url: string) {
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
  return response.json();
}

async function getRecentVotacoes(): Promise<VotacaoAPI[]> {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - DAYS_TO_SYNC);

  const params = new URLSearchParams({
    dataInicio: startDate.toISOString().split("T")[0],
    dataFim: endDate.toISOString().split("T")[0],
    ordem: "DESC",
    ordenarPor: "dataHoraRegistro",
    itens: "100",
  });

  console.log(`📅 Buscando votações de ${startDate.toISOString().split("T")[0]} a ${endDate.toISOString().split("T")[0]}...`);
  
  const data = await fetchJson(`${CAMARA_API}/votacoes?${params}`);
  return data.dados;
}

async function getVotosForVotacao(votacaoId: string): Promise<VotoAPI[]> {
  const data = await fetchJson(`${CAMARA_API}/votacoes/${votacaoId}/votos`);
  return data.dados;
}

async function getVotacaoDetails(votacaoId: string): Promise<any> {
  const data = await fetchJson(`${CAMARA_API}/votacoes/${votacaoId}`);
  return data.dados;
}

async function getProposicaoDetails(url: string): Promise<any> {
  const data = await fetchJson(url);
  return data.dados;
}

async function syncVotacoes() {
  console.log("🗳️ Iniciando sincronização de votações...\n");

  // 1. Buscar votações recentes
  const votacoes = await getRecentVotacoes();
  console.log(`✅ Encontradas ${votacoes.length} votações na API\n`);

  // 2. Filtrar votações do Plenário (mais relevantes)
  const plenarioVotacoes = votacoes.filter(v => v.siglaOrgao === "PLEN");
  console.log(`📍 ${plenarioVotacoes.length} votações do Plenário\n`);

  // 3. Buscar políticos existentes
  const allPoliticians = await prisma.politician.findMany({ select: { id: true } });
  const politicianIds = new Set(allPoliticians.map(p => p.id));
  console.log(`👤 ${politicianIds.size} políticos no banco de dados\n`);

  // 4. Processar cada votação
  let processedCount = 0;
  let skippedCount = 0;

  for (const votacao of plenarioVotacoes) {
    // Verificar se já existe
    const existing = await prisma.bill.findUnique({ where: { id: votacao.id } });
    if (existing) {
      console.log(`⏭️ Votação ${votacao.id} já existe, pulando...`);
      skippedCount++;
      continue;
    }

    // Buscar votos
    const votos = await getVotosForVotacao(votacao.id);
    
    // Filtrar votações com poucos votos
    if (votos.length < MIN_VOTES) {
      console.log(`⏭️ Votação ${votacao.id} tem apenas ${votos.length} votos, pulando...`);
      skippedCount++;
      continue;
    }

    // Buscar detalhes
    let details;
    let contextText = "";
    try {
      details = await getVotacaoDetails(votacao.id);
      
      // Tentar buscar ementa da proposição principal para dar mais contexto à IA
      if (details.proposicaoObjetoPrincipal?.uri) {
        console.log(`   🔎 Buscando contexto da proposição principal...`);
        try {
          const prop = await getProposicaoDetails(details.proposicaoObjetoPrincipal.uri);
          if (prop.ementa) {
            contextText = `Ementa da Proposição: ${prop.ementa}`;
            console.log(`   📝 Ementa encontrada: ${prop.ementa.substring(0, 100)}...`);
          }
        } catch (e) {
          console.warn("   ⚠️ Erro ao buscar ementa da proposição.");
        }
      }
    } catch (e) {
      console.warn(`⚠️ Não foi possível obter detalhes de ${votacao.id}`);
      details = { descricao: votacao.descricao };
    }

    const fullContext = `${details.descricao}\n\n${contextText}`.trim();

    console.log(`\n📋 Processando: ${details.descricao?.substring(0, 60)}...`);
    console.log(`   ID: ${votacao.id} | Votos: ${votos.length}`);

    // Filtrar votações irrelevantes/burocráticas
    const title = details.descricao || `Votação ${votacao.id}`;
    if (isIrrelevant(title)) {
      console.log(`   ⏭️ Votação irrelevante (burocrática), pulando...`);
      skippedCount++;
      continue;
    }

    // Construir URL da fonte
    const sourceUrl = `https://www.camara.leg.br/internet/votacao/mostraVotacao.asp?ideVotacao=${votacao.id?.split('-')[0]}`;

    // Simplificar título e descrição usando IA
    console.log(`   🤖 Gerando conteúdo simplificado...`);
    const simplified = await VoteClassifierService.simplifyDescription(
      title,
      fullContext
    );

    // Classificar via IA para pegar relevância e tags sugeridas
    console.log(`   🤖 Classificando votação...`);
    let classification;
    try {
      classification = await VoteClassifierService.classify(title, fullContext);
      
      // Filtro de relevância por IA: se for muito baixa, pular
      if (classification.relevance < 4) {
        console.log(`   ⏭️ Relevância baixa (${classification.relevance}/10), pulando...`);
        skippedCount++;
        continue;
      }
      console.log(`   🔸 Relevância: ${classification.relevance}/10 | Categoria: ${classification.category}`);
    } catch (e) {
      console.warn(`   ⚠️ Erro na classificação, salvando sem sugerir tags.`);
    }

    // Criar Bill no banco (status: pending por padrão)
    const bill = await prisma.bill.create({
      data: {
        id: votacao.id,
        title: title,
        description: details.descricao,
        simplifiedTitle: simplified.title,
        simplifiedDescription: simplified.description,
        sourceUrl: sourceUrl,
        status: "pending",
        aiConfidence: classification ? classification.relevance * 10 : null,
        suggestedTagSim: classification?.tagSim.slug,
        suggestedTagNao: classification?.tagNao.slug,
        suggestedCategory: classification?.category,
        voteDate: new Date(votacao.dataHoraRegistro),
        lastSyncAt: new Date(),
      },
    });

    // Salvar votos
    const voteLogsToCreate = votos
      .filter(voto => politicianIds.has(String(voto.deputado_.id)))
      .map(voto => ({
        politicianId: String(voto.deputado_.id),
        billId: bill.id,
        voteType: voto.tipoVoto.toUpperCase(),
      }));

    if (voteLogsToCreate.length > 0) {
      const result = await prisma.voteLog.createMany({
        data: voteLogsToCreate,
        skipDuplicates: true,
      });
      console.log(`   ✅ Salvos ${result.count} votos`);
    }

    processedCount++;

    // Rate limiting
    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`\n🎉 Sincronização concluída!`);
  console.log(`   Novas votações: ${processedCount}`);
  console.log(`   Ignoradas: ${skippedCount}`);
  console.log(`\n⚠️ Execute a classificação via IA separadamente ou aprove manualmente no dashboard.`);
}

async function main() {
  try {
    console.time("Total Sync Time");
    await syncVotacoes();
    console.timeEnd("Total Sync Time");
  } catch (e) {
    console.error("❌ Erro na sincronização:", e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
