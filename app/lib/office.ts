/**
 * Cargos em disputa e unidades federativas.
 *
 * POR QUE SÓ PRESIDENTE E GOVERNADOR
 * A eleição de 2026 tem seis cargos na cédula. A plataforma cobre dois, e o
 * motivo é jurídico, não técnico: a Lei 9.504/97, art. 11, §1º, IX obriga a
 * registrar "propostas defendidas pelo candidato" apenas para **Prefeito,
 * Governador de Estado e Presidente da República**. Senador, deputado
 * federal, estadual e distrital não arquivam documento nenhum de propostas.
 *
 * Como toda posição exibida aqui precisa citar documento, página e trecho
 * (ver `SourceCite`), cobrir os cargos legislativos significaria ou deixar a
 * tela vazia ou inferir posição — e inferir é exatamente o que a metodologia
 * promete não fazer. Não é uma lacuna a preencher depois: para 93% da cédula,
 * o documento não existe.
 */

export const OFFICES = ["presidential", "governor"] as const;

export type Office = (typeof OFFICES)[number];

interface OfficePresentation {
  /** Nome do cargo no singular, como aparece na cédula. */
  label: string;
  /** Plural, para títulos de listagem. */
  labelPlural: string;
  /** Como o eleitor se refere ao voto. */
  ballotLabel: string;
  /** Âmbito da disputa — define se `uf` é exigida. */
  scope: "national" | "state";
  /** Nome do segundo nome da chapa. */
  runningMateLabel: string;
}

export const OFFICE_PRESENTATION: Record<Office, OfficePresentation> = {
  presidential: {
    label: "Presidente da República",
    labelPlural: "Presidência",
    ballotLabel: "Presidente",
    scope: "national",
    runningMateLabel: "Vice-presidente",
  },
  governor: {
    label: "Governador",
    labelPlural: "Governos estaduais",
    ballotLabel: "Governador",
    scope: "state",
    runningMateLabel: "Vice-governador",
  },
};

export function isOffice(value: unknown): value is Office {
  return typeof value === "string" && (OFFICES as readonly string[]).includes(value);
}

/**
 * As 27 unidades federativas. Todas elegem governador em 2026.
 * A ordem é alfabética pela sigla — qualquer outra ordenação (por população,
 * por região) embutiria um juízo sobre quais estados importam mais.
 */
export const UFS = [
  { sigla: "AC", nome: "Acre" },
  { sigla: "AL", nome: "Alagoas" },
  { sigla: "AM", nome: "Amazonas" },
  { sigla: "AP", nome: "Amapá" },
  { sigla: "BA", nome: "Bahia" },
  { sigla: "CE", nome: "Ceará" },
  { sigla: "DF", nome: "Distrito Federal" },
  { sigla: "ES", nome: "Espírito Santo" },
  { sigla: "GO", nome: "Goiás" },
  { sigla: "MA", nome: "Maranhão" },
  { sigla: "MG", nome: "Minas Gerais" },
  { sigla: "MS", nome: "Mato Grosso do Sul" },
  { sigla: "MT", nome: "Mato Grosso" },
  { sigla: "PA", nome: "Pará" },
  { sigla: "PB", nome: "Paraíba" },
  { sigla: "PE", nome: "Pernambuco" },
  { sigla: "PI", nome: "Piauí" },
  { sigla: "PR", nome: "Paraná" },
  { sigla: "RJ", nome: "Rio de Janeiro" },
  { sigla: "RN", nome: "Rio Grande do Norte" },
  { sigla: "RO", nome: "Rondônia" },
  { sigla: "RR", nome: "Roraima" },
  { sigla: "RS", nome: "Rio Grande do Sul" },
  { sigla: "SC", nome: "Santa Catarina" },
  { sigla: "SE", nome: "Sergipe" },
  { sigla: "SP", nome: "São Paulo" },
  { sigla: "TO", nome: "Tocantins" },
] as const;

export type UfSigla = (typeof UFS)[number]["sigla"];

const UF_BY_SIGLA = new Map<string, string>(UFS.map(uf => [uf.sigla, uf.nome]));

export function isUf(value: unknown): value is UfSigla {
  return typeof value === "string" && UF_BY_SIGLA.has(value);
}

/** Nome por extenso, ou `null` quando a sigla não é uma UF. */
export function ufName(sigla: string | null | undefined): string | null {
  if (!sigla) return null;
  return UF_BY_SIGLA.get(sigla) ?? null;
}

/**
 * Normaliza o que vem da querystring. Aceita minúsculas por conveniência de
 * URL, mas devolve `null` para qualquer coisa que não seja UF — parâmetro
 * inválido vira "sem filtro", nunca erro nem lista vazia enganosa.
 */
export function parseUf(raw: string | null | undefined): UfSigla | null {
  if (!raw) return null;
  const upper = raw.trim().toUpperCase();
  return isUf(upper) ? (upper as UfSigla) : null;
}

export function parseOffice(raw: string | null | undefined): Office | null {
  if (!raw) return null;
  const lower = raw.trim().toLowerCase();
  return isOffice(lower) ? lower : null;
}

/**
 * Rótulo da disputa, do jeito que o eleitor a reconhece na urna.
 * Presidente não recebe UF mesmo se alguma for passada: a disputa é nacional
 * e escrever "Presidente — SP" sugeriria uma eleição estadual que não existe.
 */
export function raceLabel(office: Office, uf: string | null): string {
  const presentation = OFFICE_PRESENTATION[office];
  if (presentation.scope === "national") return presentation.ballotLabel;
  const nome = ufName(uf);
  return nome ? `${presentation.ballotLabel} — ${nome}` : presentation.ballotLabel;
}

/** `true` quando o cargo exige UF para ser identificado sem ambiguidade. */
export function requiresUf(office: Office): boolean {
  return OFFICE_PRESENTATION[office].scope === "state";
}
