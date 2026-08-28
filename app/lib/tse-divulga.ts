/**
 * DivulgaCandContas — leitura da candidatura: situação, URL da ficha e a
 * ficha completa (bens declarados, eleições anteriores, processo, aptidão).
 *
 * POR QUE ESTE MÓDULO EXISTE
 *
 * O pacote de dados abertos do TSE NÃO publica a situação da candidatura em
 * 2026: `DS_SITUACAO_CANDIDATURA` vem `#NE` nas 41.500 linhas dos 29 CSVs e
 * `DS_DETALHE_SITUACAO_CAND` nem existe no layout (varredura do pacote
 * inteiro em 26/08/2026). Não é atraso — é ausência. Sem esta fonte, o site
 * afirmaria "aguardando julgamento" para pessoas cuja candidatura a Justiça
 * Eleitoral já deferiu, indeferiu ou que renunciaram.
 *
 * Dois consumidores dependem disto, e é por isso que mora aqui e não dentro
 * do script:
 *   - `scripts/sync-tse-2026.ts` — o sync completo;
 *   - `/api/cron/tse-status`     — o cron horário, que só reconfere a situação.
 *
 * Este módulo é PURO de propósito: só constantes e HTTP, sem Prisma. O script
 * abre o próprio cliente de banco, e importar `db.server` aqui abriria um
 * segundo — que em dev conecta no load e deixaria o processo pendurado.
 * A escrita mora em `app/services/tse-status.server.ts`.
 *
 * NENHUMA IA ENVOLVIDA. São chamadas HTTP ao TSE e escrita no banco. O
 * `vote-classifier.server.ts` (OpenAI) pertence ao pipeline de votações e não
 * é tocado por aqui — este caminho não consome créditos de modelo.
 */

/**
 * VERIFICADO em 26/08/2026 navegando o site (versão 2.8.17).
 *
 * Não é o `CD_ELEICAO` do CSV (6257/6259): o DivulgaCandContas usa um código
 * único que cobre presidente E governador. Cravar o do CSV faz toda ficha
 * abrir em "ERRO AO CARREGAR A PÁGINA".
 */
export const DIVULGA_ELECTION_CODE = "20322002026";

export const ELECTION_YEAR = "2026";

/** Códigos de cargo do TSE. */
export const CARGO_PRESIDENTE = "1";
export const CARGO_GOVERNADOR = "3";

/**
 * Região de cada unidade eleitoral, como o DivulgaCandContas a escreve na
 * rota. Os slugs saem do próprio site (sem acento, sem espaço: "Centro Oeste"
 * vira `CENTROOESTE`), não de uma convenção nossa.
 */
export const UE_REGION: Record<string, string> = {
  BR: "BR",
  AC: "NORTE", AP: "NORTE", AM: "NORTE", PA: "NORTE",
  RO: "NORTE", RR: "NORTE", TO: "NORTE",
  AL: "NORDESTE", BA: "NORDESTE", CE: "NORDESTE", MA: "NORDESTE",
  PB: "NORDESTE", PE: "NORDESTE", PI: "NORDESTE", RN: "NORDESTE",
  SE: "NORDESTE",
  DF: "CENTROOESTE", GO: "CENTROOESTE", MT: "CENTROOESTE", MS: "CENTROOESTE",
  ES: "SUDESTE", MG: "SUDESTE", RJ: "SUDESTE", SP: "SUDESTE",
  PR: "SUL", RS: "SUL", SC: "SUL",
};

/**
 * URL da ficha no DivulgaCandContas.
 *
 * Formato conferido carregando uma ficha real de cada uma das seis regiões:
 *   #/candidato/{REGIÃO}/{SG_UE}/{CÓDIGO}/{SQ_CANDIDATO}/{ANO}/{SG_UE}
 *
 * `null` quando não dá para montar link honesto — a interface mostra
 * ausência, que é melhor que uma URL que abre em erro.
 */
export function divulgaUrl(sgUe: string | null, tseId: string): string | null {
  if (!sgUe) return null;
  const ue = sgUe.toUpperCase();
  const region = UE_REGION[ue];
  if (!region) return null;
  return (
    "https://divulgacandcontas.tse.jus.br/divulga/#/candidato/" +
    `${region}/${ue}/${DIVULGA_ELECTION_CODE}/${tseId}/${ELECTION_YEAR}/${ue}`
  );
}

const LIST_BASE =
  "https://divulgacandcontas.tse.jus.br/divulga/rest/v1/candidatura/listar";
/**
 * Ficha completa de UMA candidatura. A listagem acima só devolve identidade e
 * `descricaoSituacao`; bens declarados, eleições anteriores, número do
 * processo e a aptidão só existem aqui.
 */
const DETAIL_BASE =
  "https://divulgacandcontas.tse.jus.br/divulga/rest/v1/candidatura/buscar";
const TIMEOUT_MS = 20000;
const RETRIES = 2;
const BACKOFF_MS = 2000;

/** Cortesia: identifica quem está chamando, e o CDN do TSE recusa quem não manda UA. */
const USER_AGENT = "Mozilla/5.0 (compatible; em-quem-votar-sync/1.0; +sync-tse-2026)";

interface DivulgaCandidate {
  id?: unknown;
  descricaoSituacao?: unknown;
}

export interface DivulgaStatuses {
  /** SQ_CANDIDATO → redação literal do TSE ("Deferido", "Renúncia", …). */
  byTseId: Map<string, string>;
  /** Unidades eleitorais sem resposta. Ver a guarda em quem escreve. */
  failedUnits: Array<{ unit: string; error: string }>;
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Corpo vazio com HTTP 200: a resposta do TSE a uma URL mal montada.
 *
 * Classe própria porque este erro NÃO é retentável — ver `fetchJson`.
 */
class EmptyBodyError extends Error {}

/**
 * GET + JSON, com retry e timeout.
 *
 * Corpo vazio é ERRO, não "sem dados". VERIFICADO em 27/08/2026: pedir a ficha
 * de um governador de GO com a unidade eleitoral errada (`/BR/` em vez de
 * `/GO/`) devolve **HTTP 200 com zero byte**. Tratar isso como resposta válida
 * faria o sync concluir "esta pessoa não declarou bens" a partir de uma URL
 * mal montada — exatamente o tipo de afirmação que este projeto não faz.
 *
 * E ele não é retentado, porque a causa é a URL, não a rede: a mesma URL
 * devolve o mesmo nada nas três tentativas. Retentar custava 2 requisições e
 * 6s de backoff extras POR FICHA — numa eleição em que a etapa faz 211 —, e
 * ainda atrasava o aviso que aponta o defeito real.
 */
async function fetchJson<T>(url: string): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": USER_AGENT },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status} em ${url}`);
      const text = await response.text();
      if (text.trim().length === 0) throw new EmptyBodyError(`Corpo vazio em ${url}`);
      return JSON.parse(text) as T;
    } catch (err) {
      lastError = err;
      if (err instanceof EmptyBodyError) break;
      if (attempt === RETRIES) break;
      await sleep(BACKOFF_MS * Math.pow(2, attempt));
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError;
}

async function fetchUnit(ue: string, cargo: string): Promise<DivulgaCandidate[]> {
  const url = `${LIST_BASE}/${ELECTION_YEAR}/${ue}/${DIVULGA_ELECTION_CODE}/${cargo}/candidatos`;
  const body = await fetchJson<{ candidatos?: unknown }>(url);
  return Array.isArray(body.candidatos) ? (body.candidatos as DivulgaCandidate[]) : [];
}

/**
 * 28 requisições, não 211: o endpoint de LISTA já traz `descricaoSituacao` de
 * cada candidatura, então basta uma chamada por unidade eleitoral
 * (BR/presidente + 27 UFs/governador).
 *
 * Uma unidade que falha NÃO derruba a leitura das outras — ela só não
 * contribui, e sai em `failedUnits` para quem escreve saber que ali não há
 * informação nova (e portanto nada a sobrescrever).
 */
export async function fetchDivulgaStatuses(): Promise<DivulgaStatuses> {
  const units: Array<[string, string]> = [
    ["BR", CARGO_PRESIDENTE],
    ...Object.keys(UE_REGION)
      .filter(ue => ue !== "BR")
      .map(uf => [uf, CARGO_GOVERNADOR] as [string, string]),
  ];

  const byTseId = new Map<string, string>();
  const failedUnits: DivulgaStatuses["failedUnits"] = [];

  for (const [ue, cargo] of units) {
    try {
      for (const cand of await fetchUnit(ue, cargo)) {
        const id = cand.id === null || cand.id === undefined ? null : String(cand.id);
        const situacao =
          typeof cand.descricaoSituacao === "string" ? cand.descricaoSituacao.trim() : "";
        if (id && situacao) byTseId.set(id, situacao);
      }
    } catch (err) {
      failedUnits.push({
        unit: ue,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { byTseId, failedUnits };
}

// ============================================================
// Ficha completa da candidatura (endpoint /buscar)
// ============================================================

/**
 * URL REST da ficha completa. Difere de `divulgaUrl()`, que é a página para
 * humanos: esta devolve JSON e é o que o sync consome.
 *
 * A unidade eleitoral tem de ser a da disputa — `BR` para presidente, a UF
 * para governador. Errar a UE devolve 200 com corpo vazio (ver `fetchJson`).
 */
export function divulgaDetailUrl(sgUe: string, tseId: string): string {
  return (
    `${DETAIL_BASE}/${ELECTION_YEAR}/${sgUe.toUpperCase()}/` +
    `${DIVULGA_ELECTION_CODE}/candidato/${tseId}`
  );
}

/** Um bem declarado, como o próprio candidato o escreveu na declaração. */
export interface DivulgaAsset {
  /** Ordem do item na declaração entregue ao TSE. */
  ordem: number | null;
  /** Literal: "50% DO APARTAMENTO LOCALIZADO EM SÃO BERNARDO DO CAMPO". */
  descricao: string;
  /** Tipo do bem na taxonomia do TSE: "Apartamento", "Terreno", … */
  tipo: string | null;
  valor: number;
  /** `YYYY-MM-DD` — data da última atualização declarada para o item. */
  atualizadoEm: string | null;
}

/** Uma candidatura anterior da mesma pessoa, conforme o TSE. */
export interface DivulgaPriorElection {
  /** SQ_CANDIDATO daquela candidatura — chave de idempotência. */
  tsePriorId: string;
  year: number;
  /** Redação do TSE: "Presidente", "Deputado Estadual", "Vice-prefeito"… */
  office: string;
  /** Nem sempre é UF: cargo municipal traz o código do município ("71072"). */
  ue: string | null;
  party: string | null;
  /** Literal do TSE: "Eleito", "Não eleito", "Eleito por QP", "Concorrendo". */
  resultLabel: string;
  sourceUrl: string | null;
}

export interface DivulgaDetail {
  tseId: string;
  /** Redação literal da situação, a mesma que a listagem devolve. */
  situacao: string | null;
  /**
   * Cru, como o TSE mandou. NÃO é booleano de aptidão — ver
   * `aptoFromDivulga()` em `~/lib/candidate-status`, que é quem sabe ler os
   * três estados. Guardado aqui sem interpretação de propósito.
   */
  candidatoApto: boolean | null;
  /** Idem: cru. `false` NÃO significa "apto". */
  isCandidatoInapto: boolean | null;
  /** Número do processo de registro (RCand). */
  numeroProcesso: string | null;
  /** Total declarado pelo próprio TSE — não é a soma que calculamos. */
  totalDeBens: number | null;
  /** `YYYY-MM-DD` da última atualização do registro da candidatura. */
  atualizadoEm: string | null;
  /**
   * `null` NÃO é "declarou zero bens" — é "a ficha não trouxe a chave `bens`".
   * A distinção é o que separa uma declaração vazia legítima de uma resposta
   * incompleta do TSE, e quem escreve trata as duas de forma oposta: `[]`
   * grava zero bens, `null` não toca em nada. Ver `parseDivulgaDetail`.
   */
  bens: DivulgaAsset[] | null;
  /** Só as ANTERIORES: a candidatura atual é removida — ver o parser. */
  eleicoesAnteriores: DivulgaPriorElection[];
  /** Contagens só para relatório. Vazias nas 13 presidenciais em 27/08/2026. */
  processosCassacao: number;
  processosDesconstituicao: number;
}

export interface DivulgaDetails {
  byTseId: Map<string, DivulgaDetail>;
  /**
   * Candidaturas cuja ficha não respondeu. Quem escreve OMITE os campos delas
   * — o valor guardado sobrevive. Uma indisponibilidade do TSE não pode virar
   * afirmação sobre o patrimônio ou a aptidão de uma pessoa real.
   */
  failed: Array<{ tseId: string; error: string }>;
}

function asString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function asCount(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

/**
 * `null` quando a ficha não trouxe a chave `bens` (ou trouxe algo que não é
 * lista). Ver a nota "AUSENTE ≠ VAZIO" em `parseDivulgaDetail`.
 */
function parseAssets(raw: unknown): DivulgaAsset[] | null {
  if (!Array.isArray(raw)) return null;
  return raw
    .map(item => {
      const bem = (item ?? {}) as Record<string, unknown>;
      const descricao = asString(bem.descricao);
      const valor = asNumber(bem.valor);
      if (descricao === null || valor === null) return null;
      return {
        ordem: asNumber(bem.ordem),
        descricao,
        tipo: asString(bem.descricaoDeTipoDeBem),
        valor,
        atualizadoEm: asString(bem.dataUltimaAtualizacao),
      } satisfies DivulgaAsset;
    })
    .filter((bem): bem is DivulgaAsset => bem !== null);
}

/**
 * Traduz a ficha crua para o nosso formato, SEM interpretar nada: os dois
 * campos de aptidão saem como vieram e a descrição do bem e a situação da
 * eleição anterior são copiadas literalmente.
 *
 * Uma decisão de leitura, e só uma: `eleicoesAnteriores` inclui a PRÓPRIA
 * candidatura de 2026 (mesmo `id`, `situacaoTotalizacao: "Concorrendo"`) —
 * verificado nas 13 presidenciais em 27/08/2026. Guardá-la faria a página
 * listar "2026 · Presidente · Concorrendo" no histórico de quem está
 * disputando 2026 agora. É a mesma linha, não um antecedente.
 *
 * AUSENTE ≠ VAZIO, nos bens. Uma ficha SEM a chave `bens` vira `null`, e quem
 * escreve não mexe no patrimônio guardado; uma ficha com `bens: []` vira `[]`,
 * e aí sim significa "declarou zero bens". Colapsar os dois em `[]` — como
 * este parser fazia — armava um `deleteMany`: uma resposta incompleta do TSE
 * apagaria a declaração de bens de uma pessoa real. E não dá para distinguir
 * depois: em 27/08/2026, 38 das 211 fichas declaram `bens: []` de verdade.
 * É a mesma regra que o CLAUDE.md já exige para a situação — falha de API
 * nunca reescreve dado —, agora valendo para o patrimônio.
 */
export function parseDivulgaDetail(tseId: string, raw: unknown): DivulgaDetail {
  const body = (raw ?? {}) as Record<string, unknown>;

  const bens = parseAssets(body.bens);

  const eleicoesAnteriores: DivulgaPriorElection[] = (
    Array.isArray(body.eleicoesAnteriores) ? body.eleicoesAnteriores : []
  )
    .map(item => {
      const eleicao = (item ?? {}) as Record<string, unknown>;
      const tsePriorId = asString(eleicao.id);
      const year = asNumber(eleicao.nrAno);
      const office = asString(eleicao.cargo);
      const resultLabel = asString(eleicao.situacaoTotalizacao);
      // Sem id, ano, cargo ou resultado não há linha honesta a montar.
      if (!tsePriorId || year === null || !office || !resultLabel) return null;
      if (tsePriorId === tseId) return null; // a candidatura atual, não um antecedente
      return {
        tsePriorId,
        year: Math.trunc(year),
        office,
        ue: asString(eleicao.sgUe),
        party: asString(eleicao.partido),
        resultLabel,
        sourceUrl: asString(eleicao.txLink),
      } satisfies DivulgaPriorElection;
    })
    .filter((eleicao): eleicao is DivulgaPriorElection => eleicao !== null);

  return {
    tseId,
    situacao: asString(body.descricaoSituacao),
    candidatoApto: asBoolean(body.candidatoApto),
    isCandidatoInapto: asBoolean(body.isCandidatoInapto),
    numeroProcesso: asString(body.numeroProcesso),
    totalDeBens: asNumber(body.totalDeBens),
    atualizadoEm: asString(body.dataUltimaAtualizacao),
    bens,
    eleicoesAnteriores,
    processosCassacao: asCount(body.processosCassacao),
    processosDesconstituicao: asCount(body.processosDesconstituicao),
  };
}

export async function fetchDivulgaDetail(
  sgUe: string,
  tseId: string,
): Promise<DivulgaDetail> {
  return parseDivulgaDetail(tseId, await fetchJson<unknown>(divulgaDetailUrl(sgUe, tseId)));
}

/**
 * Uma requisição POR CANDIDATURA — 211 na eleição de 2026. Diferente da
 * situação, que a listagem entrega em 28 chamadas, a ficha completa não tem
 * endpoint em lote: bens e eleições anteriores só existem em `/buscar`.
 *
 * Daí o pool: em série seriam ~3 minutos só nesta etapa. Seis em paralelo é
 * educado com o TSE (o navegador do próprio DivulgaCandContas abre mais) e
 * derruba a etapa para dezenas de segundos.
 *
 * Uma candidatura que falha NÃO derruba as outras: sai em `failed`, e quem
 * escreve simplesmente não toca nos campos dela.
 */
export async function fetchDivulgaDetails(
  targets: Array<{ tseId: string; sgUe: string }>,
  options: {
    concurrency?: number;
    onProgress?: (done: number, total: number) => void;
  } = {},
): Promise<DivulgaDetails> {
  const concurrency = Math.max(1, options.concurrency ?? 6);
  const byTseId = new Map<string, DivulgaDetail>();
  const failed: DivulgaDetails["failed"] = [];

  let next = 0;
  let done = 0;

  async function worker() {
    while (next < targets.length) {
      const target = targets[next++];
      try {
        byTseId.set(target.tseId, await fetchDivulgaDetail(target.sgUe, target.tseId));
      } catch (err) {
        failed.push({
          tseId: target.tseId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
      options.onProgress?.(++done, targets.length);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, targets.length) }, () => worker()),
  );

  return { byTseId, failed };
}
