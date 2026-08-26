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
 * situação: ver a guarda `statusKnown` no sync.
 */
export function statusFromTseLabel(
  value: string | null | undefined,
): RegistrationStatus | null {
  if (!value) return null;
  return TSE_STATUS_MAP[normalizeTseLabel(value)] ?? null;
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
 * Situações em que a candidatura ainda está na disputa. Usado para a
 * contagem exibida na home ("13 candidaturas registradas") e para os
 * chips de filtro.
 */
export const RUNNING_STATUSES: RegistrationStatus[] = [
  "REGISTERED",
  "PENDING_JUDGMENT",
  "SUB_JUDICE",
  "APPROVED",
];
