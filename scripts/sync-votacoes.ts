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
const FETCH_TIMEOUT_MS = 15000;
const FETCH_RETRIES = 4;
const FETCH_BACKOFF_MS = 1000;
const PAGE_SIZE = 50;
const MAX_PAGES = 50;
const DRY_RUN = process.env.DRY_RUN === "1";
const DEDUPE_DAYS = 7;
const PROCEDURAL_SIGLAS = new Set(["RPD", "DTQ"]);
const fichaCache = new Map<string, string[]>();

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

interface ApiResponse<T> {
  dados: T[];
  links?: Array<{ rel: string; href: string }>;
}

class FetchError extends Error {
  status?: number;
  retryable: boolean;

  constructor(message: string, status?: number, retryable = false) {
    super(message);
    this.name = "FetchError";
    this.status = status;
    this.retryable = retryable;
  }
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isRetryableStatus(status?: number) {
  return status === 408 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

function isRetryableError(err: unknown) {
  if (err instanceof FetchError) return err.retryable;
  if (err instanceof Error && err.name === "AbortError") return true;
  return false;
}

function normalizeArray<T>(value: T[] | T | null | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function extractProposicaoKey(details: any): string | null {
  const affected = normalizeArray(details?.proposicoesAfetadas);
  const prop = affected[0];
  if (!prop) return null;
  const sigla = prop.siglaTipo;
  const numero = prop.numero;
  const ano = prop.ano;
  if (!sigla || !numero || !ano) return null;
  return `${sigla} ${numero}/${ano}`;
}

function isProcedimental(details: any): boolean {
  const objects = normalizeArray(details?.objetosPossiveis);
  return objects.some(obj => PROCEDURAL_SIGLAS.has(String(obj?.siglaTipo || "")));
}

function parseFichaLines(html: string): string[] {
  const text = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|li|tr|div|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s+\n/g, "\n")
    .replace(/\n{2,}/g, "\n");

  return text
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean);
}

async function fetchText(url: string, init: RequestInit = {}) {
  let lastError: unknown;

  for (let attempt = 0; attempt <= FETCH_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        ...init,
        headers: {
          Accept: "text/html",
          ...(init.headers || {}),
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        const retryable = isRetryableStatus(response.status);
        throw new FetchError(
          `Failed to fetch ${url}: ${response.status} ${response.statusText}`,
          response.status,
          retryable
        );
      }

      return response.text();
    } catch (err) {
      lastError = err;
      const retryable = isRetryableError(err);

      if (!retryable || attempt === FETCH_RETRIES) {
        throw err;
      }

      const backoff = FETCH_BACKOFF_MS * Math.pow(2, attempt);
      const jitter = Math.floor(Math.random() * 250);
      console.warn(`   ⚠️ Falha temporária ao buscar HTML, tentando novamente em ${backoff + jitter}ms...`);
      await sleep(backoff + jitter);
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError;
}

async function getFichaLines(idProposicao: string): Promise<string[]> {
  const cached = fichaCache.get(idProposicao);
  if (cached) return cached;

  const url = `https://www.camara.leg.br/proposicoesWeb/fichadetramitacao?idProposicao=${idProposicao}`;
  const html = await fetchText(url);
  const lines = parseFichaLines(html);
  fichaCache.set(idProposicao, lines);
  return lines;
}

function findFichaAction(lines: string[], voteResultText: string): string | null {
  const idx = lines.findIndex(line => line.includes(voteResultText));
  if (idx === -1) return null;

  for (let i = idx - 1; i >= 0; i--) {
    const line = lines[i];
    if (/votaç(ã|a)o/i.test(line)) {
      return line;
    }
  }

  return null;
}

async function fetchJson(url: string, init: RequestInit = {}) {
  let lastError: unknown;

  for (let attempt = 0; attempt <= FETCH_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        ...init,
        headers: {
          Accept: "application/json",
          ...(init.headers || {}),
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        const retryable = isRetryableStatus(response.status);
        throw new FetchError(
          `Failed to fetch ${url}: ${response.status} ${response.statusText}`,
          response.status,
          retryable
        );
      }

      return response.json();
    } catch (err) {
      lastError = err;
      const retryable = isRetryableError(err);

      if (!retryable || attempt === FETCH_RETRIES) {
        throw err;
      }

      const backoff = FETCH_BACKOFF_MS * Math.pow(2, attempt);
      const jitter = Math.floor(Math.random() * 250);
      console.warn(`   ⚠️ Falha temporária ao buscar dados, tentando novamente em ${backoff + jitter}ms...`);
      await sleep(backoff + jitter);
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError;
}

function hasNextLink(links?: Array<{ rel: string; href: string }>) {
  return Array.isArray(links) && links.some(link => link.rel === "next");
}

async function fetchVotacoesPage(params: URLSearchParams): Promise<ApiResponse<VotacaoAPI>> {
  const data = await fetchJson(`${CAMARA_API}/votacoes?${params}`);
  return data as ApiResponse<VotacaoAPI>;
}

async function fetchAllVotacoes(
  baseParams: URLSearchParams,
  pageSize?: number
): Promise<{ items: VotacaoAPI[]; pages: number }> {
  let page = 1;
  let pagesFetched = 0;
  const all: VotacaoAPI[] = [];

  while (page <= MAX_PAGES) {
    const params = new URLSearchParams(baseParams);
    params.set("pagina", String(page));
    if (pageSize) params.set("itens", String(pageSize));

    const data = await fetchVotacoesPage(params);
    all.push(...(data.dados || []));
    pagesFetched += 1;

    const hasMore = hasNextLink(data.links);
    if (hasMore) {
      page += 1;
      continue;
    }

    if (pageSize && data.dados.length >= pageSize) {
      page += 1;
      continue;
    }

    break;
  }

  return { items: all, pages: pagesFetched };
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
  });

  const startIso = startDate.toISOString().split("T")[0];
  const endIso = endDate.toISOString().split("T")[0];
  console.log(`📅 Buscando votações de ${startIso} a ${endIso}...`);
  console.log(`   ⚙️ Config: itens=${PAGE_SIZE}, maxPages=${MAX_PAGES}`);
  console.time("⏱️ Tempo de busca de votações");

  try {
    const result = await fetchAllVotacoes(params, PAGE_SIZE);
    console.log(`📄 Páginas buscadas (com itens=${PAGE_SIZE}): ${result.pages}`);
    console.log(`📦 Total de votações (com itens=${PAGE_SIZE}): ${result.items.length}`);
    console.timeEnd("⏱️ Tempo de busca de votações");
    return result.items;
  } catch (err) {
    if (!isRetryableError(err)) throw err;
    console.warn(`⚠️ Falha ao buscar com itens=${PAGE_SIZE}. Tentando novamente sem itens...`);
    const result = await fetchAllVotacoes(params);
    console.log(`📄 Páginas buscadas (sem itens): ${result.pages}`);
    console.log(`📦 Total de votações (sem itens): ${result.items.length}`);
    console.timeEnd("⏱️ Tempo de busca de votações");
    return result.items;
  }
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
  if (DRY_RUN) {
    console.log("🧪 Modo DRY_RUN ativo: sem persistir no banco.\n");
  }

  // 1. Buscar votações recentes
  const votacoes = await getRecentVotacoes();
  console.log(`✅ Encontradas ${votacoes.length} votações na API\n`);

  if (DRY_RUN) {
    console.log("✅ DRY_RUN concluído (somente fetch e logs).");
    return;
  }

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

    // Buscar detalhes
    let details;
    let contextText = "";
    let fichaAction: string | null = null;
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

    const proposicaoKey = extractProposicaoKey(details);
    const proposicaoId = normalizeArray(details?.proposicoesAfetadas)[0]?.id;
    if (proposicaoId) {
      try {
        const lines = await getFichaLines(String(proposicaoId));
        fichaAction = findFichaAction(lines, votacao.descricao);
      } catch (e) {
        console.warn("   ⚠️ Erro ao buscar ficha de tramitação.");
      }
    }

    const proceduralByFicha = fichaAction ? /(requerimento|destaque)/i.test(fichaAction) : false;
    if (proposicaoKey && (isProcedimental(details) || proceduralByFicha)) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - DEDUPE_DAYS);

      const similar = await prisma.bill.findFirst({
        where: {
          voteDate: { gte: cutoff },
          OR: [
            { title: { contains: proposicaoKey, mode: "insensitive" } },
            { description: { contains: proposicaoKey, mode: "insensitive" } },
            { simplifiedTitle: { contains: proposicaoKey, mode: "insensitive" } },
            { simplifiedDescription: { contains: proposicaoKey, mode: "insensitive" } },
          ],
        },
        select: { id: true, voteDate: true },
      });

      if (similar) {
        console.log(`   ⏭️ Votação procedimental repetida (${proposicaoKey}) nos últimos ${DEDUPE_DAYS} dias, pulando...`);
        skippedCount++;
        continue;
      }
    }

    // Buscar votos
    const votos = await getVotosForVotacao(votacao.id);

    // Filtrar votações com poucos votos
    if (votos.length < MIN_VOTES) {
      console.log(`⏭️ Votação ${votacao.id} tem apenas ${votos.length} votos, pulando...`);
      skippedCount++;
      continue;
    }

    const aiContextParts = [
      fichaAction ? `Ação: ${fichaAction}` : null,
      proposicaoKey ? `Proposição: ${proposicaoKey}` : null,
      contextText || null,
    ].filter(Boolean);

    const fullContext = aiContextParts.join("\n\n").trim();

    console.log(`\n📋 Processando: ${details.descricao?.substring(0, 60)}...`);
    console.log(`   ID: ${votacao.id} | Votos: ${votos.length}`);

    // Filtrar votações irrelevantes/burocráticas
    const title = fichaAction || details.descricao || `Votação ${votacao.id}`;
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
