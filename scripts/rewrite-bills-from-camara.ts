/**
 * Reescreve títulos e descrições de votações existentes usando
 * ação da ficha + ementa + placar (com refinamento opcional por IA).
 *
 * Uso:
 *  - npx tsx scripts/rewrite-bills-from-camara.ts
 *  - BILL_ID=2557414-32 npx tsx scripts/rewrite-bills-from-camara.ts
 *  - DRY_RUN=1 npx tsx scripts/rewrite-bills-from-camara.ts
 */

import { PrismaClient } from "@prisma/client"
import { generateObject } from "ai"
import { createOpenAI } from "@ai-sdk/openai"
import { z } from "zod"

const prisma = new PrismaClient()
const CAMARA_API = "https://dadosabertos.camara.leg.br/api/v2"

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: "https://ai-gateway.vercel.sh/v1",
})

const FETCH_TIMEOUT_MS = 15000
const FETCH_RETRIES = 4
const FETCH_BACKOFF_MS = 1000
const DRY_RUN = process.env.DRY_RUN === "1"
const ONLY_ID = process.env.BILL_ID

const PROCEDURAL_SIGLAS = new Set(["RPD", "DTQ"])
const fichaCache = new Map<string, string[]>()

interface VotacaoDetails {
  id: string
  descricao: string
  aprovacao: boolean
  proposicaoObjetoPrincipal?: { uri?: string }
  proposicoesAfetadas?: Array<{ id?: number; uri?: string; siglaTipo?: string; numero?: number; ano?: number }>
  objetosPossiveis?: Array<{ siglaTipo?: string }>
}

class FetchError extends Error {
  status?: number
  retryable: boolean

  constructor(message: string, status?: number, retryable = false) {
    super(message)
    this.name = "FetchError"
    this.status = status
    this.retryable = retryable
  }
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function isRetryableStatus(status?: number) {
  return status === 408 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504
}

function isRetryableError(err: unknown) {
  if (err instanceof FetchError) return err.retryable
  if (err instanceof Error && err.name === "AbortError") return true
  return false
}

function normalizeArray<T>(value: T[] | T | null | undefined): T[] {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

function extractProposicaoKey(details: VotacaoDetails): string | null {
  const affected = normalizeArray(details?.proposicoesAfetadas)
  const prop = affected[0]
  if (!prop) return null
  const sigla = prop.siglaTipo
  const numero = prop.numero
  const ano = prop.ano
  if (!sigla || !numero || !ano) return null
  return `${sigla} ${numero}/${ano}`
}

function isProcedimental(details: VotacaoDetails): boolean {
  const objects = normalizeArray(details?.objetosPossiveis)
  return objects.some(obj => PROCEDURAL_SIGLAS.has(String(obj?.siglaTipo || "")))
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
    .replace(/\n{2,}/g, "\n")

  return text
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean)
}

function extractVoteCounts(text: string): { sim: number; nao: number; total: number } | null {
  const match = /Sim:\s*(\d+)\s*;\s*Não:\s*(\d+)\s*;\s*Total:\s*(\d+)/i.exec(text)
  if (!match) return null
  return {
    sim: Number(match[1]),
    nao: Number(match[2]),
    total: Number(match[3]),
  }
}

function lineHasCounts(line: string, counts: { sim: number; nao: number; total: number }) {
  return (
    new RegExp(`Sim:\\s*${counts.sim}\\b`, "i").test(line) &&
    new RegExp(`Não:\\s*${counts.nao}\\b`, "i").test(line) &&
    new RegExp(`Total:\\s*${counts.total}\\b`, "i").test(line)
  )
}

async function fetchText(url: string, init: RequestInit = {}) {
  let lastError: unknown

  for (let attempt = 0; attempt <= FETCH_RETRIES; attempt++) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

    try {
      const response = await fetch(url, {
        ...init,
        headers: {
          Accept: "text/html",
          ...(init.headers || {}),
        },
        signal: controller.signal,
      })

      if (!response.ok) {
        const retryable = isRetryableStatus(response.status)
        throw new FetchError(
          `Failed to fetch ${url}: ${response.status} ${response.statusText}`,
          response.status,
          retryable
        )
      }

      return response.text()
    } catch (err) {
      lastError = err
      const retryable = isRetryableError(err)

      if (!retryable || attempt === FETCH_RETRIES) {
        throw err
      }

      const backoff = FETCH_BACKOFF_MS * Math.pow(2, attempt)
      const jitter = Math.floor(Math.random() * 250)
      console.warn(`   Falha temporaria ao buscar HTML, tentando novamente em ${backoff + jitter}ms...`)
      await sleep(backoff + jitter)
    } finally {
      clearTimeout(timeout)
    }
  }

  throw lastError
}

async function getFichaLines(idProposicao: string): Promise<string[]> {
  const cached = fichaCache.get(idProposicao)
  if (cached) return cached

  const url = `https://www.camara.leg.br/proposicoesWeb/fichadetramitacao?idProposicao=${idProposicao}`
  const html = await fetchText(url)
  const lines = parseFichaLines(html)
  fichaCache.set(idProposicao, lines)
  return lines
}

function findFichaAction(lines: string[], voteResultText: string): string | null {
  const counts = extractVoteCounts(voteResultText)
  let idx = -1

  if (counts) {
    idx = lines.findIndex(line => lineHasCounts(line, counts))
  }

  if (idx === -1) {
    idx = lines.findIndex(line => line.includes(voteResultText))
  }

  if (idx === -1) return null

  for (let i = idx - 1; i >= 0; i--) {
    const line = lines[i]
    if (/votaç(ã|a)o/i.test(line)) {
      return line
    }
  }

  return null
}

function normalizePropositionSummary(raw?: string | null) {
  if (!raw) return null
  let text = raw.trim()
  text = text.replace(/^Altera\s+/i, "Muda ")
  text = text.replace(/^Dispõe\s+sobre\s+/i, "Cria regras sobre ")
  text = text.replace(/^Institui\s+/i, "Cria ")
  text = text.replace(/^Autoriza\s+/i, "Permite ")
  text = text.replace(/^Estabelece\s+/i, "Define ")
  text = text.replace(/^Define\s+/i, "Define ")
  text = text.replace(/^Cria\s+/i, "Cria ")
  text = text.replace(/^Altera a Lei nº[^,]*,\s*/i, "")
  text = text.replace(/\bMedida Provisória\b/gi, "MP")
  text = text.replace(/\bPrograma\b/gi, "programa")
  text = text.replace(/\bbenefício\b/gi, "benefício")
  text = text.replace(/\bauxílio\b/gi, "auxílio")
  text = text.replace(/\boperacionalização\b/gi, "forma de funcionamento")
  text = text.replace(/\bdenominação\b/gi, "nome")
  text = text.replace(/\bmodalidades?\b/gi, "formas")
  text = text.replace(/\bproposição\b/gi, "proposta")
  text = text.replace(/\bressarcimento\b/gi, "reembolso")
  text = text.replace(/\bsubsídio\b/gi, "ajuda financeira")
  text = text.replace(/\bbeneficiário\b/gi, "pessoa atendida")
  text = text.replace(/\bcritérios?\b/gi, "regras")
  text = text.replace(/\bcontrapartidas?\b/gi, "exigências")
  text = text.replace(/\bconcessão\b/gi, "concessão")
  text = text.replace(/\bcaptação\b/gi, "captação")
  text = text.replace(/\bprorroga\b/gi, "estende")
  text = text.replace(/\bprorrogação\b/gi, "extensão")
  text = text.replace(/\s*;.*$/i, "")
  text = text.replace(/\s*e altera.*$/i, "")
  text = text.replace(/\s*e dá outras providências\.?$/i, "")
  if (text.length > 180) {
    text = `${text.slice(0, 177).trim()}...`
  }
  return text
}

function simplifyProceduralAction(
  action: string,
  proposicaoKey?: string | null,
  proposicaoSummary?: string | null
) {
  const text = action.toLowerCase()
  const prop = proposicaoKey || "a proposição"
  const about = proposicaoSummary ? ` sobre ${proposicaoSummary}` : ""

  if (text.includes("retirada de pauta")) {
    return {
      title: `Pedido para tirar ${prop} da pauta`,
      description: `Votação sobre tirar ${prop} da pauta${about} (adiar a análise).`,
    }
  }

  if (text.includes("adiamento da discussão")) {
    return {
      title: `Pedido para adiar a discussão de ${prop}`,
      description: `Votação sobre adiar a discussão de ${prop}${about} para outro momento.`,
    }
  }

  if (text.includes("adiamento da votação")) {
    return {
      title: `Pedido para adiar a votação de ${prop}`,
      description: `Votação sobre adiar a decisão de ${prop}${about} para outra sessão.`,
    }
  }

  if (text.includes("votação nominal")) {
    return {
      title: `Pedido para votação nominal de ${prop}`,
      description: `Votação para decidir se o voto de cada deputado será registrado individualmente${about}.`,
    }
  }

  if (text.includes("destaque")) {
    return {
      title: `Pedido de destaque em ${prop}`,
      description: `Votação para separar um trecho de ${prop}${about} e votá-lo à parte.`,
    }
  }

  if (text.includes("encaminharam a votação")) {
    return {
      title: `Orientação de votos em ${prop}`,
      description: `Registro das orientações de voto das lideranças antes da decisão sobre ${prop}${about}.`,
    }
  }

  if (text.includes("requerimento")) {
    return {
      title: `Pedido procedimental sobre ${prop}`,
      description: `Votação sobre um pedido relacionado à condução da análise de ${prop}${about}.`,
    }
  }

  return {
    title: `Votação procedimental sobre ${prop}`,
    description: `Votação sobre um pedido relacionado à condução da análise de ${prop}${about}.`,
  }
}

function truncateText(text: string, max = 80) {
  if (text.length <= max) return text
  return `${text.slice(0, max - 3).trim()}...`
}

function simplifyActionText(raw: string) {
  const text = raw
    .replace(/\btexto-base\b/gi, "texto principal")
    .replace(/\bsubstitutivo\b/gi, "texto alternativo")
    .replace(/\bemenda\b/gi, "mudança no texto")
    .replace(/\brequerimento\b/gi, "pedido")
    .replace(/\bproposição\b/gi, "proposta")
    .replace(/[ \t]+/g, " ")
    .trim()

  return text || null
}

function buildTopicLabel(proposicaoKey?: string | null, proposicaoSummary?: string | null) {
  const summary = proposicaoSummary ? truncateText(proposicaoSummary, 60) : null
  if (proposicaoKey && summary) return `${proposicaoKey} (${summary})`
  if (proposicaoKey) return proposicaoKey
  if (summary) return summary
  return "proposta em análise"
}

function buildThemeText(proposicaoSummary?: string | null) {
  if (!proposicaoSummary) return "tema não informado"

  let theme = proposicaoSummary.trim()
  theme = theme.replace(/^(muda|cria regras sobre|cria|permite|define|estende)\s+/i, "")
  theme = theme.replace(/^(que)\s+/i, "")
  theme = theme.replace(/^(o|a|os|as)\s+/i, "")
  theme = theme.charAt(0).toLowerCase() + theme.slice(1)
  return theme
}

function buildProjectTitle(proposicaoSummary?: string | null, proposicaoKey?: string | null) {
  const theme = buildThemeText(proposicaoSummary)
  const suffix = proposicaoKey ? ` (${proposicaoKey})` : ""
  return truncateText(`Projeto sobre ${theme}${suffix}`, 100)
}

function buildTopicClause(proposicaoKey?: string | null, proposicaoSummary?: string | null) {
  if (proposicaoSummary) {
    const normalized = proposicaoSummary.charAt(0).toLowerCase() + proposicaoSummary.slice(1)
    if (/^(muda|cria|permite|define|estende)/i.test(proposicaoSummary)) {
      return `que ${normalized}`
    }
    return `sobre ${normalized}`
  }

  if (proposicaoKey) return `sobre a proposta ${proposicaoKey}`
  return "sobre a proposta em análise"
}

function parseMpFromText(text: string) {
  const match = /Medida Provis[oó]ria\s*n[ºo]?\s*(\d{1,5})\s*de\s*(\d{4})/i.exec(text)
  if (match) {
    return { numero: match[1], ano: match[2] }
  }

  const mpShort = /\bMP\s*(\d{1,5})\/(\d{4})\b/i.exec(text)
  if (mpShort) {
    return { numero: mpShort[1], ano: mpShort[2] }
  }

  return null
}

function buildOutcomeTitle(actionText: string, proposicaoSummary?: string | null) {
  const mp = parseMpFromText(actionText)
  const hasHighlights = /ressalvados os destaques/i.test(actionText)
  const isApproved = /aprovad[ao]/i.test(actionText)
  const isRejected = /rejeitad[ao]/i.test(actionText)

  if (!mp || (!isApproved && !isRejected)) return null

  const mpKey = `MP ${mp.numero}/${mp.ano}`
  const title = buildProjectTitle(proposicaoSummary || actionText, mpKey)

  const about = proposicaoSummary ? ` sobre ${proposicaoSummary}` : ""
  const highlightNote = hasHighlights
    ? "Ainda existem destaques (trechos separados) para votação."
    : null
  const plvNote = /Projeto de Lei de Convers[aã]o/i.test(actionText)
    ? "O texto aprovado foi a versão final apresentada na Câmara."
    : null

  return {
    title: hasHighlights ? truncateText(`${title} - com destaques`, 100) : title,
    description: [
      `A Câmara ${isApproved ? "aprovou" : "rejeitou"} a MP ${mp.numero}/${mp.ano}${about}.`,
      plvNote,
      highlightNote,
    ].filter(Boolean).join(" "),
  }
}

function buildResultSentence(counts: { sim: number; nao: number; total: number } | null, aprovacao: boolean) {
  if (!counts) {
    return "O placar não foi encontrado na fonte consultada."
  }

  const outcome = aprovacao ? "foi aprovado" : "foi rejeitado"
  return `No painel, o resultado ${outcome}: ${counts.sim} votos 'Sim' e ${counts.nao} votos 'Não' (total de ${counts.total}).`
}

function buildCitizenSummary(params: {
  action: string | null
  fallbackTitle: string
  proposicaoKey: string | null
  proposicaoSummary: string | null
  isProcedural: boolean
  counts: { sim: number; nao: number; total: number } | null
  aprovacao: boolean
}) {
  const {
    action,
    fallbackTitle,
    proposicaoKey,
    proposicaoSummary,
    isProcedural,
    counts,
    aprovacao,
  } = params

  const topicLabel = buildTopicLabel(proposicaoKey, proposicaoSummary)
  const topicClause = buildTopicClause(proposicaoKey, proposicaoSummary)
  const actionText = simplifyActionText(action || fallbackTitle || "")
  const resultText = buildResultSentence(counts, aprovacao)

  if (isProcedural) {
    const procedural = simplifyProceduralAction(action || fallbackTitle, proposicaoKey, proposicaoSummary)
    const guidanceHint = actionText && /encaminharam a vota(ç|c)ão/i.test(actionText)
      ? "Esta etapa registra orientação de voto das lideranças e não muda o texto da proposta."
      : null

    return {
      title: truncateText(procedural.title, 100),
      description: [
        procedural.description,
        guidanceHint,
        `Tema principal: ${topicLabel}.`,
        resultText,
      ].filter(Boolean).join(" "),
    }
  }

  const outcomeSummary = actionText ? buildOutcomeTitle(actionText, proposicaoSummary) : null
  if (outcomeSummary) {
    return {
      title: truncateText(outcomeSummary.title, 100),
      description: [outcomeSummary.description, resultText].filter(Boolean).join(" "),
    }
  }

  return {
    title: buildProjectTitle(proposicaoSummary || topicLabel, proposicaoKey),
    description: [
      `A Câmara votou uma proposta ${topicClause}.`,
      actionText ? `Nesta etapa, foi analisado: ${actionText}.` : null,
      resultText,
    ].filter(Boolean).join(" "),
  }
}

function shouldUseAiSummary(
  aiSummary: { title?: string; description?: string } | null | undefined,
  counts: { sim: number; nao: number; total: number } | null
) {
  if (!aiSummary?.title?.trim() || !aiSummary?.description?.trim()) return false

  const description = aiSummary.description
  const text = description.toLowerCase()
  if (/sim:\s*\d+/i.test(aiSummary.title) || /n[ãa]o:\s*\d+/i.test(aiSummary.title)) return false
  if (/total:\s*\d+/i.test(aiSummary.title)) return false
  if (aiSummary.title.length > 100) return false
  if (counts) {
    const hasAnyCount = [counts.sim, counts.nao, counts.total].some(value =>
      description.includes(String(value))
    )
    if (!hasAnyCount) return false
    if (text.includes("resultado da votação não foi informado")) return false
  }

  return true
}

async function simplifyDescriptionWithAI(
  title: string,
  description: string | null
): Promise<{ title: string; description: string }> {
  const prompt = `Você é um redator que explica votações para cidadãos leigos.

Transforme o conteúdo abaixo em texto claro, simples e factual:

Título de entrada: ${title}
Fatos disponíveis: ${description || "Não disponível"}

Regras obrigatórias:
- Use APENAS fatos explícitos no texto de entrada
- NÃO invente contexto, intenção política, conflito ideológico ou resultado
- Se faltarem informações, diga claramente "não informado"
- Não afirme o que SIM e NÃO defendem sem evidência textual
- Preserve números e placar exatamente como recebidos
- Escreva em português simples, sem jargão jurídico
- Não use markdown, listas ou emojis

Formato de saída:
- title: até 100 caracteres, direto e específico
- description: 3 a 5 frases curtas, em um único parágrafo`

  const { object } = await generateObject({
    model: openai("gpt-4o-mini"),
    schema: z.object({
      title: z.string(),
      description: z.string(),
    }),
    prompt,
  })

  return {
    title: object.title,
    description: object.description,
  }
}

async function fetchJson(url: string, init: RequestInit = {}) {
  let lastError: unknown

  for (let attempt = 0; attempt <= FETCH_RETRIES; attempt++) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

    try {
      const response = await fetch(url, {
        ...init,
        headers: {
          Accept: "application/json",
          ...(init.headers || {}),
        },
        signal: controller.signal,
      })

      if (!response.ok) {
        const retryable = isRetryableStatus(response.status)
        throw new FetchError(
          `Failed to fetch ${url}: ${response.status} ${response.statusText}`,
          response.status,
          retryable
        )
      }

      return response.json()
    } catch (err) {
      lastError = err
      const retryable = isRetryableError(err)

      if (!retryable || attempt === FETCH_RETRIES) {
        throw err
      }

      const backoff = FETCH_BACKOFF_MS * Math.pow(2, attempt)
      const jitter = Math.floor(Math.random() * 250)
      console.warn(`   Falha temporaria ao buscar dados, tentando novamente em ${backoff + jitter}ms...`)
      await sleep(backoff + jitter)
    } finally {
      clearTimeout(timeout)
    }
  }

  throw lastError
}

async function getVotacaoDetails(votacaoId: string): Promise<VotacaoDetails> {
  const data = await fetchJson(`${CAMARA_API}/votacoes/${votacaoId}`)
  return data.dados
}

async function getProposicaoDetails(url: string): Promise<any> {
  const data = await fetchJson(url)
  return data.dados
}

async function main() {
  console.log("Reescrevendo textos de votacoes existentes...")
  if (DRY_RUN) {
    console.log("DRY_RUN ativo: nenhum dado sera salvo.")
  }

  const bills = await prisma.bill.findMany({
    select: { id: true, title: true },
  })

  const filtered = ONLY_ID ? bills.filter(bill => bill.id === ONLY_ID) : bills
  console.log(`Total de votacoes a atualizar: ${filtered.length}`)

  let updated = 0
  let skipped = 0

  for (const bill of filtered) {
    try {
      const details = await getVotacaoDetails(bill.id)
      const proposicaoKey = extractProposicaoKey(details)
      const proposicaoId = normalizeArray(details?.proposicoesAfetadas)[0]?.id

      let fichaAction: string | null = null
      if (proposicaoId) {
        try {
          const lines = await getFichaLines(String(proposicaoId))
          fichaAction = findFichaAction(lines, details.descricao)
        } catch (e) {
          console.warn(`[${bill.id}] erro ao buscar ficha de tramitacao`)
        }
      }

      let proposicaoSummary: string | null = null
      const candidateUris = [
        details.proposicaoObjetoPrincipal?.uri,
        normalizeArray(details?.proposicoesAfetadas)[0]?.uri,
      ].filter((uri): uri is string => Boolean(uri))

      for (const uri of candidateUris) {
        try {
          const prop = await getProposicaoDetails(uri)
          if (prop.ementa) {
            proposicaoSummary = normalizePropositionSummary(prop.ementa)
            break
          }
        } catch (e) {
          console.warn(`[${bill.id}] erro ao buscar ementa`)
        }
      }

      const proceduralByFicha = fichaAction
        ? /(requerimento|destaque|encaminharam a vota(ç|c)ão)/i.test(fichaAction)
        : false
      const isProcedural = isProcedimental(details) || proceduralByFicha

      const counts = extractVoteCounts(details.descricao)
      const citizenSummary = buildCitizenSummary({
        action: fichaAction,
        fallbackTitle: details.descricao || `Votação ${bill.id}`,
        proposicaoKey,
        proposicaoSummary,
        isProcedural,
        counts,
        aprovacao: details.aprovacao,
      })

      const factualSummaryInput = [
        `Título-base: ${citizenSummary.title}`,
        `Resumo-base: ${citizenSummary.description}`,
        fichaAction ? `Ação na sessão: ${fichaAction}` : null,
        proposicaoKey ? `Proposição: ${proposicaoKey}` : null,
        proposicaoSummary ? `Tema principal: ${proposicaoSummary}` : null,
        counts ? `Placar oficial: Sim ${counts.sim}; Não ${counts.nao}; Total ${counts.total}.` : "Placar oficial: não informado.",
      ].filter(Boolean).join("\n")

      let simplified = citizenSummary
      try {
        const aiSummary = await simplifyDescriptionWithAI(
          citizenSummary.title,
          factualSummaryInput
        )
        if (shouldUseAiSummary(aiSummary, counts)) {
          simplified = {
            title: aiSummary.title,
            description: aiSummary.description,
          }
        }
      } catch (e) {
        console.warn(`[${bill.id}] erro ao simplificar com IA`)
      }

      if (DRY_RUN) {
        console.log(`[${bill.id}] DRY_RUN -> ${simplified.title}`)
        skipped += 1
        await sleep(400)
        continue
      }

      await prisma.bill.update({
        where: { id: bill.id },
        data: {
          title: simplified.title,
          description: simplified.description,
          simplifiedTitle: simplified.title,
          simplifiedDescription: simplified.description,
          lastSyncAt: new Date(),
        },
      })

      console.log(`[${bill.id}] atualizado -> ${simplified.title}`)
      updated += 1
      await sleep(600)
    } catch (e) {
      console.warn(`[${bill.id}] erro geral, pulando`)
      skipped += 1
    }
  }

  console.log(`Concluido. Atualizadas: ${updated} | Puladas: ${skipped}`)
}

main()
  .catch((e) => {
    console.error("Erro:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
