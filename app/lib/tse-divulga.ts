/**
 * DivulgaCandContas — leitura da situação da candidatura e URL da ficha.
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

async function fetchUnit(ue: string, cargo: string): Promise<DivulgaCandidate[]> {
  const url = `${LIST_BASE}/${ELECTION_YEAR}/${ue}/${DIVULGA_ELECTION_CODE}/${cargo}/candidatos`;
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
      const body = (await response.json()) as { candidatos?: unknown };
      return Array.isArray(body.candidatos) ? (body.candidatos as DivulgaCandidate[]) : [];
    } catch (err) {
      lastError = err;
      if (attempt === RETRIES) break;
      await sleep(BACKOFF_MS * Math.pow(2, attempt));
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError;
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
