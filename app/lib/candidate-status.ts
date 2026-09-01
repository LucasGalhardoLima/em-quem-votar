/**
 * Situação de registro conforme o TSE.
 *
 * Princípio editorial: a plataforma NUNCA reescreve nem interpreta a
 * situação de uma candidatura. O badge exibe o texto do próprio TSE
 * (`tseStatusLabel`) quando ele existe; o enum serve só para filtro e
 * ordenação. A explicação de cada situação também usa a definição da
 * Justiça Eleitoral, sem adjetivos.
 */

export const REGISTRATION_STATUSES = [
  "PRE_CANDIDATE",
  "REGISTERED",
  "PENDING_JUDGMENT",
  "SUB_JUDICE",
  "APPROVED",
  "REJECTED",
  "WITHDRAWN",
  "CANCELLED",
] as const;

export type RegistrationStatus = (typeof REGISTRATION_STATUSES)[number];

interface StatusPresentation {
  /** Rótulo curto usado no badge quando o TSE não forneceu texto próprio. */
  label: string;
  /** Definição neutra, exibida em tooltip e na legenda da listagem. */
  description: string;
  /** Situações que merecem destaque visual (âmbar), por não serem definitivas. */
  tone: "neutral" | "attention";
}

export const STATUS_PRESENTATION: Record<RegistrationStatus, StatusPresentation> = {
  PRE_CANDIDATE: {
    label: "Pré-candidatura",
    description:
      "Nome anunciado publicamente, sem pedido de registro protocolado no TSE.",
    tone: "neutral",
  },
  REGISTERED: {
    label: "Registro protocolado",
    description:
      "Pedido de registro entregue ao TSE dentro do prazo, ainda sem decisão.",
    tone: "neutral",
  },
  PENDING_JUDGMENT: {
    label: "Aguardando julgamento",
    description:
      "Pedido de registro protocolado, com julgamento ainda pendente no TSE.",
    tone: "neutral",
  },
  SUB_JUDICE: {
    label: "Sub judice",
    description:
      "Registro protocolado com decisão pendente de julgamento definitivo. A candidatura segue na disputa enquanto houver recurso, e os votos são contabilizados até decisão final.",
    tone: "attention",
  },
  APPROVED: {
    label: "Deferido",
    description: "Registro de candidatura aprovado pelo TSE.",
    tone: "neutral",
  },
  REJECTED: {
    label: "Indeferido",
    description:
      "Registro de candidatura negado pelo TSE. Cabe recurso enquanto a decisão não transitar em julgado.",
    tone: "attention",
  },
  WITHDRAWN: {
    label: "Renúncia",
    description: "Candidatura retirada pelo próprio candidato ou pelo partido.",
    tone: "neutral",
  },
  CANCELLED: {
    label: "Cassado",
    description: "Registro cassado por decisão da Justiça Eleitoral.",
    tone: "attention",
  },
};

/**
 * Redação literal do TSE → enum interno.
 *
 * Mora aqui, e não no script de sync, porque duas rotinas dependem dela: o
 * `npm run sync:tse` e o cron horário de situação (`/api/cron/tse-status`).
 * Duplicar o mapa faria uma delas envelhecer sozinha na primeira redação
 * nova que o TSE inventasse.
 *
 * O enum existe para filtro e ordenação. O que o usuário LÊ continua sendo a
 * redação do TSE via `statusLabel()` — mapear nunca é reescrever.
 */
const TSE_STATUS_MAP: Record<string, RegistrationStatus> = {
  // --- Redações confirmadas do TSE ---
  DEFERIDO: "APPROVED",
  "DEFERIDO COM RECURSO": "SUB_JUDICE",
  INDEFERIDO: "REJECTED",
  "INDEFERIDO COM RECURSO": "SUB_JUDICE",
  "AGUARDANDO JULGAMENTO": "PENDING_JUDGMENT",
  "SUB JUDICE": "SUB_JUDICE",
  RENUNCIA: "WITHDRAWN", // "RENÚNCIA" chega aqui já sem acento
  CASSADO: "CANCELLED",
  FALECIDO: "CANCELLED",

  // --- Variantes defensivas (vistas em ciclos anteriores / campos vizinhos) ---
  "PENDENTE DE JULGAMENTO": "PENDING_JUDGMENT",
  CANCELADO: "CANCELLED",
  "CANCELADO COM RECURSO": "SUB_JUDICE",
  "RENUNCIA/FALECIMENTO/CASSACAO": "WITHDRAWN",
  "INDEFERIDO COM RECURSO NO STF": "SUB_JUDICE",
  // Vista no DivulgaCandContas em 26/08/2026 (1 candidatura). Ainda cabe
  // recurso, então é sub judice — não "indeferido" definitivo.
  "INDEFERIDO EM PRAZO RECURSAL OU COM RECURSO": "SUB_JUDICE",
};

/** Caixa alta, sem acento, sem pontuação final: "Deferido." → "DEFERIDO". */
function normalizeTseLabel(value: string): string {
  return value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .toUpperCase()
    .replace(/[.;]+$/, "");
}

/**
 * `null` quando o TSE não disse nada OU escreveu algo desconhecido. Quem
 * chama decide o que fazer com isso — e a decisão certa nunca é inventar uma
 * situação: ver `tseStatusWrite()` logo abaixo.
 */
export function statusFromTseLabel(
  value: string | null | undefined,
): RegistrationStatus | null {
  if (!value) return null;
  return TSE_STATUS_MAP[normalizeTseLabel(value)] ?? null;
}

/**
 * O QUE GRAVAR da situação. Política de escrita, num lugar só.
 *
 * Existe porque `statusFromTseLabel()` devolve `null` para dois casos que NÃO
 * podem ser tratados igual, e tratá-los igual é exatamente o defeito que este
 * módulo passou a impedir:
 *
 *   `absent`   — nenhuma fonte disse nada. Não grave situação nenhuma; o que
 *                está no banco sobrevive.
 *   `mapped`   — redação conhecida. Grave a redação E o enum.
 *   `unmapped` — o TSE escreveu algo que o `TSE_STATUS_MAP` não conhece.
 *                Grave a REDAÇÃO (é a palavra honesta da Justiça Eleitoral) e
 *                NÃO grave o enum.
 *
 * O caso `unmapped` é o caro. Gravar um enum de palpite ali produz duas
 * mentiras encadeadas: a candidatura passa a afirmar uma situação jurídica que
 * ninguém proferiu, e — pior — o palpite fica PRESO, porque no run seguinte o
 * diff não vê diferença nenhuma e o cron pula por rótulo igual. Preservar o
 * enum guardado não é ideal (ele envelhece), mas é um valor que alguém já
 * conferiu, e o aviso volta a cada execução até que a redação nova entre no
 * `TSE_STATUS_MAP` acima.
 *
 * Dois consumidores, e é por isso que mora aqui e não dentro de nenhum deles:
 * `scripts/sync-tse-2026.ts` e `app/services/tse-status.server.ts`.
 */
export type TseStatusWrite =
  | { kind: "absent" }
  | { kind: "mapped"; label: string; status: RegistrationStatus }
  | { kind: "unmapped"; label: string };

export function tseStatusWrite(value: string | null | undefined): TseStatusWrite {
  const label = value?.trim();
  if (!label) return { kind: "absent" };
  const status = statusFromTseLabel(label);
  return status ? { kind: "mapped", label, status } : { kind: "unmapped", label };
}

/** Classes do badge. Sem cor partidária — só neutro ou âmbar de atenção. */
export const STATUS_BADGE_CLASS: Record<StatusPresentation["tone"], string> = {
  neutral: "border-slate-200 bg-white text-slate-500",
  attention: "border-amber-200/80 bg-amber-50 text-amber-800",
};

export function statusLabel(
  status: RegistrationStatus,
  tseStatusLabel?: string | null,
): string {
  const raw = tseStatusLabel?.trim();
  return raw && raw.length > 0 ? raw : STATUS_PRESENTATION[status].label;
}

export function statusTone(status: RegistrationStatus): StatusPresentation["tone"] {
  return STATUS_PRESENTATION[status].tone;
}

export function statusDescription(status: RegistrationStatus): string {
  return STATUS_PRESENTATION[status].description;
}

/**
 * Situações em que a candidatura ainda está na disputa: registro protocolado
 * e sem desfecho contrário. `SUB_JUDICE` entra porque a candidatura segue na
 * urna enquanto houver recurso, e os votos são contabilizados até a decisão
 * final; `PRE_CANDIDATE` fica fora porque nem registro houve.
 *
 * SEM CONSUMIDOR EM `app/` HOJE — só o teste. Não é sobra esquecida, e o
 * comentário anterior ("usado para a contagem exibida na home e para os chips
 * de filtro") descrevia dois usos que não existem mais:
 *
 *   - A home conta `db.candidate.count({ electionType: "presidential" })`, sem
 *     recorte de situação, e explica por quê em `app/routes/home.tsx`: o CTA
 *     promete o número que `/candidatos` lista, e `/candidatos` mostra toda
 *     candidatura registrada, com o badge de cada uma. Filtrar aqui faria o
 *     número encolher abaixo da lista no dia de um indeferimento.
 *   - Os chips de `/candidatos` iteram `REGISTRATION_STATUSES` e contam o que
 *     a busca devolveu, situação por situação — nenhum deles é "na disputa".
 *
 * O que a lista guarda é a REGRA — quais situações significam "ainda na urna"
 * —, e o teste é quem a trava, para que a distinção entre "indeferido" e
 * "indeferido com recurso" não se perca. Quem for exibir uma contagem de
 * "candidaturas na disputa" usa esta lista em vez de reinventá-la; quem for
 * exibir "candidaturas registradas" NÃO usa, e a home é o exemplo.
 */
export const RUNNING_STATUSES: RegistrationStatus[] = [
  "REGISTERED",
  "PENDING_JUDGMENT",
  "SUB_JUDICE",
  "APPROVED",
];

/**
 * Aptidão da candidatura em TRÊS estados, a partir do que o DivulgaCandContas
 * devolve na ficha (`/rest/v1/candidatura/buscar/...`).
 *
 * ⚠️ A ARMADILHA
 *
 * `candidatoApto: false` NÃO significa inapto. VERIFICADO em 27/08/2026 nas 13
 * candidaturas presidenciais: **11 delas têm `candidatoApto: false` E
 * `isCandidatoInapto: false` ao mesmo tempo**, porque estão "Aguardando
 * julgamento". Os dois campos são complementares, não opostos: um afirma que
 * a Justiça Eleitoral já declarou a pessoa apta, o outro que já a declarou
 * inapta, e enquanto não houver decisão os dois são `false`.
 *
 * Ler `candidatoApto` como booleano marcaria 11 pessoas reais como inaptas
 * sem que nenhuma decisão existisse. Por isso o retorno é `boolean | null`:
 *
 *   `true`  — a Justiça Eleitoral declarou apta
 *   `false` — indeferida, cassada ou renunciada
 *   `null`  — AINDA NÃO JULGADA (não é dado faltando: é o estado real)
 *
 * A situação entra como segunda fonte porque as duas flags sozinhas erram no
 * outro sentido: quem renunciou tem `candidatoApto: false` e
 * `isCandidatoInapto: false` — os mesmos valores de quem aguarda julgamento —
 * e devolver `null` ali diria "ainda não julgada" sobre uma candidatura que
 * acabou. Redação que o TSE já decidiu resolve; redação pendente ou
 * desconhecida continua `null`.
 *
 * NÃO existe aqui, e não deve passar a existir, nenhuma leitura de
 * `st_MOTIVO_FICHA_LIMPA`. Esse campo vem `false` para TODAS as 13, inclusive
 * quem está sob julgamento: ele é o MOTIVO de um indeferimento, não um
 * atestado de ficha limpa. Usá-lo para afirmar qualquer coisa sobre uma
 * pessoa seria inventar um veredito.
 *
 * ⚠️ A SEGUNDA ARMADILHA: A FLAG CONTRADIZ A REDAÇÃO
 *
 * `candidatoApto: true` NÃO basta para afirmar aptidão. VERIFICADO em
 * 27/08/2026 nas 211 candidaturas: **ESTÊVÃO (BA, SQ 50002536579)** devolve
 * `candidatoApto: true` com `descricaoSituacao: "Indeferido em prazo recursal
 * ou com recurso"`. O schema documenta `tseApto: true` como "a Justiça
 * Eleitoral deferiu o registro" — dizer isso de um registro INDEFERIDO é uma
 * afirmação falsa sobre uma pessoa real.
 *
 * Daí a precedência abaixo: uma redação de indeferimento, cassação ou renúncia
 * derruba a flag afirmativa. Quando essa redação ainda comporta recurso
 * (SUB_JUDICE), o resultado é `null` — "ainda sem desfecho" —, nunca `true`.
 * A flag NEGATIVA (`isCandidatoInapto: true`) continua valendo antes de tudo:
 * é o TSE afirmando inaptidão explicitamente, e nenhuma redação a contradiz.
 */
export function aptoFromDivulga(input: {
  candidatoApto?: boolean | null;
  isCandidatoInapto?: boolean | null;
  situacao?: string | null;
}): boolean | null {
  // 1. Afirmação explícita de INAPTIDÃO. Nada a reconciliar: o TSE decidiu.
  if (input.isCandidatoInapto === true) return false;

  const status = statusFromTseLabel(input.situacao);

  // 2. Redação que NEGA o registro tem precedência sobre a flag afirmativa.
  //    Definitiva → inapta; ainda sob recurso → sem desfecho declarado.
  if (deniesRegistration(input.situacao)) {
    return status === "SUB_JUDICE" ? null : false;
  }

  // 3. Afirmação explícita de APTIDÃO, agora que nada a contradiz.
  if (input.candidatoApto === true) return true;

  // 4. Sem flag: decide a redação, quando ela é conclusiva.
  if (status === null) return null;
  if (DECIDED_APT_STATUSES.includes(status)) return true;
  if (DECIDED_UNAPT_STATUSES.includes(status)) return false;
  return null;
}

/**
 * Redações do TSE cujo TEXTO nega o registro — as definitivas e as que ainda
 * comportam recurso. Lista literal, e não um `startsWith("INDEFERIDO")`,
 * porque a regra que ela alimenta muda o que a plataforma afirma sobre uma
 * pessoa: uma redação nova do TSE tem de passar por uma decisão humana aqui,
 * não por um prefixo que casou por acaso.
 *
 * Toda entrada existe também no `TSE_STATUS_MAP` acima — o teste garante isso,
 * para que uma redação removida de lá não sobreviva esquecida aqui. É por essa
 * garantia que a lista é exportada: as chaves vêm já normalizadas
 * (`normalizeTseLabel`), então não sirva ela a nada que exiba texto.
 */
export const TSE_DENIAL_WORDINGS: ReadonlySet<string> = new Set<string>([
  "INDEFERIDO",
  "INDEFERIDO COM RECURSO",
  "INDEFERIDO COM RECURSO NO STF",
  "INDEFERIDO EM PRAZO RECURSAL OU COM RECURSO",
  "CANCELADO",
  "CANCELADO COM RECURSO",
  "CASSADO",
  "FALECIDO",
  "RENUNCIA",
  "RENUNCIA/FALECIMENTO/CASSACAO",
]);

function deniesRegistration(value: string | null | undefined): boolean {
  if (!value) return false;
  return TSE_DENIAL_WORDINGS.has(normalizeTseLabel(value));
}

/** Situações em que a Justiça Eleitoral já se pronunciou A FAVOR do registro. */
const DECIDED_APT_STATUSES: RegistrationStatus[] = ["APPROVED"];

/**
 * Situações em que a candidatura já foi decidida CONTRA — ou encerrada pelo
 * próprio candidato. `SUB_JUDICE` fica fora de propósito: "deferido com
 * recurso" e "indeferido com recurso" convivem sob o mesmo enum, então a
 * redação não basta para afirmar o desfecho e as flags é que decidem.
 */
const DECIDED_UNAPT_STATUSES: RegistrationStatus[] = [
  "REJECTED",
  "WITHDRAWN",
  "CANCELLED",
];
