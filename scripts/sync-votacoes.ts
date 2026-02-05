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

function extractVoteCounts(text: string): { sim: number; nao: number; total: number } | null {
  const match = /Sim:\s*(\d+)\s*;\s*Não:\s*(\d+)\s*;\s*Total:\s*(\d+)/i.exec(text);
  if (!match) return null;
  return {
    sim: Number(match[1]),
    nao: Number(match[2]),
    total: Number(match[3]),
  };
}

function lineHasCounts(line: string, counts: { sim: number; nao: number; total: number }) {
  return (
    new RegExp(`Sim:\\s*${counts.sim}\\b`, "i").test(line) &&
    new RegExp(`Não:\\s*${counts.nao}\\b`, "i").test(line) &&
    new RegExp(`Total:\\s*${counts.total}\\b`, "i").test(line)
  );
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
  const counts = extractVoteCounts(voteResultText);
  let idx = -1;

  if (counts) {
    idx = lines.findIndex(line => lineHasCounts(line, counts));
  }

  if (idx === -1) {
    idx = lines.findIndex(line => line.includes(voteResultText));
  }

  if (idx === -1) return null;

  for (let i = idx - 1; i >= 0; i--) {
    const line = lines[i];
    if (/votaç(ã|a)o/i.test(line)) {
      return line;
    }
  }

  return null;
}

function normalizePropositionSummary(raw?: string | null) {
  if (!raw) return null;
  let text = raw.trim();
  text = text.replace(/^Altera\s+/i, "Muda ");
  text = text.replace(/^Dispõe\s+sobre\s+/i, "Cria regras sobre ");
  text = text.replace(/^Institui\s+/i, "Cria ");
  text = text.replace(/^Autoriza\s+/i, "Permite ");
  text = text.replace(/^Estabelece\s+/i, "Define ");
  text = text.replace(/^Define\s+/i, "Define ");
  text = text.replace(/^Cria\s+/i, "Cria ");
  text = text.replace(/^Altera a Lei nº[^,]*,\s*/i, "");
  text = text.replace(/\bMedida Provisória\b/gi, "MP");
  text = text.replace(/\bPrograma\b/gi, "programa");
  text = text.replace(/\bbenefício\b/gi, "benefício");
  text = text.replace(/\bauxílio\b/gi, "auxílio");
  text = text.replace(/\boperacionalização\b/gi, "forma de funcionamento");
  text = text.replace(/\bdenominação\b/gi, "nome");
  text = text.replace(/\bmodalidades?\b/gi, "formas");
  text = text.replace(/\bproposição\b/gi, "proposta");
  text = text.replace(/\bressarcimento\b/gi, "reembolso");
  text = text.replace(/\bsubsídio\b/gi, "ajuda financeira");
  text = text.replace(/\bbeneficiário\b/gi, "pessoa atendida");
  text = text.replace(/\bcritérios?\b/gi, "regras");
  text = text.replace(/\bcontrapartidas?\b/gi, "exigências");
  text = text.replace(/\bconcessão\b/gi, "concessão");
  text = text.replace(/\bcaptação\b/gi, "captação");
  text = text.replace(/\bprorroga\b/gi, "estende");
  text = text.replace(/\bprorrogação\b/gi, "extensão");
  text = text.replace(/\s*;.*$/i, "");
  text = text.replace(/\s*e altera.*$/i, "");
  text = text.replace(/\s*e dá outras providências\.?$/i, "");
  if (text.length > 180) {
    text = `${text.slice(0, 177).trim()}...`;
  }
  return text;
}

function simplifyProceduralAction(
  action: string,
  proposicaoKey?: string | null,
  proposicaoSummary?: string | null
) {
  const text = action.toLowerCase();
  const prop = proposicaoKey || "a proposição";
  const about = proposicaoSummary ? ` sobre ${proposicaoSummary}` : "";

  if (text.includes("retirada de pauta")) {
    return {
      title: `Pedido para tirar ${prop} da pauta`,
      description: `Votação sobre tirar ${prop} da pauta${about} (adiar a análise).`,
    };
  }

  if (text.includes("adiamento da discussão")) {
    return {
      title: `Pedido para adiar a discussão de ${prop}`,
      description: `Votação sobre adiar a discussão de ${prop}${about} para outro momento.`,
    };
  }

  if (text.includes("adiamento da votação")) {
    return {
      title: `Pedido para adiar a votação de ${prop}`,
      description: `Votação sobre adiar a decisão de ${prop}${about} para outra sessão.`,
    };
  }

  if (text.includes("votação nominal")) {
    return {
      title: `Pedido para votação nominal de ${prop}`,
      description: `Votação para decidir se o voto de cada deputado será registrado individualmente${about}.`,
    };
  }

  if (text.includes("destaque")) {
    return {
      title: `Pedido de destaque em ${prop}`,
      description: `Votação para separar um trecho de ${prop}${about} e votá-lo à parte.`,
    };
  }

  if (text.includes("encaminharam a votação")) {
    return {
      title: `Orientação de votos em ${prop}`,
      description: `Registro das orientações de voto das lideranças antes da decisão sobre ${prop}${about}.`,
    };
  }

  if (text.includes("requerimento")) {
    return {
      title: `Pedido procedimental sobre ${prop}`,
      description: `Votação sobre um pedido relacionado à condução da análise de ${prop}${about}.`,
    };
  }

  return {
    title: `Votação procedimental sobre ${prop}`,
    description: `Votação sobre um pedido relacionado à condução da análise de ${prop}${about}.`,
  };
}

function truncateText(text: string, max = 80) {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 3).trim()}...`;
}

function simplifyActionText(raw: string) {
  const text = raw
    .replace(/\btexto-base\b/gi, "texto principal")
    .replace(/\bsubstitutivo\b/gi, "texto alternativo")
    .replace(/\bemenda\b/gi, "mudança no texto")
    .replace(/\brequerimento\b/gi, "pedido")
    .replace(/\bproposição\b/gi, "proposta")
    .replace(/[ \t]+/g, " ")
    .trim();

  return text || null;
}

function buildTopicLabel(proposicaoKey?: string | null, proposicaoSummary?: string | null) {
  const summary = proposicaoSummary ? truncateText(proposicaoSummary, 60) : null;
  if (proposicaoKey && summary) return `${proposicaoKey} (${summary})`;
  if (proposicaoKey) return proposicaoKey;
  if (summary) return summary;
  return "proposta em análise";
}

function buildTopicClause(proposicaoKey?: string | null, proposicaoSummary?: string | null) {
  if (proposicaoSummary) {
    const normalized = proposicaoSummary.charAt(0).toLowerCase() + proposicaoSummary.slice(1);
    if (/^(muda|cria|permite|define|estende)/i.test(proposicaoSummary)) {
      return `que ${normalized}`;
    }
    return `sobre ${normalized}`;
  }

  if (proposicaoKey) return `sobre a proposta ${proposicaoKey}`;
  return "sobre a proposta em análise";
}

function buildResultSentence(counts: { sim: number; nao: number; total: number } | null, aprovacao: boolean) {
  if (!counts) {
    return "O placar não foi encontrado na fonte consultada.";
  }

  const outcome = aprovacao ? "foi aprovado" : "foi rejeitado";
  return `No painel, o resultado ${outcome}: ${counts.sim} votos 'Sim' e ${counts.nao} votos 'Não' (total de ${counts.total}).`;
}

function buildCitizenSummary(params: {
  action: string | null;
  fallbackTitle: string;
  proposicaoKey: string | null;
  proposicaoSummary: string | null;
  isProcedural: boolean;
  counts: { sim: number; nao: number; total: number } | null;
  aprovacao: boolean;
}) {
  const {
    action,
    fallbackTitle,
    proposicaoKey,
    proposicaoSummary,
    isProcedural,
    counts,
    aprovacao,
  } = params;

  const topicLabel = buildTopicLabel(proposicaoKey, proposicaoSummary);
  const topicClause = buildTopicClause(proposicaoKey, proposicaoSummary);
  const actionText = simplifyActionText(action || fallbackTitle || "");
  const resultText = buildResultSentence(counts, aprovacao);

  if (isProcedural) {
    const procedural = simplifyProceduralAction(action || fallbackTitle, proposicaoKey, proposicaoSummary);
    const guidanceHint = actionText && /encaminharam a vota(ç|c)ão/i.test(actionText)
      ? "Esta etapa registra orientação de voto das lideranças e não muda o texto da proposta."
      : null;

    return {
      title: truncateText(procedural.title, 100),
      description: [
        procedural.description,
        guidanceHint,
        `Tema principal: ${topicLabel}.`,
        resultText,
      ].filter(Boolean).join(" "),
    };
  }

  return {
    title: truncateText(`Votação sobre ${topicLabel}`, 100),
    description: [
      `A Câmara votou uma proposta ${topicClause}.`,
      actionText ? `Nesta etapa, foi analisado: ${actionText}.` : null,
      resultText,
    ].filter(Boolean).join(" "),
  };
}

function shouldUseAiSummary(
  aiSummary: { title?: string; description?: string } | null | undefined,
  counts: { sim: number; nao: number; total: number } | null
) {
  if (!aiSummary?.title?.trim() || !aiSummary?.description?.trim()) return false;

  const description = aiSummary.description;
  const text = description.toLowerCase();
  if (counts) {
    const hasAnyCount = [counts.sim, counts.nao, counts.total].some(value =>
      description.includes(String(value))
    );
    if (!hasAnyCount) return false;
    if (text.includes("resultado da votação não foi informado")) return false;
  }

  return true;
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
      console.log(`🏁 [${votacao.id}] ignorada | motivo: já existente`);
      skippedCount++;
      continue;
    }

    // Buscar votos primeiro para evitar trabalho desnecessário em votações com baixa participação
    let votos: VotoAPI[] = [];
    try {
      votos = await getVotosForVotacao(votacao.id);
    } catch (e) {
      console.warn(`⚠️ Não foi possível obter votos de ${votacao.id}, pulando...`);
      console.log(`🏁 [${votacao.id}] ignorada | motivo: erro ao buscar votos`);
      skippedCount++;
      continue;
    }

    // Filtrar votações com poucos votos
    if (votos.length < MIN_VOTES) {
      console.log(`⏭️ Votação ${votacao.id} tem apenas ${votos.length} votos, pulando...`);
      console.log(`🏁 [${votacao.id}] ignorada | motivo: votos insuficientes (${votos.length})`);
      skippedCount++;
      continue;
    }

    // Buscar detalhes
    let details;
    let contextText = "";
    let proposicaoSummary: string | null = null;
    let fichaAction: string | null = null;
    try {
      details = await getVotacaoDetails(votacao.id);
      
      // Busca ementa com fallback para proposições afetadas quando não houver objeto principal.
      const candidateUris = [
        details.proposicaoObjetoPrincipal?.uri,
        normalizeArray(details?.proposicoesAfetadas)[0]?.uri,
      ].filter((uri): uri is string => Boolean(uri));

      if (candidateUris.length > 0) {
        console.log(`   🔎 [${votacao.id}] Buscando contexto da proposição principal...`);
      }

      for (const uri of candidateUris) {
        try {
          const prop = await getProposicaoDetails(uri);
          if (prop.ementa) {
            contextText = `Ementa da Proposição: ${prop.ementa}`;
            proposicaoSummary = normalizePropositionSummary(prop.ementa);
            console.log(`   📝 [${votacao.id}] Ementa encontrada: ${prop.ementa.substring(0, 100)}...`);
            break;
          }
        } catch (e) {
          console.warn(`   ⚠️ [${votacao.id}] Erro ao buscar ementa da proposição.`);
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

    const proceduralByFicha = fichaAction
      ? /(requerimento|destaque|encaminharam a vota(ç|c)ão)/i.test(fichaAction)
      : false;
    const isProcedural = isProcedimental(details) || proceduralByFicha;
    if (proposicaoKey && isProcedural) {
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
        console.log(`🏁 [${votacao.id}] ignorada | motivo: duplicada por proposição (${proposicaoKey})`);
        skippedCount++;
        continue;
      }
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
    let title = fichaAction || details.descricao || `Votação ${votacao.id}`;
    if (isIrrelevant(title)) {
      console.log(`   ⏭️ Votação irrelevante (burocrática), pulando...`);
      console.log(`🏁 [${votacao.id}] ignorada | motivo: irrelevante/burocrática`);
      skippedCount++;
      continue;
    }

    // Construir URL da fonte
    const sourceUrl = `https://www.camara.leg.br/internet/votacao/mostraVotacao.asp?ideVotacao=${votacao.id?.split('-')[0]}`;

    const counts = extractVoteCounts(votacao.descricao);
    const citizenSummary = buildCitizenSummary({
      action: fichaAction,
      fallbackTitle: details.descricao || `Votação ${votacao.id}`,
      proposicaoKey,
      proposicaoSummary,
      isProcedural,
      counts,
      aprovacao: votacao.aprovacao,
    });

    const factualSummaryInput = [
      `Título-base: ${citizenSummary.title}`,
      `Resumo-base: ${citizenSummary.description}`,
      fichaAction ? `Ação na sessão: ${fichaAction}` : null,
      proposicaoKey ? `Proposição: ${proposicaoKey}` : null,
      proposicaoSummary ? `Tema principal: ${proposicaoSummary}` : null,
      counts ? `Placar oficial: Sim ${counts.sim}; Não ${counts.nao}; Total ${counts.total}.` : "Placar oficial: não informado.",
    ].filter(Boolean).join("\n");

    let simplified: { title?: string; description?: string } = citizenSummary;
    console.log(`   🤖 Refinando resumo em linguagem simples...`);
    try {
      const aiSummary = await VoteClassifierService.simplifyDescription(
        citizenSummary.title,
        factualSummaryInput
      );

      if (shouldUseAiSummary(aiSummary, counts)) {
        simplified = aiSummary;
      } else {
        console.warn("   ⚠️ Saída da IA inconsistente com os fatos. Mantendo resumo determinístico.");
      }
    } catch (e) {
      console.warn("   ⚠️ Erro ao simplificar texto com IA. Mantendo resumo determinístico.");
    }

    let classification;

    title = simplified.title || citizenSummary.title;
    if (!isProcedural) {
      // Classificar via IA para pegar relevância e tags sugeridas
      console.log(`   🤖 Classificando votação...`);
      try {
        classification = await VoteClassifierService.classify(title, fullContext);
        
        // Filtro de relevância por IA: se for muito baixa, pular
        if (classification.relevance < 4) {
          console.log(`   ⏭️ Relevância baixa (${classification.relevance}/10), pulando...`);
          console.log(`🏁 [${votacao.id}] ignorada | motivo: baixa relevância (${classification.relevance}/10)`);
          skippedCount++;
          continue;
        }
        console.log(`   🔸 Relevância: ${classification.relevance}/10 | Categoria: ${classification.category}`);
      } catch (e) {
        console.warn(`   ⚠️ Erro na classificação, salvando sem sugerir tags.`);
      }
    }

    // Criar Bill no banco (status: pending por padrão)
    const bill = await prisma.bill.create({
      data: {
        id: votacao.id,
        title: title,
        description: citizenSummary.description,
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
    console.log(`🏁 [${votacao.id}] processada | votos salvos: ${voteLogsToCreate.length}`);

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
