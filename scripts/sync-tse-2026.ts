/**
 * Sincronização das candidaturas de 2026 (TSE) — Fase A: Presidente + Governador
 * do spec `specs/002-eleicao-real-2026/reposicionamento.md`.
 *
 * Objetivo: colocar no ar os 13 registros presidenciais reais, com nome de
 * urna, partido, coligação, número e situação de registro exatamente como o
 * TSE publica. Nenhum texto do TSE é reescrito: `tseStatusLabel` guarda a
 * palavra oficial e o enum `registrationStatus` serve só para filtro/ordem.
 *
 * Fontes oficiais
 * ---------------
 * Página do dataset : https://dadosabertos.tse.jus.br/dataset/candidatos-2026
 * Pacote de dados   : https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand/consulta_cand_2026.zip
 * Fotos de urna     : https://cdn.tse.jus.br/estatistica/sead/eleicoes/eleicoes2026/fotos/foto_cand2026_<UF>_div.zip
 * Situação          : /rest/v1/candidatura/listar/... (DivulgaCandContas, 28 chamadas)
 * Ficha completa    : /rest/v1/candidatura/buscar/... (DivulgaCandContas, 1 por candidatura)
 *                     — bens declarados, eleições anteriores, nº do processo, aptidão
 *
 * Uso
 * ---
 *   npm run sync:tse                       # baixa do TSE e grava
 *   npx tsx scripts/sync-tse-2026.ts --dry-run
 *   npx tsx scripts/sync-tse-2026.ts --from-file ~/Downloads/consulta_cand_2026.zip
 *   npx tsx scripts/sync-tse-2026.ts --photos
 *   npx tsx scripts/sync-tse-2026.ts --from-file <zip|csv> --photos-file <zip> --dry-run
 *   npx tsx scripts/sync-tse-2026.ts --help
 *
 * ⚠️ Bloqueio de borda do TSE
 * ---------------------------
 * O CDN do TSE (Akamai) responde **HTTP 403** para boa parte dos IPs de
 * datacenter e de fora do Brasil. Este script foi escrito num ambiente
 * bloqueado, ou seja, **o caminho de rede nunca foi exercitado contra a API
 * real**. Se você tomar 403, o script explica a causa e aponta o
 * `--from-file`: baixe o ZIP no navegador, de uma rede brasileira, e rode o
 * sync a partir do arquivo. Todo o resto do pipeline (unzip, CSV, upsert) é
 * idêntico nos dois caminhos.
 *
 * Garantias
 * ---------
 * - Idempotente: upsert por `tseId` (SQ_CANDIDATO, único no schema).
 * - Nunca destrutivo: candidatura que sumir do CSV vira aviso, não delete.
 * - Campos curados à mão (biography, governmentPlanUrl, officialSiteUrl,
 *   viceName, viceParty, socialLinks) só são sobrescritos quando o CSV
 *   realmente traz valor.
 * - `--dry-run` imprime o diff completo e não escreve nada (nem no banco,
 *   nem em public/candidatos).
 */

import { Prisma, PrismaClient } from "@prisma/client";
import { inflateRawSync } from "node:zlib";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { tseStatusWrite, type RegistrationStatus } from "../app/lib/candidate-status";
import {
  CARGO_GOVERNADOR,
  CARGO_PRESIDENTE,
  divulgaUrl,
  ELECTION_YEAR,
  fetchDivulgaDetails,
  fetchDivulgaStatuses,
} from "../app/lib/tse-divulga";
import {
  applyDivulgaDetails,
  type DetailTarget,
} from "../app/services/tse-detail.server";

// ============================================================
// Configuração
// ============================================================

const TSE_DATASET_PAGE = "https://dadosabertos.tse.jus.br/dataset/candidatos-2026";
/**
 * VERIFICADO em 26/08/2026 contra um snapshot do portal (Wayback
 * 20260824142339), porque o CDN do TSE responde 403 a este ambiente.
 * O TSE publica UM arquivo nacional para 2026 — não existe
 * `consulta_cand_2026_BR.zip`. O `_BR` é um CSV DENTRO do pacote, ao lado de
 * `consulta_cand_2026_AC.csv` … `_TO.csv`, e contém só os cargos de âmbito
 * nacional (Presidente e Vice). Governador vem nos CSVs por UF.
 */
const CAND_ZIP_URL =
  "https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand/consulta_cand_2026.zip";

/**
 * VERIFICADO em 26/08/2026 (mesmo snapshot do portal). As três URLs que
 * estavam aqui eram chute e nenhuma existe: não há `odsele/fotos_cand/`, nem
 * subdiretório `/BR/`. O caminho real é `eleicoes/eleicoes2026/fotos/`, com
 * um pacote por UF mais um `_BR`.
 */
function photoZipUrl(uf: string): string {
  return `https://cdn.tse.jus.br/estatistica/sead/eleicoes/eleicoes2026/fotos/foto_cand2026_${uf}_div.zip`;
}

const CARGO_VICE = "2";
const CARGO_VICE_GOVERNADOR = "4";

/**
 * Os códigos acima são a convenção do TSE, mas este script já se queimou uma
 * vez confiando em suposição. `DS_CARGO` é auto-descritivo e vem no mesmo
 * arquivo: usamos como conferência cruzada e abortamos se divergir, em vez de
 * gravar 11 mil candidaturas a deputado achando que são governadores.
 */
const CARGO_LABELS: Record<string, RegExp> = {
  [CARGO_PRESIDENTE]: /^presidente$/i,
  [CARGO_VICE]: /^vice[- ]presidente$/i,
  [CARGO_GOVERNADOR]: /^governador$/i,
  [CARGO_VICE_GOVERNADOR]: /^vice[- ]governador$/i,
};
const UF_NACIONAL = "BR";
/** As 27 unidades federativas que elegem governador. */
const UFS = [
  "AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB",
  "PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO",
] as const;
const TURNO_PRIMEIRO = "1";

const FETCH_TIMEOUT_MS = 120000; // ZIPs do TSE são grandes e o CDN é lento
const FETCH_RETRIES = 3;
const FETCH_BACKOFF_MS = 2000;

/**
 * UA descritivo. O bloqueio do Akamai é por reputação de IP, não por UA, mas
 * o agente padrão do undici às vezes leva 403 sozinho — melhor identificar o
 * cliente do que mentir sobre ele.
 */
const USER_AGENT = "Mozilla/5.0 (compatible; em-quem-votar-sync/1.0; +sync-tse-2026)";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, "..");
const PHOTO_OUTPUT_DIR = path.join(PROJECT_ROOT, "public", "candidatos");
const PHOTO_PUBLIC_PREFIX = "/candidatos";
const PLAN_OUTPUT_DIR = path.join(PROJECT_ROOT, "public", "planos");
const PLAN_PUBLIC_PREFIX = "/planos";

/**
 * Propostas de governo, um pacote de PDFs por UF (mais um `_BR` para a
 * disputa presidencial). VERIFICADO no snapshot do portal em 26/08/2026.
 *
 * Este pacote existe porque a Lei 9.504/97 art. 11 §1º IX obriga Presidente e
 * Governador a arquivar propostas — e é por isso que o escopo da plataforma
 * para em governador. Para senador e deputado não há pacote nenhum a baixar,
 * porque não há documento a arquivar.
 */
function planZipUrl(uf: string): string {
  return `https://cdn.tse.jus.br/estatistica/sead/odsele/proposta_governo/proposta_governo_2026_${uf}.zip`;
}

/**
 * Sentinelas de "sem valor" do layout do TSE. Qualquer um destes vira `null`,
 * nunca a string literal.
 */
const NULL_SENTINELS = new Set([
  "",
  "#NULO#",
  "#NULO",
  "#NE#",
  "#NE",
  "#NAO DIVULGAVEL#",
  "NAO DIVULGAVEL",
  "NÃO DIVULGÁVEL",
]);

/** Colunas sem as quais não dá para sincronizar nada. */
const REQUIRED_COLUMNS = [
  "SQ_CANDIDATO",
  "CD_CARGO",
  "SG_UF",
  "NM_CANDIDATO",
  "SG_PARTIDO",
] as const;

/** Colunas usadas quando existem, mas cuja ausência é só aviso. */
const OPTIONAL_COLUMNS = [
  "ANO_ELEICAO",
  "NR_TURNO",
  "DS_CARGO",
  "CD_ELEICAO",
  "SG_UE",
  "NR_CANDIDATO",
  "NM_URNA_CANDIDATO",
  "NM_SOCIAL_CANDIDATO",
  "CD_SITUACAO_CANDIDATURA",
  "DS_SITUACAO_CANDIDATURA",
  "CD_DETALHE_SITUACAO_CAND",
  "DS_DETALHE_SITUACAO_CAND",
  "TP_AGREMIACAO",
  "NR_PARTIDO",
  "NM_PARTIDO",
  "SQ_COLIGACAO",
  "NM_COLIGACAO",
  "DS_COMPOSICAO_COLIGACAO",
  "DS_GRAU_INSTRUCAO",
  "DS_OCUPACAO",
  "DS_GENERO",
  "NR_CPF_CANDIDATO",
] as const;

// ============================================================
// Estado global de execução
// ============================================================

let warningCount = 0;
/** Candidaturas cuja situação o TSE ainda não divulgou (coluna `#NE`). */
let statusUndisclosedCount = 0;

/** Marca que o diff do --dry-run rodou às cegas (banco fora do ar). */
let dbUnavailable = false;

/**
 * Marca que o DivulgaCandContas não respondeu para quase nenhuma unidade —
 * ou seja, este run não conferiu a situação de ninguém. Faz o script sair com
 * código != 0, senão o Actions marca verde sobre uma execução que não fez o
 * trabalho principal e a defasagem cresce sem ninguém ver.
 */
let statusOutage = false;

/** BR/presidente + 27 UFs/governador — o denominador do teto abaixo. */
const DIVULGA_UNITS = 28;
/**
 * Acima desta fração de unidades sem resposta, o run é considerado falho.
 * Metade é o corte: uma ou outra unidade fora do ar é ruído do TSE (e a
 * situação daquelas candidaturas fica preservada, que é o comportamento
 * correto); metade ou mais é indisponibilidade, e indisponibilidade tem de
 * pintar vermelho.
 */
const DIVULGA_OUTAGE_RATIO = 0.5;

/**
 * Colunas opcionais ausentes, acumuladas por nome → nº de CSVs. Agregar em vez
 * de avisar na hora: `DS_SITUACAO_CANDIDATURA`/`DS_DETALHE_SITUACAO_CAND`
 * faltam nos 28 arquivos do pacote de 2026 por decisão do TSE (ver CLAUDE.md),
 * e 56 linhas iguais enterravam os avisos que exigem ação humana.
 */
const missingOptionalColumns = new Map<string, number>();

function warn(message: string) {
  warningCount++;
  console.warn(`⚠️  ${message}`);
}

/**
 * Primeira linha útil de um erro. O Prisma abre a mensagem com `\n` e um bloco
 * de código; sem isso o aviso sai vazio.
 */
function firstLine(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  const line = message
    .split("\n")
    .map(part => part.trim())
    .find(part => part.length > 0);
  return line ?? "erro sem mensagem";
}

/**
 * Cliente Prisma preguiçoso de propósito: o caminho de erro do 403 precisa
 * falhar antes de qualquer tentativa de conexão com o banco, senão o operador
 * vê um erro de DATABASE_URL em vez da mensagem que importa.
 */
let prismaClient: PrismaClient | null = null;

function getPrisma(): PrismaClient {
  if (!prismaClient) prismaClient = new PrismaClient();
  return prismaClient;
}

// ============================================================
// CLI
// ============================================================

interface Options {
  dryRun: boolean;
  fromFile: string | null;
  url: string | null;
  photos: boolean;
  photosFile: string | null;
  photosUrl: string | null;
  plans: boolean;
  plansFile: string | null;
  plansUrl: string | null;
  help: boolean;
}

function parseArgs(argv: string[]): Options {
  const options: Options = {
    dryRun: false,
    fromFile: null,
    url: null,
    photos: false,
    photosFile: null,
    photosUrl: null,
    plans: false,
    plansFile: null,
    plansUrl: null,
    help: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    // Aceita tanto `--flag valor` quanto `--flag=valor`.
    const eq = arg.indexOf("=");
    const name = eq === -1 ? arg : arg.slice(0, eq);
    const inlineValue = eq === -1 ? null : arg.slice(eq + 1);

    const takeValue = (label: string): string => {
      if (inlineValue !== null) return inlineValue;
      const next = argv[i + 1];
      if (!next || next.startsWith("--")) {
        throw new Error(`A flag ${label} exige um valor. Ex.: ${label} <caminho>`);
      }
      i++;
      return next;
    };

    switch (name) {
      case "--dry-run":
        options.dryRun = true;
        break;
      case "--from-file":
        options.fromFile = takeValue("--from-file");
        break;
      case "--url":
        options.url = takeValue("--url");
        break;
      case "--photos":
        options.photos = true;
        break;
      case "--photos-file":
        options.photosFile = takeValue("--photos-file");
        options.photos = true;
        break;
      case "--photos-url":
        options.photosUrl = takeValue("--photos-url");
        options.photos = true;
        break;
      case "--plans":
        options.plans = true;
        break;
      case "--plans-file":
        options.plansFile = takeValue("--plans-file");
        options.plans = true;
        break;
      case "--plans-url":
        options.plansUrl = takeValue("--plans-url");
        options.plans = true;
        break;
      case "--help":
      case "-h":
        options.help = true;
        break;
      default:
        throw new Error(
          `Flag desconhecida: ${arg}. Rode com --help para ver as opções disponíveis.`
        );
    }
  }

  return options;
}

function printHelp() {
  console.log(`
Sincronização das candidaturas de 2026 (TSE) — Presidente + Governador

Uso: npx tsx scripts/sync-tse-2026.ts [opções]

  --dry-run              Mostra o diff completo e não escreve nada.
  --from-file <caminho>  Lê um consulta_cand_2026.zip (ou .csv) já baixado,
                         em vez de buscar no CDN do TSE. Use isto quando o
                         download retornar HTTP 403.
  --url <url>            Força a URL do pacote de candidaturas (útil quando o
                         TSE renomeia o arquivo ou há espelho interno).
  --photos               Baixa o pacote de fotos de urna e grava em
                         public/candidatos/{tseId}.jpg. Sem esta flag, o
                         photoUrl existente é preservado (nunca zerado).
  --photos-file <zip>    Pacote de fotos já baixado (implica --photos).
  --photos-url <url>     Força a URL do pacote de fotos (implica --photos).
  --plans                Baixa as propostas de governo (28 pacotes, um por UF
                         mais o nacional) e extrai o PDF de cada candidatura
                         para public/planos/. Preenche governmentPlanUrl só
                         onde ele está vazio — curadoria manual sobrevive.
  --plans-file <caminho> Lê um proposta_governo_2026_*.zip já baixado.
  --plans-url <url>      Força a URL do pacote de propostas (implica --plans).
  -h, --help             Esta ajuda.

Fontes:
  ${TSE_DATASET_PAGE}
  ${CAND_ZIP_URL}
`);
}

// ============================================================
// Download (com o tratamento explícito do 403)
// ============================================================

/**
 * Falha de download que o operador consegue resolver sozinho (403 do Akamai,
 * 404 de arquivo renomeado). São impressas como instrução, sem stack trace.
 */
class TseDownloadError extends Error {
  url: string;
  status: number;

  constructor(url: string, status: number, name: string) {
    super(`TSE respondeu HTTP ${status} para ${url}`);
    this.name = name;
    this.url = url;
    this.status = status;
  }
}

class TseForbiddenError extends TseDownloadError {
  constructor(url: string) {
    super(url, 403, "TseForbiddenError");
  }
}

class TseNotFoundError extends TseDownloadError {
  constructor(url: string) {
    super(url, 404, "TseNotFoundError");
  }
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
  return (
    status === 408 ||
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504
  );
}

function isRetryableError(err: unknown) {
  if (err instanceof TseDownloadError) return false;
  if (err instanceof FetchError) return err.retryable;
  if (err instanceof Error && err.name === "AbortError") return true;
  // Falhas de DNS/socket do undici chegam como TypeError("fetch failed").
  if (err instanceof TypeError) return true;
  return false;
}

function explainDownloadFailure(err: TseDownloadError): string {
  const cause =
    err.status === 403
      ? [
          "❌ O TSE recusou o download com HTTP 403 (Forbidden).",
          "",
          "   Causa provável: bloqueio de borda do CDN (Akamai) contra IPs de",
          "   datacenter, VPN, proxy corporativo ou de fora do Brasil. O dado é",
          "   público — o que está barrado é a origem da requisição.",
        ]
      : [
          "❌ O TSE respondeu HTTP 404 (Not Found) para este arquivo.",
          "",
          "   Causa provável: o TSE renomeou ou moveu o pacote (o padrão de nome",
          "   muda entre ciclos eleitorais). Confira o link atual na página do",
          "   dataset e ajuste CAND_ZIP_URL / photoZipUrl() neste script, ou",
          "   passe a URL certa com --url / --photos-url.",
          "",
          "   Atenção: alguns proxies devolvem 404 no lugar do 403 real do",
          "   Akamai. Se `curl -I` na mesma URL mostrar 403, o caso é bloqueio",
          "   de rede, não arquivo inexistente.",
        ];

  return [
    "",
    ...cause,
    `   URL: ${err.url}`,
    "",
    "   Como resolver:",
    "     1. Rode este script de uma rede brasileira comum (sem VPN/proxy), ou",
    "     2. Baixe o arquivo manualmente no navegador e use o modo offline:",
    "",
    `        Página do dataset: ${TSE_DATASET_PAGE}`,
    `        Link direto:      ${err.url}`,
    "",
    "        npx tsx scripts/sync-tse-2026.ts --from-file ~/Downloads/consulta_cand_2026.zip",
    "",
    "   (o mesmo vale para as fotos: --photos-file <foto_cand2026_<UF>_div.zip>)",
    "",
  ].join("\n");
}

async function fetchBinary(url: string): Promise<Uint8Array> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= FETCH_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        headers: {
          Accept: "application/zip,application/octet-stream,*/*",
          "User-Agent": USER_AGENT,
        },
        signal: controller.signal,
      });

      // Não adianta insistir: nem 403 do Akamai nem 404 melhoram com retry.
      if (response.status === 403) throw new TseForbiddenError(url);
      if (response.status === 404) throw new TseNotFoundError(url);

      if (!response.ok) {
        throw new FetchError(
          `Falha ao baixar ${url}: ${response.status} ${response.statusText}`,
          response.status,
          isRetryableStatus(response.status)
        );
      }

      const buffer = await response.arrayBuffer();
      return new Uint8Array(buffer);
    } catch (err) {
      lastError = err;

      if (!isRetryableError(err) || attempt === FETCH_RETRIES) {
        throw err;
      }

      const backoff = FETCH_BACKOFF_MS * Math.pow(2, attempt);
      const jitter = Math.floor(Math.random() * 250);
      console.warn(
        `   ⚠️ Falha temporária no download, tentando novamente em ${backoff + jitter}ms...`
      );
      await sleep(backoff + jitter);
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError;
}

// ============================================================
// ZIP (leitura mínima do diretório central)
// ============================================================

/**
 * Decisão: ler o ZIP na mão com `zlib.inflateRawSync` em vez de chamar o
 * binário `unzip` via child_process.
 *
 * Motivos:
 *  - O download já chega como buffer em memória; usar `unzip` obrigaria a
 *    gravar um temporário, criar diretório de extração e limpar depois.
 *  - `unzip` não existe por padrão em runner Windows nem em imagens Docker
 *    slim; o script roda em cron/CI e não pode depender disso.
 *  - Precisamos de extração seletiva (13 fotos dentro de um pacote com
 *    milhares), o que fica trivial com leitura preguiçosa por entrada.
 *
 * O formato lido é o subconjunto que o TSE usa: deflate (método 8) ou stored
 * (método 0), com suporte a ZIP64 porque o pacote de fotos nacional passa
 * folgado dos 4 GB em alguns ciclos.
 */

interface ZipEntry {
  name: string;
  /** Descompacta a entrada sob demanda. */
  read: () => Uint8Array;
}

const SIG_EOCD = 0x06054b50;
const SIG_ZIP64_EOCD_LOCATOR = 0x07064b50;
const SIG_ZIP64_EOCD = 0x06064b50;
const SIG_CENTRAL_DIR = 0x02014b50;
const SIG_LOCAL_HEADER = 0x04034b50;

function toBuffer(bytes: Uint8Array): Buffer {
  return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

function bigToNumber(value: bigint, label: string): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error(`Valor ZIP64 fora do alcance seguro em ${label}: ${value}`);
  }
  return Number(value);
}

function findEocdOffset(view: DataView, size: number): number {
  // O EOCD tem 22 bytes fixos + comentário de até 65535 bytes.
  const minOffset = Math.max(0, size - 22 - 0xffff);
  for (let offset = size - 22; offset >= minOffset; offset--) {
    if (view.getUint32(offset, true) === SIG_EOCD) {
      const commentLength = view.getUint16(offset + 20, true);
      if (offset + 22 + commentLength === size) return offset;
    }
  }
  throw new Error(
    "Arquivo não parece um ZIP válido (assinatura de fim de diretório central não encontrada)."
  );
}

function readZipEntries(bytes: Uint8Array): ZipEntry[] {
  if (bytes.byteLength < 22) {
    throw new Error(`Arquivo ZIP truncado (${bytes.byteLength} bytes).`);
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocd = findEocdOffset(view, bytes.byteLength);

  let totalEntries = view.getUint16(eocd + 10, true);
  let centralDirOffset = view.getUint32(eocd + 16, true);

  // ZIP64: os campos de 16/32 bits saturam e o valor real vive no registro
  // ZIP64 apontado pelo locator imediatamente antes do EOCD.
  const saturated = totalEntries === 0xffff || centralDirOffset === 0xffffffff;
  if (saturated && eocd >= 20 && view.getUint32(eocd - 20, true) === SIG_ZIP64_EOCD_LOCATOR) {
    const zip64Eocd = bigToNumber(view.getBigUint64(eocd - 20 + 8, true), "offset do ZIP64 EOCD");
    if (view.getUint32(zip64Eocd, true) !== SIG_ZIP64_EOCD) {
      throw new Error("Registro ZIP64 de fim de diretório central inválido.");
    }
    totalEntries = bigToNumber(view.getBigUint64(zip64Eocd + 32, true), "total de entradas");
    centralDirOffset = bigToNumber(
      view.getBigUint64(zip64Eocd + 48, true),
      "offset do diretório central"
    );
  }

  const utf8Decoder = new TextDecoder("utf-8");
  const cp437Decoder = new TextDecoder("latin1"); // aproximação suficiente para nomes ASCII
  const entries: ZipEntry[] = [];

  let cursor = centralDirOffset;
  for (let i = 0; i < totalEntries; i++) {
    if (view.getUint32(cursor, true) !== SIG_CENTRAL_DIR) {
      throw new Error(
        `Entrada ${i + 1} do diretório central com assinatura inválida (offset ${cursor}).`
      );
    }

    const flags = view.getUint16(cursor + 8, true);
    const method = view.getUint16(cursor + 10, true);
    let compressedSize = view.getUint32(cursor + 20, true);
    let uncompressedSize = view.getUint32(cursor + 24, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    let localHeaderOffset = view.getUint32(cursor + 42, true);

    const nameBytes = bytes.subarray(cursor + 46, cursor + 46 + nameLength);
    const name = (flags & 0x800 ? utf8Decoder : cp437Decoder).decode(nameBytes);

    // Campo extra ZIP64 (header id 0x0001): os valores aparecem apenas para os
    // campos que saturaram, sempre nesta ordem.
    if (
      compressedSize === 0xffffffff ||
      uncompressedSize === 0xffffffff ||
      localHeaderOffset === 0xffffffff
    ) {
      let extraCursor = cursor + 46 + nameLength;
      const extraEnd = extraCursor + extraLength;
      while (extraCursor + 4 <= extraEnd) {
        const headerId = view.getUint16(extraCursor, true);
        const dataSize = view.getUint16(extraCursor + 2, true);
        let field = extraCursor + 4;
        if (headerId === 0x0001) {
          if (uncompressedSize === 0xffffffff) {
            uncompressedSize = bigToNumber(view.getBigUint64(field, true), `${name}.uncompressed`);
            field += 8;
          }
          if (compressedSize === 0xffffffff) {
            compressedSize = bigToNumber(view.getBigUint64(field, true), `${name}.compressed`);
            field += 8;
          }
          if (localHeaderOffset === 0xffffffff) {
            localHeaderOffset = bigToNumber(view.getBigUint64(field, true), `${name}.offset`);
          }
          break;
        }
        extraCursor += 4 + dataSize;
      }
    }

    const isDirectory = name.endsWith("/") || name.endsWith("\\");
    const entryCompressedSize = compressedSize;
    const entryUncompressedSize = uncompressedSize;
    const entryOffset = localHeaderOffset;

    if (!isDirectory) {
      entries.push({
        name,
        read: () => {
          // O cabeçalho local repete nome e extra com tamanhos próprios: só
          // ele diz onde os dados realmente começam.
          if (view.getUint32(entryOffset, true) !== SIG_LOCAL_HEADER) {
            throw new Error(`Cabeçalho local inválido para "${name}".`);
          }
          const localNameLength = view.getUint16(entryOffset + 26, true);
          const localExtraLength = view.getUint16(entryOffset + 28, true);
          const dataStart = entryOffset + 30 + localNameLength + localExtraLength;
          const raw = bytes.subarray(dataStart, dataStart + entryCompressedSize);

          if (method === 0) return raw;
          if (method === 8) return new Uint8Array(inflateRawSync(toBuffer(raw)));
          throw new Error(
            `Método de compressão ${method} não suportado na entrada "${name}". ` +
              "Extraia o ZIP manualmente e rode com --from-file apontando para o CSV."
          );
        },
      });
      void entryUncompressedSize; // mantido só para depuração/legibilidade
    }

    cursor += 46 + nameLength + extraLength + commentLength;
  }

  return entries;
}

// ============================================================
// CSV
// ============================================================

/**
 * Parser mínimo, sem dependência externa. Cobre o que o TSE gera:
 * delimitador `;`, campos entre aspas duplas, aspas escapadas por duplicação
 * (`""`), quebras CRLF/LF e BOM.
 */
function parseCsv(text: string, delimiter = ";"): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let fieldStarted = false;

  const pushField = () => {
    row.push(field);
    field = "";
    fieldStarted = false;
  };

  const pushRow = () => {
    pushField();
    // Ignora linhas totalmente vazias (típico no fim do arquivo).
    if (!(row.length === 1 && row[0] === "")) rows.push(row);
    row = [];
  };

  const start = text.charCodeAt(0) === 0xfeff ? 1 : 0;

  for (let i = start; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"' && !fieldStarted) {
      inQuotes = true;
      fieldStarted = true;
      continue;
    }

    if (char === delimiter) {
      pushField();
      continue;
    }

    if (char === "\r") {
      if (text[i + 1] === "\n") i++;
      pushRow();
      continue;
    }

    if (char === "\n") {
      pushRow();
      continue;
    }

    field += char;
    fieldStarted = true;
  }

  // Última linha sem quebra final.
  if (field !== "" || row.length > 0) pushRow();

  return rows;
}

/** Normaliza nome de coluna: sem acento, sem aspas, maiúsculo. */
function normalizeHeader(value: string): string {
  return value
    .replace(/^\uFEFF/, "")
    .replace(/^"|"$/g, "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

/** Normaliza texto para comparação (sem acento, maiúsculo, espaços colapsados). */
function normalizeText(value: string): string {
  return value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .toUpperCase();
}

/** Converte sentinelas do TSE em `null`. Nunca devolve string vazia. */
function cleanValue(raw: string | undefined): string | null {
  if (raw === undefined) return null;
  const value = raw.trim();
  if (value === "") return null;
  if (NULL_SENTINELS.has(value.toUpperCase())) return null;
  if (NULL_SENTINELS.has(normalizeText(value))) return null;
  return value;
}

/** Sentinelas numéricas do TSE (-1, -3, -4) também significam "sem valor". */
function cleanNumber(raw: string | undefined): number | null {
  const value = cleanValue(raw);
  if (value === null) return null;
  const parsed = Number.parseInt(value.replace(/\D/g, ""), 10);
  if (Number.isNaN(parsed)) return null;
  if (value.startsWith("-")) return null;
  return parsed;
}

interface CsvTable {
  headers: string[];
  index: Map<string, number>;
  rows: string[][];
  sourceLabel: string;
}

function buildTable(text: string, sourceLabel: string): CsvTable {
  const rows = parseCsv(text);
  if (rows.length === 0) {
    throw new Error(`CSV vazio: ${sourceLabel}`);
  }

  const headers = rows[0].map(normalizeHeader);
  const index = new Map<string, number>();
  headers.forEach((header, position) => {
    if (!index.has(header)) index.set(header, position);
  });

  // Mapeamento por NOME, nunca por posição: o TSE já reordenou colunas entre
  // ciclos e um layout novo tem que falhar alto, não silenciosamente torto.
  const missing = REQUIRED_COLUMNS.filter(column => !index.has(column));
  if (missing.length > 0) {
    throw new Error(
      [
        `O CSV do TSE não tem as colunas obrigatórias: ${missing.join(", ")}.`,
        `Arquivo: ${sourceLabel}`,
        `Cabeçalho lido (${headers.length} colunas): ${headers.join(", ")}`,
        "Se o layout mudou, ajuste REQUIRED_COLUMNS/OPTIONAL_COLUMNS neste script.",
      ].join("\n")
    );
  }

  // Acumula em vez de avisar por arquivo — ver `missingOptionalColumns`.
  for (const column of OPTIONAL_COLUMNS) {
    if (!index.has(column)) {
      missingOptionalColumns.set(column, (missingOptionalColumns.get(column) ?? 0) + 1);
    }
  }

  return { headers, index, rows: rows.slice(1), sourceLabel };
}

/** UM aviso para todas as colunas opcionais ausentes, em todos os CSVs. */
function reportMissingOptionalColumns(totalTables: number) {
  if (missingOptionalColumns.size === 0) return;
  const detalhe = [...missingOptionalColumns.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([column, count]) => `${column} (em ${count}/${totalTables} arquivo(s))`)
    .join(", ");
  warn(
    `Coluna(s) opcional(is) ausente(s) no pacote do TSE: ${detalhe}. ` +
      "Os campos correspondentes vêm vazios. Em 2026 a situação da candidatura " +
      "não está no pacote por decisão do TSE — ela vem do DivulgaCandContas."
  );
}

/**
 * Carimba `lastSyncedAt` SEM tocar em `updatedAt`, e devolve quantas linhas.
 *
 * `updatedAt` é `@updatedAt`: QUALQUER update do Prisma o reescreve, inclusive
 * um que não muda campo nenhum — e `updatedAt` é o `<lastmod>` do sitemap. Com
 * o `lastSyncedAt: new Date()` dentro do payload de update, um sync sem
 * novidade anunciava aos buscadores que as 211 páginas haviam mudado, quatro
 * vezes por dia. "Conferido agora" e "mudou agora" são afirmações diferentes,
 * e só uma delas é verdade num run sem diff.
 *
 * SQL cru porque `update`/`updateMany` do Prisma sempre carregam o
 * `@updatedAt` junto. De quebra, as 211 viram UM statement em vez de 211.
 */
async function touchLastSynced(prisma: PrismaClient, tseIds: string[]): Promise<number> {
  if (tseIds.length === 0) return 0;
  return prisma.$executeRaw`
    UPDATE "Candidate" SET "lastSyncedAt" = NOW() WHERE "tseId" IN (${Prisma.join(tseIds)})
  `;
}

function cell(table: CsvTable, row: string[], column: string): string | undefined {
  const position = table.index.get(column);
  if (position === undefined) return undefined;
  return row[position];
}

// ============================================================
// Situação de registro
// ============================================================

/**
 * Tradução da situação do TSE para o enum interno.
 *
 * REGRA EDITORIAL: o enum é só para filtro e ordenação. O texto exibido é
 * sempre `tseStatusLabel`/`tseStatusDetail`, com a palavra do próprio TSE
 * (ver app/lib/candidate-status.ts).
 *
 * ASSUNÇÃO DE LAYOUT: no layout moderno do consulta_cand,
 * `DS_SITUACAO_CANDIDATURA` costuma trazer o estado grosso ("APTO"/"INAPTO")
 * e `DS_DETALHE_SITUACAO_CAND` o julgamento fino ("DEFERIDO", "INDEFERIDO COM
 * RECURSO", ...). Por isso o detalhe é consultado primeiro e a situação serve
 * de fallback.
 *
 * TRÊS SAÍDAS, e a diferença entre as duas últimas é o defeito que este
 * script carregava:
 *
 *   - redação CONHECIDA   → o enum correspondente;
 *   - NENHUMA fonte falou → `STATUS_UNDISCLOSED` (aguardando julgamento), o
 *     estado real de quem está no CSV e ainda não foi julgado;
 *   - redação DESCONHECIDA → `null`, e AVISO. `null` não é "sem situação": é
 *     "não sei traduzir isto". Quem grava escreve a redação literal e NÃO
 *     escreve o enum — ver a guarda em `writeData`.
 *
 * O que acontecia antes: uma redação nova ("Cassado por abuso de poder", por
 * exemplo) avisava e mesmo assim gravava PENDING_JUDGMENT. A candidatura
 * ficava com rótulo honesto e enum inventado — e PRESA, porque no run seguinte
 * o diff não via diferença nenhuma.
 */
const STATUS_UNDISCLOSED: RegistrationStatus = "PENDING_JUDGMENT";

interface StatusResult {
  /** `null` = o TSE escreveu algo que o `TSE_STATUS_MAP` não conhece. */
  status: RegistrationStatus | null;
  matchedFrom: "detalhe" | "situacao" | "fallback" | "desconhecida";
}

function mapStatus(
  situacao: string | null,
  detalhe: string | null,
  candidateLabel: string
): StatusResult {
  const fromDetail = tseStatusWrite(detalhe);
  if (fromDetail.kind === "mapped") {
    return { status: fromDetail.status, matchedFrom: "detalhe" };
  }

  const fromSituacao = tseStatusWrite(situacao);
  if (fromSituacao.kind === "mapped") {
    return { status: fromSituacao.status, matchedFrom: "situacao" };
  }

  // (a) COLUNA VAZIA. No pacote de 2026 `DS_SITUACAO_CANDIDATURA` vem `#NE`
  //     em TODAS as candidaturas e `DS_DETALHE_SITUACAO_CAND` nem existe: o
  //     TSE só publica a situação depois de julgar. O correto é
  //     "aguardando julgamento", não REGISTERED — "Registro protocolado"
  //     afirmaria um estágio processual que ninguém alcançou ainda. E não é
  //     anomalia: avisar 211 vezes só enterraria os avisos que importam.
  if (fromDetail.kind === "absent" && fromSituacao.kind === "absent") {
    statusUndisclosedCount++;
    return { status: STATUS_UNDISCLOSED, matchedFrom: "fallback" };
  }

  // (b) REDAÇÃO DESCONHECIDA. Isso sim é anomalia, e merece aviso por
  //     candidatura — em TODA execução, até que a redação entre no mapa.
  warn(
    `Situação do TSE não mapeada para ${candidateLabel}: ` +
      `situação=${JSON.stringify(situacao)} / detalhe=${JSON.stringify(detalhe)}. ` +
      "A redação literal FOI gravada; o registrationStatus guardado foi PRESERVADO " +
      "(nenhum palpite). Adicione a redação em TSE_STATUS_MAP (app/lib/candidate-status.ts)."
  );
  return { status: null, matchedFrom: "desconhecida" };
}

// ============================================================
// Linhas do TSE → payload do Candidate
// ============================================================

interface TseRow {
  tseId: string;
  cargo: string;
  /** DS_CARGO literal, usado para conferir o código numérico. */
  dsCargo: string | null;
  /** CD_ELEICAO — difere entre a disputa federal e a estadual. */
  cdEleicao: string | null;
  /** SG_UE — unidade eleitoral: "BR" para presidente, a UF para governador. */
  sgUe: string | null;
  turno: string | null;
  uf: string | null;
  ano: string | null;
  numero: number | null;
  numeroRaw: string | null;
  nome: string;
  nomeUrna: string | null;
  nomeSocial: string | null;
  partido: string;
  partidoNome: string | null;
  sqColigacao: string | null;
  coligacao: string | null;
  composicaoColigacao: string | null;
  situacao: string | null;
  detalheSituacao: string | null;
}

function toTseRow(table: CsvTable, row: string[]): TseRow | null {
  const tseId = cleanValue(cell(table, row, "SQ_CANDIDATO"));
  const cargo = cleanValue(cell(table, row, "CD_CARGO"));
  const nome = cleanValue(cell(table, row, "NM_CANDIDATO"));
  const partido = cleanValue(cell(table, row, "SG_PARTIDO"));

  if (!tseId || !cargo || !nome || !partido) return null;

  return {
    tseId,
    // Zeros à esquerda aparecem em alguns dumps ("01"): normaliza para o dígito.
    cargo: String(Number.parseInt(cargo, 10)),
    dsCargo: cleanValue(cell(table, row, "DS_CARGO")),
    cdEleicao: cleanValue(cell(table, row, "CD_ELEICAO")),
    sgUe: cleanValue(cell(table, row, "SG_UE")),
    turno: cleanValue(cell(table, row, "NR_TURNO")),
    uf: cleanValue(cell(table, row, "SG_UF")),
    ano: cleanValue(cell(table, row, "ANO_ELEICAO")),
    numero: cleanNumber(cell(table, row, "NR_CANDIDATO")),
    numeroRaw: cleanValue(cell(table, row, "NR_CANDIDATO")),
    nome,
    nomeUrna: cleanValue(cell(table, row, "NM_URNA_CANDIDATO")),
    nomeSocial: cleanValue(cell(table, row, "NM_SOCIAL_CANDIDATO")),
    partido,
    partidoNome: cleanValue(cell(table, row, "NM_PARTIDO")),
    sqColigacao: cleanValue(cell(table, row, "SQ_COLIGACAO")),
    coligacao: cleanValue(cell(table, row, "NM_COLIGACAO")),
    composicaoColigacao: cleanValue(cell(table, row, "DS_COMPOSICAO_COLIGACAO")),
    situacao: cleanValue(cell(table, row, "DS_SITUACAO_CANDIDATURA")),
    detalheSituacao: cleanValue(cell(table, row, "DS_DETALHE_SITUACAO_CAND")),
  };
}

/**
 * `DS_COMPOSICAO_COLIGACAO` vem como "PARTIDO A / PARTIDO B / PARTIDO C".
 * Quando o partido concorre sozinho, o TSE grava "Partido isolado" tanto aqui
 * quanto em NM_COLIGACAO — e o texto é mantido como está, por ser a redação
 * oficial.
 */
function splitCoalitionParties(composicao: string | null): string[] {
  if (!composicao) return [];
  return composicao
    .split("/")
    .map(part => part.trim())
    .filter(part => part.length > 0);
}

/**
 * Exatamente o que o TSE governa no registro. Tipado (em vez de
 * `Record<string, unknown>`) para que o `tsc` acuse se uma coluna do schema
 * mudar de nome ou de tipo — um cast aqui esconderia justamente o erro que
 * mais dói num sync de dados oficiais.
 */
interface CandidateWriteData {
  name: string;
  displayName: string;
  party: string;
  number: number | null;
  coalition: string | null;
  coalitionParties: string[];
  electionType: string;
  uf: string | null;
  dataSource: string;
  /** `null` quando o CSV não trouxe CD_ELEICAO/SG_UE — ausência, não erro. */
  sourceUrl: string | null;
  /**
   * Opcionais de propósito: sem fonte para a situação, os três são omitidos
   * do update e o valor já gravado sobrevive. E `registrationStatus` é
   * omitido também quando a redação existe mas é desconhecida. Ver a guarda
   * em `writeData`.
   */
  tseStatusLabel?: string | null;
  tseStatusDetail?: string | null;
  registrationStatus?: RegistrationStatus;
  /**
   * Só nas escritas que MUDAM alguma coisa. As candidaturas inalteradas
   * recebem o carimbo por `touchLastSynced()`, que não bate em `updatedAt`.
   */
  lastSyncedAt?: Date;
  /** Só presentes quando o CSV trouxe valor — ver preservação de curadoria. */
  viceName?: string;
  viceParty?: string;
  photoUrl?: string;
  /** Só presente com --plans, e só quando o campo estava vazio. */
  governmentPlanUrl?: string;
}

interface CandidatePayload {
  tseId: string;
  name: string;
  displayName: string;
  party: string;
  number: number | null;
  coalition: string | null;
  coalitionParties: string[];
  tseStatusLabel: string | null;
  tseStatusDetail: string | null;
  /**
   * `null` quando a redação do TSE é desconhecida. Nesse caso o enum NÃO é
   * gravado numa linha existente — ver `mapStatus` e a guarda em `writeData`.
   */
  registrationStatus: RegistrationStatus | null;
  electionType: string;
  uf: string | null;
  dataSource: string;
  /** `null` quando o CSV não trouxe CD_ELEICAO/SG_UE — ausência, não erro. */
  sourceUrl: string | null;
  /**
   * Houve fonte para a situação (DivulgaCandContas ou CSV). Quando `false`,
   * os campos de situação são OMITIDOS do update — ver `writeData`.
   */
  statusKnown: boolean;
  /** Só preenchido quando o CSV traz a chapa; nunca apaga curadoria manual. */
  viceName: string | null;
  viceParty: string | null;
  /** Só preenchido com --photos. */
  photoUrl: string | null;
  /** Só preenchido com --plans. */
  governmentPlanUrl: string | null;
}

/**
 * TRÊS FONTES PARA A MESMA SITUAÇÃO, e uma ordem de precedência explícita:
 *
 *   1. `fichaSituacao`   — `descricaoSituacao` da ficha individual (`/buscar`)
 *   2. `divulgaSituacao` — `descricaoSituacao` da listagem por unidade
 *   3. `row.situacao`    — `DS_SITUACAO_CANDIDATURA` do CSV de dados abertos
 *
 * A FICHA VENCE porque é o recorte mais específico: um GET por candidatura,
 * contra uma listagem que responde por até 27 de uma vez e um pacote de dados
 * abertos republicado 4×/dia. Quando duas fontes divergem, é uma delas que
 * está velha, e a mais específica é a que menos tem por onde envelhecer.
 *
 * A ficha já era lida — só que `descricaoSituacao` dela alimentava apenas
 * `aptoFromDivulga()` e era descartada em seguida. Daí saíam linhas
 * incoerentes no banco, do tipo `Deferido | APPROVED | tseApto: null`: o
 * rótulo vinha da listagem e a aptidão da ficha, cada um de um instante
 * diferente. Lendo as duas do mesmo lugar, a incoerência não tem como nascer.
 *
 * Divergência entre as duas emite AVISO (ver `warnStatusDivergence`), porque
 * ela é informação: significa que um dos caches do TSE está atrasado.
 *
 * `null` em todas as três significa "ninguém disse" — e aí o script não
 * afirma nada, em vez de chutar.
 */
function buildPayload(
  row: TseRow,
  vice: TseRow | null,
  divulgaSituacao: string | null,
  fichaSituacao: string | null
): CandidatePayload {
  const label = `${row.nomeUrna ?? row.nome} (${row.partido})`;
  const situacao = fichaSituacao ?? divulgaSituacao ?? row.situacao;
  const { status } = mapStatus(situacao, row.detalheSituacao, label);

  return {
    tseId: row.tseId,
    name: row.nome,
    displayName: row.nomeUrna ?? row.nome,
    party: row.partido,
    number: row.numero,
    coalition: row.coligacao,
    coalitionParties: splitCoalitionParties(row.composicaoColigacao),
    tseStatusLabel: situacao,
    tseStatusDetail: row.detalheSituacao,
    registrationStatus: status,
    statusKnown: situacao !== null || row.detalheSituacao !== null,
    electionType: row.cargo === CARGO_GOVERNADOR ? "governor" : "presidential",
    // Presidente é nacional: uf fica nula. Governador carrega o estado.
    uf: row.cargo === CARGO_GOVERNADOR ? row.uf : null,
    dataSource: "tse",
    sourceUrl: divulgaUrl(row.sgUe, row.tseId),
    viceName: vice ? (vice.nomeUrna ?? vice.nome) : null,
    viceParty: vice ? vice.partido : null,
    photoUrl: null,
    governmentPlanUrl: null,
  };
}

// ============================================================
// Carga do CSV (rede ou arquivo)
// ============================================================

const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04]; // "PK\x03\x04"

function looksLikeZip(bytes: Uint8Array): boolean {
  return ZIP_MAGIC.every((byte, i) => bytes[i] === byte);
}

/**
 * O TSE publica em latin-1 / ISO-8859-1, NÃO em utf-8. Sem transcodificar,
 * "MARÇAL" vira "MAR�AL" e o nome entra torto no banco.
 *
 * Nota: `TextDecoder("latin1")` implementa windows-1252, superconjunto do
 * ISO-8859-1 nas posições 0x80–0x9F (que o TSE não usa). Na prática o
 * resultado é idêntico, com a vantagem de não quebrar se aparecer um byte
 * dessa faixa.
 */
function decodeLatin1(bytes: Uint8Array): string {
  try {
    return new TextDecoder("latin1").decode(bytes);
  } catch {
    return toBuffer(bytes).toString("latin1");
  }
}

function extractCandidateCsvs(bytes: Uint8Array, sourceLabel: string): CsvTable[] {
  if (!looksLikeZip(bytes)) {
    // Arquivo solto: assume que já é o CSV, mas confere antes — download
    // interrompido ou página de erro HTML salva como .zip são o caso comum,
    // e "faltam colunas obrigatórias" seria uma pista péssima.
    if (/\.zip$/i.test(sourceLabel)) {
      throw new Error(
        `O arquivo tem extensão .zip mas não começa com a assinatura ZIP (PK\\x03\\x04): ${sourceLabel}\n` +
          "Provável download interrompido ou página de erro salva no lugar do pacote. Baixe de novo."
      );
    }
    const probe = bytes.subarray(0, 1024);
    if (probe.includes(0)) {
      throw new Error(
        `O arquivo não é um CSV de texto nem um ZIP válido: ${sourceLabel}\n` +
          "Foram encontrados bytes nulos no início do conteúdo."
      );
    }
    return [buildTable(decodeLatin1(bytes), sourceLabel)];
  }

  const entries = readZipEntries(bytes);
  const csvEntries = entries.filter(entry => /\.csv$/i.test(entry.name));

  if (csvEntries.length === 0) {
    throw new Error(
      `Nenhum .csv dentro de ${sourceLabel}. Conteúdo: ${entries.map(e => e.name).join(", ")}`
    );
  }

  // Prefere os arquivos de candidatura; o ZIP também traz o PDF de leiaute e,
  // em alguns ciclos, CSVs auxiliares.
  // O pacote traz 29 CSVs: um por UF, um `_BR` com os cargos nacionais, e um
  // `_BRASIL` que é o CONSOLIDADO de tudo. Ler os dois conjuntos conta cada
  // candidatura duas vezes — foi o que produziu "26 presidenciais" e
  // "396 governadores" (o dobro dos 13 e 198 reais), além de fazer cada
  // titular encontrar dois vices com o mesmo número e perder a chapa.
  const isConsolidado = (name: string) =>
    /consulta_cand_\d{4}_BRASIL\.csv$/i.test(name.split(/[\\/]/).pop() ?? name);

  const preferred = csvEntries.filter(
    entry => /consulta_cand/i.test(entry.name) && !isConsolidado(entry.name)
  );
  const chosen = preferred.length > 0 ? preferred : csvEntries;

  const descartados = csvEntries.filter(e => isConsolidado(e.name));
  if (descartados.length > 0) {
    console.log(
      `   ↩️  Ignorando consolidado nacional (duplicaria tudo): ${descartados
        .map(e => e.name)
        .join(", ")}`
    );
  }

  console.log(`   📦 CSVs no pacote: ${chosen.length} arquivo(s)`);

  return chosen.map(entry => buildTable(decodeLatin1(entry.read()), `${sourceLabel}#${entry.name}`));
}

async function loadCandidateTables(options: Options): Promise<CsvTable[]> {
  if (options.fromFile) {
    const filePath = path.resolve(process.cwd(), options.fromFile);
    if (!existsSync(filePath)) {
      throw new Error(`Arquivo não encontrado: ${filePath}`);
    }
    console.log(`📂 Lendo arquivo local: ${filePath}`);
    return extractCandidateCsvs(new Uint8Array(readFileSync(filePath)), filePath);
  }

  const url = options.url ?? CAND_ZIP_URL;
  console.log(`🌐 Baixando candidaturas do TSE...`);
  console.log(`   ${url}`);
  const bytes = await fetchBinary(url);
  console.log(`   ✅ ${(bytes.byteLength / 1024 / 1024).toFixed(2)} MB recebidos`);
  return extractCandidateCsvs(bytes, url);
}

// ============================================================
// Fotos de urna
// ============================================================

/**
 * ASSUNÇÃO: os arquivos dentro do pacote seguem `F{SG_UF}{SQ_CANDIDATO}_div.jpg`
 * (ex.: FBR280001607080_div.jpg). Para não depender do prefixo nem da
 * extensão, o casamento é feito por conter o SQ_CANDIDATO no nome do arquivo —
 * o SQ tem 12+ dígitos, então colisão é implausível.
 */
async function loadPhotoZip(options: Options): Promise<ZipEntry[] | null> {
  if (options.photosFile) {
    const filePath = path.resolve(process.cwd(), options.photosFile);
    if (!existsSync(filePath)) {
      throw new Error(`Pacote de fotos não encontrado: ${filePath}`);
    }
    console.log(`📂 Lendo pacote de fotos local: ${filePath}`);
    return readZipEntries(new Uint8Array(readFileSync(filePath)));
  }

  // Fase A busca as fotos por UF: o pacote nacional só traz Presidente/Vice,
  // e governador vive no pacote do seu estado. Ao contrário da versão
  // anterior, aqui a lista NÃO é fallback — é acumulação: 28 pacotes que se
  // somam. Um estado indisponível vira aviso, não interrompe os outros.
  const explicit = options.photosUrl !== null;
  const urls = explicit
    ? [options.photosUrl as string]
    : [UF_NACIONAL, ...UFS].map(photoZipUrl);

  const entries: ZipEntry[] = [];
  const failures: string[] = [];
  let lastError: unknown;

  for (const url of urls) {
    try {
      console.log(`🌐 Baixando fotos de urna: ${url}`);
      const bytes = await fetchBinary(url);
      console.log(`   ✅ ${(bytes.byteLength / 1024 / 1024).toFixed(2)} MB`);
      entries.push(...readZipEntries(bytes));
      if (explicit) return entries;
    } catch (err) {
      lastError = err;
      // 403 é bloqueio de borda: se o CDN nos barra, barra todos os 28.
      if (err instanceof TseForbiddenError) throw err;
      failures.push(url);
      warn(`Pacote de fotos indisponível: ${url} — ${(err as Error).message}`);
    }
  }

  if (entries.length > 0) {
    if (failures.length > 0) {
      warn(
        `${failures.length} de ${urls.length} pacotes de fotos falharam. ` +
          "As candidaturas dessas UFs ficam sem foto — ausência real, não erro silencioso."
      );
    }
    console.log(`📸 ${entries.length} arquivos de foto reunidos.`);
    return entries;
  }

  warn(
    "Nenhuma URL de fotos funcionou. Confirme o nome do pacote em " +
      `${TSE_DATASET_PAGE} e rode com --photos-url <url> ou --photos-file <zip>.`
  );
  if (lastError && !(lastError instanceof Error)) throw lastError;
  return null;
}

/**
 * Carrega os pacotes de proposta de governo. Mesma acumulação das fotos: são
 * 28 arquivos que se somam, e uma UF indisponível vira aviso, não parada.
 */
async function loadPlanZips(options: Options): Promise<ZipEntry[] | null> {
  if (options.plansFile) {
    const filePath = path.resolve(process.cwd(), options.plansFile);
    if (!existsSync(filePath)) {
      throw new Error(`Pacote de propostas não encontrado: ${filePath}`);
    }
    console.log(`📂 Lendo pacote de propostas local: ${filePath}`);
    return readZipEntries(new Uint8Array(readFileSync(filePath)));
  }

  const explicit = options.plansUrl !== null;
  const urls = explicit
    ? [options.plansUrl as string]
    : [UF_NACIONAL, ...UFS].map(planZipUrl);

  const entries: ZipEntry[] = [];
  const failures: string[] = [];

  for (const url of urls) {
    try {
      console.log(`🌐 Baixando propostas de governo: ${url}`);
      const bytes = await fetchBinary(url);
      console.log(`   ✅ ${(bytes.byteLength / 1024 / 1024).toFixed(2)} MB`);
      entries.push(...readZipEntries(bytes));
      if (explicit) return entries;
    } catch (err) {
      if (err instanceof TseForbiddenError) throw err;
      failures.push(url);
      warn(`Pacote de propostas indisponível: ${url} — ${(err as Error).message}`);
    }
  }

  if (entries.length > 0) {
    if (failures.length > 0) {
      warn(
        `${failures.length} de ${urls.length} pacotes de propostas falharam. ` +
          "As candidaturas dessas UFs ficam sem plano — ausência real."
      );
    }
    console.log(`📄 ${entries.length} arquivos de proposta reunidos.`);
    return entries;
  }

  warn("Nenhum pacote de propostas pôde ser lido.");
  return null;
}

/**
 * Extrai a proposta de uma candidatura. O TSE nomeia os arquivos com o
 * SQ_CANDIDATO dentro, como nas fotos.
 */
function savePlan(
  entries: ZipEntry[],
  tseId: string,
  dryRun: boolean
): { written: boolean; planUrl: string | null } {
  const match = entries.find(entry => {
    const base = entry.name.split(/[\\/]/).pop() ?? entry.name;
    return /\.pdf$/i.test(base) && base.includes(tseId);
  });

  if (!match) {
    // Ausência é informação: nem toda candidatura arquiva no prazo, e o
    // silêncio é o que a interface deve mostrar — não um plano inventado.
    warn(`Proposta de governo não encontrada no pacote para SQ_CANDIDATO=${tseId}.`);
    return { written: false, planUrl: null };
  }

  const planUrl = `${PLAN_PUBLIC_PREFIX}/${tseId}.pdf`;
  if (dryRun) return { written: false, planUrl };

  if (!existsSync(PLAN_OUTPUT_DIR)) mkdirSync(PLAN_OUTPUT_DIR, { recursive: true });
  writeFileSync(path.join(PLAN_OUTPUT_DIR, `${tseId}.pdf`), match.read());
  return { written: true, planUrl };
}

function savePhoto(
  entries: ZipEntry[],
  tseId: string,
  dryRun: boolean
): { written: boolean; photoUrl: string | null } {
  const match = entries.find(entry => {
    const base = entry.name.split(/[\\/]/).pop() ?? entry.name;
    return /\.jpe?g$/i.test(base) && base.includes(tseId);
  });

  if (!match) {
    warn(`Foto de urna não encontrada no pacote para SQ_CANDIDATO=${tseId}.`);
    return { written: false, photoUrl: null };
  }

  const photoUrl = `${PHOTO_PUBLIC_PREFIX}/${tseId}.jpg`;
  if (dryRun) return { written: false, photoUrl };

  if (!existsSync(PHOTO_OUTPUT_DIR)) {
    mkdirSync(PHOTO_OUTPUT_DIR, { recursive: true });
  }
  writeFileSync(path.join(PHOTO_OUTPUT_DIR, `${tseId}.jpg`), match.read());
  return { written: true, photoUrl };
}

// ============================================================
// Diff
// ============================================================

type FieldValue = string | number | string[] | null;

interface FieldDiff {
  field: string;
  before: FieldValue;
  after: FieldValue;
}

function sameValue(a: FieldValue, b: FieldValue): boolean {
  if (Array.isArray(a) || Array.isArray(b)) {
    const left = Array.isArray(a) ? a : [];
    const right = Array.isArray(b) ? b : [];
    return left.length === right.length && left.every((item, i) => item === right[i]);
  }
  return a === b;
}

function formatValue(value: FieldValue): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return `[${value.join(", ")}]`;
  return JSON.stringify(value);
}

/** Campos gerenciados pelo TSE. `lastSyncedAt` fica de fora de propósito. */
function diffCandidate(
  existing: Record<string, unknown> | null,
  payload: CandidatePayload,
  includePhoto: boolean
): FieldDiff[] {
  if (!existing) return [];

  const managed: Array<[string, FieldValue]> = [
    ["name", payload.name],
    ["displayName", payload.displayName],
    ["party", payload.party],
    ["number", payload.number],
    ["coalition", payload.coalition],
    ["coalitionParties", payload.coalitionParties],
    ["electionType", payload.electionType],
    ["uf", payload.uf],
    ["dataSource", payload.dataSource],
    ["sourceUrl", payload.sourceUrl],
  ];

  // Espelha a guarda de escrita, nas duas camadas: sem fonte para a situação,
  // nada de situação entra no diff; com fonte mas redação desconhecida, entra
  // a redação e NÃO entra o enum — porque o enum não vai ser gravado. Um diff
  // que anuncia o que a escrita não faz é um relatório que mente.
  if (payload.statusKnown) {
    managed.push(["tseStatusLabel", payload.tseStatusLabel]);
    managed.push(["tseStatusDetail", payload.tseStatusDetail]);
    if (payload.registrationStatus !== null) {
      managed.push(["registrationStatus", payload.registrationStatus]);
    }
  }

  // Só entra no diff quando o pacote foi lido E o campo está vazio — as duas
  // condições espelham exatamente a guarda de escrita. Sem a segunda, o diff
  // anunciaria "vai trocar a URL" para quem tem plano curado, quando a
  // gravação descarta esse valor: relatório que contradiz o que o script faz.
  if (payload.governmentPlanUrl !== null && !existing.governmentPlanUrl) {
    managed.push(["governmentPlanUrl", payload.governmentPlanUrl]);
  }

  // Chapa e foto só entram no diff quando o CSV/pacote trouxe valor — assim
  // uma curadoria manual nunca aparece como "mudança".
  if (payload.viceName !== null) managed.push(["viceName", payload.viceName]);
  if (payload.viceParty !== null) managed.push(["viceParty", payload.viceParty]);
  if (includePhoto && payload.photoUrl !== null) managed.push(["photoUrl", payload.photoUrl]);

  const diffs: FieldDiff[] = [];
  for (const [field, after] of managed) {
    const before = (existing[field] ?? null) as FieldValue;
    if (!sameValue(before, after)) {
      diffs.push({ field, before, after });
    }
  }
  return diffs;
}

// ============================================================
// Sync
// ============================================================

interface SyncStats {
  /** Quantas situações o DivulgaCandContas devolveu (fonte da verdade). */
  statusFromDivulga: number;
  /** Unidades eleitorais sem resposta — situação preservada, não sobrescrita. */
  divulgaFailedUnits: number;
  totalRows: number;
  presidentialRows: number;
  adopted: number;
  plansWritten: number;
  governorRows: number;
  viceRows: number;
  created: number;
  updated: number;
  unchanged: number;
  photosWritten: number;
  /** Fichas completas lidas (bens, eleições anteriores, processo, aptidão). */
  detailsRead: number;
  /** Fichas que não responderam — os campos delas NÃO foram tocados. */
  detailsFailed: number;
  aptoApt: number;
  aptoUnapt: number;
  aptoUndecided: number;
  /** Bens que as fichas declaram / quantos precisaram ser regravados. */
  assetsRead: number;
  assetsWritten: number;
  /** Bens APAGADOS pela regravação — sem este número, destruir sai calado. */
  assetsDeleted: number;
  /** Fichas sem a chave `bens`: patrimônio preservado, não zerado. */
  assetsAbsent: number;
  /** Linhas de histórico declaradas / criadas / atualizadas. */
  historyRead: number;
  historyCreated: number;
  historyUpdated: number;
  /** Candidaturas cuja aptidão ou nº de processo mudou. */
  candidatesUpdatedByDetail: number;
  /** Listagem e ficha discordaram sobre a situação — venceu a ficha. */
  statusDivergences: number;
  /** Candidaturas sem mudança que receberam só o carimbo de `lastSyncedAt`. */
  touched: number;
}

async function syncTse(options: Options) {
  const stats: SyncStats = {
    statusFromDivulga: 0,
    divulgaFailedUnits: 0,
    totalRows: 0,
    presidentialRows: 0,
    adopted: 0,
    plansWritten: 0,
    governorRows: 0,
    viceRows: 0,
    created: 0,
    updated: 0,
    unchanged: 0,
    photosWritten: 0,
    detailsRead: 0,
    detailsFailed: 0,
    aptoApt: 0,
    aptoUnapt: 0,
    aptoUndecided: 0,
    assetsRead: 0,
    assetsWritten: 0,
    assetsDeleted: 0,
    assetsAbsent: 0,
    historyRead: 0,
    historyCreated: 0,
    historyUpdated: 0,
    candidatesUpdatedByDetail: 0,
    statusDivergences: 0,
    touched: 0,
  };

  console.log("🗳️  Sincronização TSE 2026 — Presidente e Governador (Fase A)");
  console.log(`   Dataset: ${TSE_DATASET_PAGE}`);
  if (options.dryRun) console.log("   🧪 Modo --dry-run: nada será gravado.\n");
  else console.log("");



  // ---------- 1. CSV ----------
  const tables = await loadCandidateTables(options);
  reportMissingOptionalColumns(tables.length);

  const presidentialRows: TseRow[] = [];
  const governorRows: TseRow[] = [];
  const viceRows: TseRow[] = [];
  const cargoCounts = new Map<string, number>();
  const ufCounts = new Map<string, number>();
  const turnoCounts = new Map<string, number>();

  for (const table of tables) {
    stats.totalRows += table.rows.length;

    for (const rawRow of table.rows) {
      const row = toTseRow(table, rawRow);
      if (!row) continue;

      cargoCounts.set(row.cargo, (cargoCounts.get(row.cargo) ?? 0) + 1);
      ufCounts.set(row.uf ?? "?", (ufCounts.get(row.uf ?? "?") ?? 0) + 1);
      turnoCounts.set(row.turno ?? "?", (turnoCounts.get(row.turno ?? "?") ?? 0) + 1);

      // Escopo da Fase A: Presidente (nacional) e Governador (por UF) — os
      // dois únicos cargos desta eleição obrigados por lei a arquivar proposta
      // de governo. Senador e deputado ficam de fora por decisão de produto,
      // não por limitação técnica: sem documento, não há posição com fonte.
      const isPrimeiroTurno = row.turno === null || row.turno === TURNO_PRIMEIRO;
      if (!isPrimeiroTurno) continue;

      const isCargoNacional =
        row.cargo === CARGO_PRESIDENTE || row.cargo === CARGO_VICE;
      const isCargoEstadual =
        row.cargo === CARGO_GOVERNADOR || row.cargo === CARGO_VICE_GOVERNADOR;
      if (!isCargoNacional && !isCargoEstadual) continue;

      // O âmbito tem de bater com o cargo. Um "governador" com SG_UF=BR (ou um
      // presidente com UF) é arquivo trocado, não dado exótico.
      const ehNacional = row.uf === null || row.uf === UF_NACIONAL;
      if (isCargoNacional && !ehNacional) continue;
      if (isCargoEstadual && ehNacional) continue;

      // Conferência cruzada: DS_CARGO é auto-descritivo. Se o código numérico
      // disser uma coisa e o texto outra, o layout mudou — parar é mais barato
      // que gravar milhares de deputados achando que são governadores.
      const esperado = CARGO_LABELS[row.cargo];
      if (esperado && row.dsCargo && !esperado.test(row.dsCargo)) {
        throw new Error(
          `CD_CARGO=${row.cargo} veio com DS_CARGO="${row.dsCargo}", que não bate ` +
            `com o esperado (${esperado}). O layout do TSE provavelmente mudou — ` +
            "confira antes de sincronizar."
        );
      }

      if (row.ano !== null && row.ano !== ELECTION_YEAR) {
        warn(`Linha com ANO_ELEICAO=${row.ano} (esperado ${ELECTION_YEAR}): ${row.nome}. Ignorada.`);
        continue;
      }

      if (row.cargo === CARGO_PRESIDENTE) presidentialRows.push(row);
      else if (row.cargo === CARGO_GOVERNADOR) governorRows.push(row);
      else viceRows.push(row);
    }
  }

  stats.presidentialRows = presidentialRows.length;
  stats.governorRows = governorRows.length;
  const titularRows = [...presidentialRows, ...governorRows];
  stats.viceRows = viceRows.length;

  if (presidentialRows.length === 0) {
    throw new Error(
      [
        "Nenhuma linha de Presidente (CD_CARGO=1, SG_UF=BR, NR_TURNO=1) encontrada.",
        `Linhas lidas: ${stats.totalRows}`,
        `Cargos vistos: ${[...cargoCounts].map(([k, v]) => `${k}=${v}`).join(", ") || "nenhum"}`,
        `UFs vistas: ${[...ufCounts].map(([k, v]) => `${k}=${v}`).join(", ") || "nenhuma"}`,
        `Turnos vistos: ${[...turnoCounts].map(([k, v]) => `${k}=${v}`).join(", ") || "nenhum"}`,
        "Confira se o arquivo é mesmo o consulta_cand_2026.",
      ].join("\n")
    );
  }

  console.log(
    `\n📊 ${stats.totalRows} linhas lidas | ${presidentialRows.length} presidenciais | ` +
      `${governorRows.length} governadores | ${viceRows.length} vices`
  );

  const ufsComGovernador = new Set(governorRows.map(r => r.uf));
  const ufsFaltando = UFS.filter(uf => !ufsComGovernador.has(uf));
  if (governorRows.length > 0 && ufsFaltando.length > 0) {
    warn(
      `Sem candidatura a governador em ${ufsFaltando.length} UF(s): ${ufsFaltando.join(", ")}. ` +
        "Toda UF elege governador em 2026 — provável pacote incompleto."
    );
  }

  if (presidentialRows.length !== 13) {
    warn(
      `O spec 002 esperava 13 candidaturas presidenciais; o CSV trouxe ${presidentialRows.length}. ` +
        "Pode ser renúncia/indeferimento novo (legítimo) ou arquivo errado — confira antes de publicar."
    );
  }

  // ---------- 2. Chapa (vice) ----------
  // ASSUNÇÃO: o vice compartilha o número de urna do titular. Só preenche
  // quando o casamento é inequívoco (exatamente um vice para o número).
  //
  // A chave inclui a UF de propósito. Número de urna NÃO é único no país: o
  // 13 existe nos 27 estados. Indexar só pelo número — como esta função fazia
  // enquanto o escopo era só Presidente — faria cada governador encontrar 27
  // vices, cair no ramo "mais de um" e perder a chapa inteira, silenciosamente.
  const viceKey = (row: TseRow) => `${row.uf ?? UF_NACIONAL}:${row.numeroRaw}`;

  const vicesByNumber = new Map<string, TseRow[]>();
  for (const vice of viceRows) {
    if (!vice.numeroRaw) continue;
    const bucket = vicesByNumber.get(viceKey(vice)) ?? [];
    bucket.push(vice);
    vicesByNumber.set(viceKey(vice), bucket);
  }

  function findVice(row: TseRow): TseRow | null {
    if (!row.numeroRaw) return null;
    const bucket = vicesByNumber.get(viceKey(row)) ?? [];
    const sameCoalition = row.sqColigacao
      ? bucket.filter(v => v.sqColigacao === row.sqColigacao)
      : bucket;
    const candidates = sameCoalition.length > 0 ? sameCoalition : bucket;
    if (candidates.length === 1) return candidates[0];
    if (candidates.length > 1) {
      warn(
        `Mais de um vice com o número ${row.numeroRaw} em ${row.uf ?? UF_NACIONAL} ` +
          `(${row.nomeUrna ?? row.nome}). ` +
          "viceName/viceParty preservados como estão."
      );
    }
    return null;
  }

  // ---------- 3. Fotos ----------
  let photoEntries: ZipEntry[] | null = null;
  if (options.photos) {
    photoEntries = await loadPhotoZip(options);
    if (photoEntries) console.log(`   🖼️  ${photoEntries.length} arquivos no pacote de fotos\n`);
  }

  let planEntries: ZipEntry[] | null = null;
  if (options.plans) {
    planEntries = await loadPlanZips(options);
    if (planEntries) console.log(`   📄 ${planEntries.length} arquivos no pacote de propostas\n`);
  }

  // ---------- 4. Banco ----------
  const prisma = getPrisma();
  const tseIds = titularRows.map(row => row.tseId);

  // Em --dry-run, banco fora do ar (ou migration pendente) não pode impedir a
  // conferência do arquivo baixado: o diff degrada para "tudo novo", avisa em
  // alto e bom som e a execução termina com código != 0, porque a comparação
  // com o estado real não aconteceu. Fora do dry-run, o erro sobe.
  let existingRows: Array<Record<string, unknown>> = [];
  try {
    existingRows = (await prisma.candidate.findMany({
      where: { tseId: { in: tseIds } },
    })) as unknown as Array<Record<string, unknown>>;
  } catch (err) {
    if (!options.dryRun) throw err;
    dbUnavailable = true;
    warn(
      `Não foi possível ler o banco (${firstLine(err)}). ` +
        "Como é --dry-run, o diff abaixo trata TODAS as candidaturas como novas " +
        "e o script termina com código de erro. Rode `npx prisma migrate deploy` " +
        "se a coluna que faltou vier do schema."
    );
  }

  const existingByTseId = new Map(existingRows.map(row => [row.tseId as string, row]));

  // Candidaturas já no banco SEM tseId — tipicamente vindas do seed de
  // imprensa, que roda antes de o TSE liberar o pacote. Sem isto, a primeira
  // sincronização real criaria uma segunda cópia de cada uma delas e a
  // listagem apareceria com 26 candidaturas presidenciais em vez de 13.
  //
  // A chave é (nome de urna + partido + número). Três campos porque nome
  // sozinho é frágil e número sozinho se repete entre estados; os três juntos
  // identificam uma chapa sem ambiguidade dentro de uma mesma disputa.
  const adoptionKey = (
    displayName: string,
    party: string,
    numero: number | null,
    uf: string | null
  ) => `${normalizeText(displayName)}|${normalizeText(party)}|${numero ?? "?"}|${uf ?? ""}`;

  const orphansByKey = new Map<
    string,
    { id: string; label: string; governmentPlanUrl: string | null }
  >();
  /** Ids adotados nesta execução — não devem reaparecer como duplicata. */
  const adoptedIds = new Set<string>();
  if (!dbUnavailable) {
    try {
      const orphanRows = await prisma.candidate.findMany({
        where: {
          electionType: { in: ["presidential", "governor"] },
          tseId: null,
        },
        select: {
          id: true,
          displayName: true,
          party: true,
          number: true,
          uf: true,
          // Curadoria que a adoção NÃO pode atropelar.
          governmentPlanUrl: true,
        },
      });
      for (const o of orphanRows) {
        orphansByKey.set(adoptionKey(o.displayName, o.party, o.number, o.uf), {
          id: o.id,
          label: `${o.displayName} (${o.party})`,
          governmentPlanUrl: o.governmentPlanUrl,
        });
      }
    } catch (err) {
      warn(`Não foi possível listar candidaturas sem tseId: ${firstLine(err)}`);
    }
  }

  // A situação da candidatura NÃO vem no pacote de dados abertos de 2026
  // (`DS_SITUACAO_CANDIDATURA` é `#NE` em todas as linhas). Vem daqui.
  console.log("🔎 Lendo a situação das candidaturas no DivulgaCandContas...");
  const divulga = await fetchDivulgaStatuses();
  stats.statusFromDivulga = divulga.byTseId.size;
  stats.divulgaFailedUnits = divulga.failedUnits.length;

  for (const { unit, error } of divulga.failedUnits) {
    warn(
      `DivulgaCandContas não respondeu para ${unit}: ${error}. ` +
        "A situação das candidaturas dessa unidade NÃO será sobrescrita " +
        "(o valor já gravado é preservado)."
    );
  }
  console.log(
    `   ${divulga.byTseId.size} situações lidas` +
      (divulga.failedUnits.length
        ? `, ${divulga.failedUnits.length} unidade(s) sem resposta`
        : "")
  );

  // Sem resposta de quase nenhuma unidade, este run não conferiu situação
  // nenhuma. Terminar com código 0 faria o Actions pintar verde sobre uma
  // execução que não fez o trabalho principal — e a defasagem cresceria em
  // silêncio até alguém notar pelo site.
  const divulgaOutage =
    divulga.failedUnits.length > DIVULGA_UNITS * DIVULGA_OUTAGE_RATIO;
  if (divulgaOutage) statusOutage = true;

  // ---------- 3b. Ficha completa (bens, eleições anteriores, processo, aptidão) ----------
  //
  // ANTES do loop de escrita, de propósito. A ficha traz `descricaoSituacao`
  // da mesma candidatura, e é a fonte mais específica das três (ver
  // `buildPayload`): lida aqui, ela alimenta o rótulo gravado no mesmo passo
  // em que alimenta a aptidão. Lida depois — como era —, o rótulo vinha da
  // listagem e a aptidão da ficha, e o banco guardava as duas metades de
  // instantes diferentes.
  //
  // A LISTAGEM só entrega identidade e situação. Bens declarados, eleições
  // anteriores, número do processo de registro e os campos de aptidão existem
  // apenas na ficha individual, um GET por candidatura. Não há endpoint em
  // lote — daí o pool em `~/lib/tse-divulga`.
  const sgUeByTseId = new Map(titularRows.map(row => [row.tseId, row.sgUe]));
  const fetchTargets = titularRows
    .filter(row => row.sgUe !== null)
    .map(row => ({ tseId: row.tseId, sgUe: row.sgUe as string }));

  const semUe = titularRows.length - fetchTargets.length;
  if (semUe > 0) {
    warn(
      `${semUe} candidatura(s) sem SG_UE no CSV — a ficha completa não pode ` +
        "ser pedida sem a unidade eleitoral (a URL errada devolve 200 vazio). " +
        "Situação, bens, histórico e aptidão delas ficam como estão."
    );
  }

  console.log(
    `\n📄 Lendo a ficha completa de ${fetchTargets.length} candidatura(s) no DivulgaCandContas...`
  );

  let lastLogged = 0;
  const { byTseId: detailsById, failed: detailsFailed } = await fetchDivulgaDetails(
    fetchTargets,
    {
      onProgress: (done, total) => {
        if (done === total || done - lastLogged >= 50) {
          lastLogged = done;
          console.log(`   … ${done}/${total}`);
        }
      },
    }
  );

  stats.detailsRead = detailsById.size;
  stats.detailsFailed = detailsFailed.length;

  // UM aviso para todas as fichas sem resposta — e a garantia explícita de
  // que nenhum campo delas foi sobrescrito. Uma queda do TSE não pode virar
  // "não declarou bens" nem "candidatura inapta" sobre uma pessoa real.
  if (detailsFailed.length > 0) {
    const labelByTseId = new Map(
      titularRows.map(r => [r.tseId, `${r.nomeUrna ?? r.nome} (${r.partido})`])
    );
    const amostra = detailsFailed
      .slice(0, 10)
      .map(f => `${labelByTseId.get(f.tseId) ?? f.tseId}: ${f.error}`);
    warn(
      `${detailsFailed.length} ficha(s) não responderam. Situação, bens, histórico ` +
        "eleitoral, número do processo e aptidão dessas candidaturas NÃO foram " +
        "tocados (o valor gravado é preservado):\n      • " +
        amostra.join("\n      • ") +
        (detailsFailed.length > amostra.length
          ? `\n      • … e mais ${detailsFailed.length - amostra.length}`
          : "")
    );
  }

  const created: string[] = [];
  const updated: Array<{ label: string; diffs: FieldDiff[] }> = [];
  const unchanged: string[] = [];
  /** Candidaturas sem mudança: só recebem o carimbo de `lastSyncedAt`. */
  const untouchedTseIds: string[] = [];

  console.log("\n🔁 Processando candidaturas...\n");

  for (const row of titularRows) {
    const daListagem = divulga.byTseId.get(row.tseId) ?? null;
    const daFicha = detailsById.get(row.tseId)?.situacao ?? null;
    const payload = buildPayload(row, findVice(row), daListagem, daFicha);
    const label = `${payload.displayName} (${payload.party}${payload.number !== null ? `, ${payload.number}` : ""})`;

    // As duas fontes deveriam dizer a mesma coisa. Quando não dizem, um dos
    // caches do TSE está atrasado — e quem lê o relatório precisa saber qual
    // valor foi gravado, em vez de descobrir pela página no ar.
    if (daFicha !== null && daListagem !== null && daFicha !== daListagem) {
      stats.statusDivergences++;
      warn(
        `Situação divergente para ${label}: listagem diz ${JSON.stringify(daListagem)}, ` +
          `ficha diz ${JSON.stringify(daFicha)}. Gravada a da FICHA (fonte mais ` +
          "específica) — um dos caches do TSE está atrasado."
      );
    }

    if (payload.number === null) {
      warn(`Sem NR_CANDIDATO válido para ${label}. Campo number ficará nulo.`);
    }

    if (photoEntries) {
      const photo = savePhoto(photoEntries, payload.tseId, options.dryRun);
      payload.photoUrl = photo.photoUrl;
      if (photo.written) stats.photosWritten++;
    }

    if (planEntries) {
      const plan = savePlan(planEntries, payload.tseId, options.dryRun);
      payload.governmentPlanUrl = plan.planUrl;
      if (plan.written) stats.plansWritten++;
    }

    const existing = existingByTseId.get(payload.tseId) ?? null;
    const diffs = diffCandidate(existing as Record<string, unknown> | null, payload, options.photos);

    // Campos curados à mão (biography, governmentPlanUrl, officialSiteUrl,
    // socialLinks) NÃO entram no update: o CSV do TSE não os carrega, então
    // omiti-los é o que preserva a curadoria.
    const writeData: CandidateWriteData = {
      name: payload.name,
      displayName: payload.displayName,
      party: payload.party,
      number: payload.number,
      coalition: payload.coalition,
      coalitionParties: payload.coalitionParties,
      electionType: payload.electionType,
      uf: payload.uf,
      dataSource: payload.dataSource,
      sourceUrl: payload.sourceUrl,
    };
    // A SITUAÇÃO SÓ É GRAVADA QUANDO ALGUÉM A AFIRMOU.
    //
    // Se o DivulgaCandContas não respondeu para esta unidade eleitoral e o CSV
    // veio vazio (o normal em 2026), omitir os três campos preserva o que já
    // está no banco. A alternativa — gravar o fallback de "aguardando
    // julgamento" — transformaria uma indisponibilidade do TSE em situação
    // afirmada para quem já foi deferido, indeferido ou renunciou.
    //
    // Numa candidatura NOVA não há o que preservar: aí o fallback é a única
    // resposta honesta e é gravado (ver o ramo `if (!existing)`).
    if (payload.statusKnown || !existing) {
      writeData.tseStatusLabel = payload.tseStatusLabel;
      writeData.tseStatusDetail = payload.tseStatusDetail;

      // E O ENUM, SÓ QUANDO A REDAÇÃO FOI RECONHECIDA.
      //
      // `registrationStatus === null` significa que o TSE escreveu uma redação
      // que o TSE_STATUS_MAP não conhece. Aí grava-se a palavra literal do TSE
      // (que é o que o badge exibe) e preserva-se o enum guardado — que alguém
      // já conferiu — em vez de carimbar um fallback. Este é o mesmo contrato
      // do cron em `tse-status.server.ts`, agora idêntico dos dois lados.
      //
      // Numa linha NOVA não há enum a preservar e a coluna é obrigatória: aí o
      // fallback é gravado, e o aviso de `mapStatus` fica no log.
      if (payload.registrationStatus !== null) {
        writeData.registrationStatus = payload.registrationStatus;
      } else if (!existing) {
        writeData.registrationStatus = STATUS_UNDISCLOSED;
      }
    }
    if (payload.viceName !== null) writeData.viceName = payload.viceName;
    if (payload.viceParty !== null) writeData.viceParty = payload.viceParty;
    if (payload.photoUrl !== null) writeData.photoUrl = payload.photoUrl;

    // `governmentPlanUrl` é campo curado: o /admin pode ter apontado para um
    // espelho acessível quando o TSE estava fora do ar. O sync só PREENCHE o
    // vazio, nunca substitui — sobrescrever silenciosamente trocaria um link
    // que alguém conferiu por outro que ninguém abriu.
    if (payload.governmentPlanUrl !== null) {
      const curado = existing?.governmentPlanUrl as string | null | undefined;
      if (!curado) {
        writeData.governmentPlanUrl = payload.governmentPlanUrl;
      } else if (curado !== payload.governmentPlanUrl) {
        console.log(
          `      📄 plano já curado (${curado}) — mantido; o TSE traz ${payload.governmentPlanUrl}`
        );
      }
    }

    if (!existing) {
      let matchedKey = adoptionKey(
        payload.displayName,
        payload.party,
        payload.number,
        payload.uf
      );
      let orphan = orphansByKey.get(matchedKey);

      // Segundo nível. O nome de urna do TSE costuma trazer prefixo que a
      // apuração de imprensa não tinha: "ESCRITOR AUGUSTO CURY" para "Augusto
      // Cury", "ZEMA" para "Romeu Zema". Mesma disputa, mesmo partido, mesmo
      // número e um nome contido no outro é evidência suficiente — e é
      // conservador: exige UM único órfão candidato, senão desiste.
      //
      // A exigência de unicidade não é teórica. No Ceará, PEDRO BRITO e VERA
      // LÚCIA disputam ambos pelo NOVO com o número 30 (chapa substituída):
      // ali partido+número casa com dois, e adotar seria chutar.
      if (!orphan) {
        const compat = [...orphansByKey.entries()].filter(([key, cand]) => {
          const [nome, partido, numero, uf] = key.split("|");
          if (partido !== normalizeText(payload.party)) return false;
          if (numero !== String(payload.number ?? "?")) return false;
          if (uf !== (payload.uf ?? "")) return false;
          const alvo = normalizeText(payload.displayName);
          return nome.includes(alvo) || alvo.includes(nome);
        });

        if (compat.length === 1) {
          [matchedKey, orphan] = compat[0];
          console.log(
            `      ↔️  nome de urna divergente: "${orphan.label}" no banco, ` +
              `"${payload.displayName}" no TSE — mesma chapa (${payload.party}, ${payload.number})`
          );
        } else if (compat.length > 1) {
          warn(
            `${payload.displayName} (${payload.party}, ${payload.number}) casa com ` +
              `${compat.length} registros existentes por partido+número. Criada como nova ` +
              "para não adotar a errada — resolva à mão no /admin."
          );
        }
      }

      if (orphan) {
        // Adoção: a linha já existe, só não tinha identidade do TSE. Vira
        // update com tseId, e sai do mapa para não ser adotada duas vezes.
        orphansByKey.delete(matchedKey);
        adoptedIds.add(orphan.id);
        stats.adopted++;
        console.log(`   🔗 ${label} — adotada (registro do seed ganhou tseId ${payload.tseId})`);

        // A linha órfã veio do seed de imprensa e pode carregar curadoria —
        // um espelho de plano conferido à mão, por exemplo. Adotar não é
        // recomeçar: o que já foi curado sobrevive à adoção.
        const adoptData = { ...writeData, tseId: payload.tseId, lastSyncedAt: new Date() };
        if (orphan.governmentPlanUrl) {
          delete adoptData.governmentPlanUrl;
          if (payload.governmentPlanUrl) {
            console.log(
              `      📄 plano já curado (${orphan.governmentPlanUrl}) — mantido na adoção`
            );
          }
        }

        if (!options.dryRun) {
          await prisma.candidate.update({
            where: { id: orphan.id },
            data: adoptData,
          });
        }
        continue;
      }

      created.push(label);
      stats.created++;
      console.log(`   ➕ ${label}`);
      console.log(
        `      situação TSE: ${payload.tseStatusLabel ?? "—"} / ${payload.tseStatusDetail ?? "—"} → ` +
          (writeData.registrationStatus ?? "(enum preservado)")
      );
      if (payload.coalition) console.log(`      coligação: ${payload.coalition}`);
      if (payload.viceName) console.log(`      vice: ${payload.viceName} (${payload.viceParty})`);
      if (!options.dryRun) {
        await prisma.candidate.create({
          data: { ...writeData, tseId: payload.tseId, lastSyncedAt: new Date() },
        });
      }
      continue;
    }

    if (diffs.length === 0) {
      unchanged.push(label);
      stats.unchanged++;
      // NENHUM update do Prisma aqui — só o carimbo de `lastSyncedAt` em
      // bloco, depois do loop. Ver `touchLastSynced`.
      untouchedTseIds.push(payload.tseId);
      console.log(`   ✓ ${label} (sem mudanças)`);
    } else {
      updated.push({ label, diffs });
      stats.updated++;
      console.log(`   ✎ ${label}`);
      for (const diff of diffs) {
        console.log(`      ${diff.field}: ${formatValue(diff.before)} → ${formatValue(diff.after)}`);
      }

      if (!options.dryRun) {
        await prisma.candidate.update({
          where: { tseId: payload.tseId },
          data: { ...writeData, lastSyncedAt: new Date() },
        });
      }
    }
  }

  // As inalteradas: "conferido agora" sem "mudou agora". Uma escrita só para
  // as 211, e nenhuma delas passa pelo `@updatedAt`.
  if (!options.dryRun) {
    stats.touched = await touchLastSynced(prisma, untouchedTseIds);
  } else {
    stats.touched = untouchedTseIds.length;
  }

  // ---------- 4b. Gravação da ficha completa (bens, histórico, processo, aptidão) ----------
  //
  // As fichas JÁ FORAM LIDAS no passo 3b, antes do loop de escrita, para que a
  // situação gravada e a aptidão gravada saiam do mesmo instante. Aqui só se
  // grava — e para gravar é preciso o `Candidate.id`, que as candidaturas
  // criadas ou adotadas neste mesmo run só ganharam agora.
  if (!dbUnavailable) {
    const stored = await prisma.candidate.findMany({
      where: { tseId: { in: tseIds } },
      select: { id: true, tseId: true, displayName: true, party: true },
    });

    const detailTargets: DetailTarget[] = stored
      .filter(row => row.tseId !== null && sgUeByTseId.get(row.tseId) != null)
      .map(row => ({
        id: row.id,
        tseId: row.tseId as string,
        sgUe: sgUeByTseId.get(row.tseId as string) ?? null,
        label: `${row.displayName} (${row.party})`,
      }));

    if (detailTargets.length < titularRows.length) {
      console.log(
        `\n   ℹ️  ${titularRows.length - detailTargets.length} candidatura(s) do CSV ainda não ` +
          "estão no banco (esperado em --dry-run com candidaturas novas) — ficha não aplicada."
      );
    }

    const detailResult = await applyDivulgaDetails(prisma, detailTargets, detailsById, {
      dryRun: options.dryRun,
    });

    stats.aptoApt = detailResult.apto.apt;
    stats.aptoUnapt = detailResult.apto.unapt;
    stats.aptoUndecided = detailResult.apto.undecided;
    stats.assetsRead = detailResult.assetsRead;
    stats.assetsWritten = detailResult.assetsWritten;
    stats.assetsDeleted = detailResult.assetsDeleted;
    stats.assetsAbsent = detailResult.assetsAbsent;
    stats.historyRead = detailResult.historyRead;
    stats.historyCreated = detailResult.historyCreated;
    stats.historyUpdated = detailResult.historyUpdated;
    stats.candidatesUpdatedByDetail = detailResult.candidatesUpdated;

    console.log(
      `   ${detailResult.applied} ficha(s) aplicada(s) | ` +
        `${detailResult.assetsRead} bem(ns) declarado(s) ` +
        `(${detailResult.assetsWritten} gravado(s), ${detailResult.assetsDeleted} apagado(s)) | ` +
        `${detailResult.historyRead} linha(s) de histórico ` +
        `(${detailResult.historyCreated} nova(s), ${detailResult.historyUpdated} atualizada(s)) | ` +
        `aptidão: ${detailResult.apto.apt} apta(s), ${detailResult.apto.unapt} inapta(s), ` +
        `${detailResult.apto.undecided} ainda não julgada(s)`
    );

    // A operação mais destrutiva do sync: zerar a declaração de bens de alguém.
    // Pode ser legítima (o TSE aceita declaração sem bens), mas sem este aviso
    // um `bens: []` indevido saía do relatório indistinguível de um run calmo.
    if (detailResult.assetsCleared.length > 0) {
      warn(
        `${detailResult.assetsCleared.length} candidatura(s) tiveram a declaração de bens ` +
          "ZERADA: tinham linhas gravadas e a ficha do TSE agora declara lista vazia. " +
          "Confira na ficha oficial antes de aceitar:\n      • " +
          detailResult.assetsCleared
            .map(b => `${b.label}: ${b.removidos} bem(ns) removido(s)`)
            .join("\n      • ")
      );
    }

    if (detailResult.assetsAbsent > 0) {
      warn(
        `${detailResult.assetsAbsent} ficha(s) responderam SEM a chave "bens". ` +
          "O patrimônio dessas candidaturas NÃO foi tocado — ausência do campo não " +
          "é declaração de zero bens."
      );
    }

    if (detailResult.assetsSkippedNoDate.length > 0) {
      warn(
        `${detailResult.assetsSkippedNoDate.length} bem(ns) sem data de declaração ` +
          "no TSE — não gravados, porque carimbar a data de hoje inventaria " +
          "quando o patrimônio foi declarado:\n      • " +
          detailResult.assetsSkippedNoDate
            .slice(0, 10)
            .map(b => `${b.label}: ${b.descricao}`)
            .join("\n      • ")
      );
    }

    // Processos de cassação/desconstituição não têm modelo no schema porque
    // vieram vazios nas 13 presidenciais em 27/08/2026. Se aparecer um, uma
    // pessoa precisa ver — não pode ser descartado em silêncio.
    if (detailResult.withProceedings.length > 0) {
      warn(
        `${detailResult.withProceedings.length} candidatura(s) com processo de cassação ou ` +
          "desconstituição na ficha do TSE. Esses processos NÃO são modelados no " +
          "banco — confira à mão na ficha oficial:\n      • " +
          detailResult.withProceedings
            .map(
              p =>
                `${p.label}: ${p.cassacao} cassação, ${p.desconstituicao} desconstituição`
            )
            .join("\n      • ")
      );
    }
  } else {
    warn(
      "Banco indisponível: a ficha completa foi LIDA no TSE, mas não pôde ser " +
        "gravada (bens, histórico, processo e aptidão ficam como estão)."
    );
  }

  // ---------- 5. Sumiços e duplicatas (nunca destrutivo) ----------
  if (dbUnavailable) {
    console.log("");
    warn("Banco indisponível: checagem de candidaturas sumidas e duplicadas não foi feita.");
    printSummary(stats, options);
    return;
  }

  const csvIds = new Set(tseIds);
  const allTseCandidates = await prisma.candidate.findMany({
    where: { electionType: { in: ["presidential", "governor"] }, NOT: { tseId: null } },
    select: { tseId: true, displayName: true, party: true, registrationStatus: true },
  });

  const vanished = allTseCandidates.filter(c => c.tseId && !csvIds.has(c.tseId));
  if (vanished.length > 0) {
    console.log("");
    warn(
      `${vanished.length} candidatura(s) no banco NÃO aparecem no CSV do TSE. ` +
        "Nada foi apagado — decida manualmente (pode ser renúncia, indeferimento " +
        "final, ou simplesmente um arquivo parcial):"
    );
    for (const candidate of vanished) {
      console.warn(
        `      • ${candidate.displayName} (${candidate.party}) — tseId=${candidate.tseId}, status atual=${candidate.registrationStatus}`
      );
    }
  }

  // Candidatos do seed antigo (sem tseId) que batem por nome com alguém do
  // CSV viram duplicata visível na listagem. Só reporta.
  const orphanCandidates = await prisma.candidate.findMany({
    where: { electionType: { in: ["presidential", "governor"] }, tseId: null },
    select: { id: true, displayName: true, name: true, party: true, dataSource: true },
  });

  if (orphanCandidates.length > 0) {
    const csvNames = new Map<string, string>();
    for (const row of titularRows) {
      csvNames.set(normalizeText(row.nomeUrna ?? row.nome), row.tseId);
      csvNames.set(normalizeText(row.nome), row.tseId);
    }

    const collisions = orphanCandidates.filter(
      c =>
        // Adotadas nesta execução não são duplicata: elas VÃO receber o tseId.
        // Em --dry-run ainda aparecem sem tseId no banco, e sem este filtro o
        // script mandaria mesclar à mão algo que ele próprio já resolve.
        !adoptedIds.has(c.id) &&
        (csvNames.has(normalizeText(c.displayName)) ||
          csvNames.has(normalizeText(c.name)))
    );

    if (collisions.length > 0) {
      console.log("");
      warn(
        `${collisions.length} candidatura(s) sem tseId parecem duplicar registros do TSE ` +
          "(provável resquício do seed manual). Nada foi apagado — mescle ou remova à mão:"
      );
      for (const candidate of collisions) {
        console.warn(
          `      • ${candidate.displayName} (${candidate.party}) — id=${candidate.id}, dataSource=${candidate.dataSource}`
        );
      }
    }
  }

  printSummary(stats, options);
}

function printSummary(stats: SyncStats, options: Options) {
  const rows: Array<[string, string]> = [
    ["Linhas lidas no CSV", String(stats.totalRows)],
    ["Presidenciais (cargo 1, BR, 1º turno)", String(stats.presidentialRows)],
    ["Governadores (cargo 3, por UF, 1º turno)", String(stats.governorRows)],
    ["Vices identificados", String(stats.viceRows)],
    ["Criados", String(stats.created)],
    ["Adotados (linha do seed ganhou tseId)", String(stats.adopted)],
    ["Propostas de governo extraídas", String(stats.plansWritten)],
    [
      "Situação lida do DivulgaCandContas",
      stats.divulgaFailedUnits === 0
        ? String(stats.statusFromDivulga)
        : `${stats.statusFromDivulga} (${stats.divulgaFailedUnits} unidade(s) sem resposta)`,
    ],
    [
      "Sem situação em nenhuma fonte",
      `${statusUndisclosedCount} → aguardando julgamento`,
    ],
    [
      "Fichas completas lidas",
      stats.detailsFailed === 0
        ? String(stats.detailsRead)
        : `${stats.detailsRead} (${stats.detailsFailed} sem resposta)`,
    ],
    [
      "Bens declarados (gravados / apagados)",
      `${stats.assetsRead} (${stats.assetsWritten} / ${stats.assetsDeleted})` +
        (stats.assetsAbsent > 0 ? ` — ${stats.assetsAbsent} ficha(s) sem a chave` : ""),
    ],
    [
      "Histórico eleitoral (novas / atualizadas)",
      `${stats.historyRead} (${stats.historyCreated} / ${stats.historyUpdated})`,
    ],
    [
      "Aptidão (apta / inapta / não julgada)",
      `${stats.aptoApt} / ${stats.aptoUnapt} / ${stats.aptoUndecided}`,
    ],
    ["Aptidão ou nº de processo alterados", String(stats.candidatesUpdatedByDetail)],
    ["Situação divergente (listagem × ficha)", String(stats.statusDivergences)],
    ["Atualizados", String(stats.updated)],
    ["Inalterados (só lastSyncedAt)", `${stats.unchanged} (${stats.touched})`],
  ];

  if (options.photos) rows.push(["Fotos gravadas", String(stats.photosWritten)]);
  rows.push(["Avisos", String(warningCount)]);

  const labelWidth = Math.max(...rows.map(([label]) => label.length));
  const valueWidth = Math.max(...rows.map(([, value]) => value.length), 5);
  const line = `┌─${"─".repeat(labelWidth)}─┬─${"─".repeat(valueWidth)}─┐`;
  const divider = `├─${"─".repeat(labelWidth)}─┼─${"─".repeat(valueWidth)}─┤`;
  const bottom = `└─${"─".repeat(labelWidth)}─┴─${"─".repeat(valueWidth)}─┘`;

  console.log("\n📋 Resumo da sincronização");
  console.log(line);
  rows.forEach(([label, value], i) => {
    if (i === rows.length - 1) console.log(divider);
    console.log(`│ ${label.padEnd(labelWidth)} │ ${value.padStart(valueWidth)} │`);
  });
  console.log(bottom);

  if (options.dryRun) {
    console.log("\n🧪 --dry-run: nenhuma escrita foi feita (banco e public/candidatos intactos).");
  } else {
    console.log("\n✅ Sincronização concluída.");
  }

  if (warningCount > 0) {
    console.log(`\n⚠️  ${warningCount} aviso(s) acima exigem conferência humana.`);
  }

  if (dbUnavailable) {
    console.log(
      "\n❌ O diff acima NÃO foi comparado com o banco (leitura falhou). Saindo com código 1."
    );
  }

  if (statusOutage) {
    console.log(
      `\n❌ ${stats.divulgaFailedUnits} de ${DIVULGA_UNITS} unidades do DivulgaCandContas ` +
        "não responderam: a situação das candidaturas NÃO foi conferida nesta execução. " +
        "Nada foi sobrescrito. Saindo com código 1 para que a falha apareça no Actions."
    );
  }
}

// ============================================================
// Entrypoint
// ============================================================

async function main() {
  let options: Options;

  try {
    options = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`❌ ${(err as Error).message}`);
    process.exit(1);
  }

  if (options.help) {
    printHelp();
    return;
  }

  try {
    console.time("Tempo total");
    await syncTse(options);
    console.timeEnd("Tempo total");
    if (dbUnavailable || statusOutage) {
      await prismaClient?.$disconnect();
      process.exit(1);
    }
  } catch (err) {
    if (err instanceof TseDownloadError) {
      // Erro esperado e acionável: mostra a explicação, não o stack trace.
      console.error(explainDownloadFailure(err));
    } else {
      // Mensagem inteira, não só a primeira linha: os erros de layout deste
      // script trazem o cabeçalho lido, a contagem por cargo etc. — é o que
      // permite ao operador entender o que veio errado no arquivo.
      console.error(
        "\n❌ Falha na sincronização do TSE:",
        err instanceof Error ? err.message : String(err)
      );
      if (process.env.DEBUG === "1" && err instanceof Error) console.error(err.stack);
      else console.error("   (rode com DEBUG=1 para ver o stack trace completo)");
    }
    process.exit(1);
  } finally {
    if (prismaClient) await prismaClient.$disconnect();
  }
}

main();
