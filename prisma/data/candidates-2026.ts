/**
 * As 13 candidaturas à Presidência registradas para a eleição de 2026.
 *
 * PROCEDÊNCIA DO DADO
 * A fonte canônica é o TSE (dataset `candidatos-2026`, arquivo
 * `consulta_cand_2026_BR.csv`), consumido por `scripts/sync-tse-2026.ts`.
 * Enquanto esse sync não roda, os registros abaixo entram com
 * `dataSource: "press"` e cada campo não óbvio carrega a URL da matéria que
 * o sustenta. A interface exibe o selo "Dado de imprensa — aguardando TSE"
 * para qualquer candidato nessa condição.
 *
 * O sync do TSE faz upsert por `tseId` e SOBRESCREVE estes valores assim que
 * roda — é assim que se pretende. Nada aqui é chute: campo sem confirmação
 * fica `null`, nunca preenchido por inferência.
 *
 * A recíproca NÃO vale, e é o ponto: uma vez que o TSE sincronizou, o seed
 * não reescreve mais nada. Ele identifica a linha por `tseId` e só preenche
 * campo vazio (ver `seedCandidates()` em prisma/seed.ts). Rodar o seed depois
 * do sync é inofensivo de propósito.
 */

export interface CandidateSeed {
  /**
   * Identificador do registro no TSE (`SQ_CANDIDATO`). É a CHAVE do seed.
   *
   * Casar por nome não funciona e nunca funcionou: o TSE grava o nome de urna
   * em caixa alta e sem acento ("VETERINÁRIO WILSON GRASSI", "CLARIANA
   * BARAO"), enquanto este arquivo traz a grafia jornalística ("Wilson
   * Grassi", "Clariana Barão"). Conferido contra o banco em 27/08/2026: uma
   * comparação sensível a caixa acha ZERO das 13, e mesmo ignorando caixa e
   * acento três continuariam sem par ("Romeu Zema" × "ZEMA", "Wilson Grassi"
   * × "VETERINÁRIO WILSON GRASSI", "Augusto Cury" × "ESCRITOR AUGUSTO CURY").
   * Cada não-par vira uma candidatura DUPLICADA na listagem.
   *
   * Os valores abaixo vieram do próprio banco já sincronizado, e cada um foi
   * conferido por partido E número de urna — os dois batem 1 para 1 com as 13
   * linhas presidenciais. `null` só para uma candidatura ainda sem registro
   * no TSE; aí o seed cai no casamento por nome, que é frágil por natureza.
   */
  tseId: string | null;
  /** Nome completo, como registrado. */
  name: string;
  /** Nome de urna. */
  displayName: string;
  party: string;
  /** Número de urna. `null` quando não foi possível confirmar. */
  number: number | null;
  /** Nome da coligação, ou "Partido isolado". */
  coalition: string | null;
  coalitionParties: string[];
  viceName: string | null;
  viceParty: string | null;
  registrationStatus:
    | "REGISTERED"
    | "PENDING_JUDGMENT"
    | "SUB_JUDICE"
    | "APPROVED"
    | "REJECTED"
    | "WITHDRAWN"
    | "CANCELLED";
  /** Texto da situação conforme noticiado a partir do TSE. */
  tseStatusLabel: string | null;
  biography: string | null;
  governmentPlanUrl: string | null;
  officialSiteUrl: string | null;
  /** URL da fonte que sustenta o registro. Obrigatória para dataSource press. */
  sourceUrl: string;
  /** Vínculo legislativo, quando existe mandato recente. */
  legislative: {
    source: "CAMARA" | "SENADO";
    sourceId: string;
    legislaturePeriod: string | null;
  } | null;
}

export const CANDIDATES_2026: CandidateSeed[] = [
  {
    tseId: "280002542548",
    name: "Luiz Inácio Lula da Silva",
    displayName: "Lula",
    party: "PT",
    number: 13,
    coalition: "Brasil Pronto pra Mais",
    coalitionParties: [],
    viceName: "Geraldo Alckmin",
    viceParty: "PSB",
    registrationStatus: "PENDING_JUDGMENT",
    tseStatusLabel: "Aguardando julgamento",
    biography: null,
    governmentPlanUrl: null,
    officialSiteUrl: null,
    sourceUrl: "https://www12.senado.leg.br/noticias/materias/2026/08/17/eleicoes-2026-veja-os-numeros-das-candidaturas-oficializadas",
    legislative: null,
  },
  {
    tseId: "280002540694",
    name: "Renan Antonio Ferreira dos Santos",
    displayName: "Renan Santos",
    party: "MISSÃO",
    number: 14,
    coalition: "Partido isolado",
    coalitionParties: [],
    viceName: "Coronel Medina",
    viceParty: "MISSÃO",
    registrationStatus: "PENDING_JUDGMENT",
    tseStatusLabel: "Aguardando julgamento",
    biography: null,
    // Original do TSE, extraído de proposta_governo_2026_BR.zip em 26/08/2026
    // e servido localmente. Antes apontava para um espelho do Nexo, contorno
    // de quando o CDN do TSE estava inacessível — o documento oficial não
    // depende de terceiro continuar no ar.
    governmentPlanUrl: "/planos/280002540694.pdf",
    // Site declarado ao TSE. 200 em 26/08/2026.
    officialSiteUrl: "https://www.renanpresidente.com.br/",
    sourceUrl: "https://www12.senado.leg.br/noticias/materias/2026/08/17/eleicoes-2026-veja-os-numeros-das-candidaturas-oficializadas",
    legislative: null,
  },
  {
    tseId: "280002541457",
    name: "Hertz Dias",
    displayName: "Hertz Dias",
    party: "PSTU",
    number: 16,
    coalition: "Partido isolado",
    coalitionParties: [],
    viceName: "Vanessa Portugal",
    viceParty: "PSTU",
    registrationStatus: "PENDING_JUDGMENT",
    tseStatusLabel: "Aguardando julgamento",
    biography: null,
    governmentPlanUrl: null,
    officialSiteUrl: null,
    sourceUrl: "https://www12.senado.leg.br/noticias/materias/2026/08/17/eleicoes-2026-veja-os-numeros-das-candidaturas-oficializadas",
    legislative: null,
  },
  {
    tseId: "280002551975",
    name: "Edmilson Costa",
    displayName: "Edmilson Costa",
    party: "PCB",
    number: 21,
    coalition: "Partido isolado",
    coalitionParties: [],
    viceName: "Cleusa Santos",
    viceParty: "PCB",
    registrationStatus: "PENDING_JUDGMENT",
    tseStatusLabel: "Aguardando julgamento",
    biography: null,
    governmentPlanUrl: null,
    officialSiteUrl: null,
    sourceUrl: "https://www12.senado.leg.br/noticias/materias/2026/08/17/eleicoes-2026-veja-os-numeros-das-candidaturas-oficializadas",
    legislative: null,
  },
  {
    tseId: "280002551544",
    name: "Flávio Nantes Bolsonaro",
    displayName: "Flávio Bolsonaro",
    party: "PL",
    number: 22,
    coalition: "Partido isolado",
    coalitionParties: [],
    viceName: "Alfredo Gaspar",
    viceParty: "PL",
    registrationStatus: "PENDING_JUDGMENT",
    tseStatusLabel: "Aguardando julgamento",
    biography: null,
    governmentPlanUrl: null,
    officialSiteUrl: null,
    sourceUrl: "https://www12.senado.leg.br/noticias/materias/2026/08/17/eleicoes-2026-veja-os-numeros-das-candidaturas-oficializadas",
    legislative: {
      source: "SENADO",
      sourceId: "5894",
      legislaturePeriod: "2019-2027",
    },
  },
  {
    tseId: "280002552484",
    name: "Clariana Barão",
    displayName: "Clariana Barão",
    party: "DC",
    number: 27,
    coalition: "Partido isolado",
    coalitionParties: [],
    viceName: "Fabiana Torquato",
    viceParty: "DC",
    registrationStatus: "PENDING_JUDGMENT",
    tseStatusLabel: "Aguardando julgamento",
    biography: null,
    governmentPlanUrl: null,
    officialSiteUrl: null,
    sourceUrl: "https://www12.senado.leg.br/noticias/materias/2026/08/17/eleicoes-2026-veja-os-numeros-das-candidaturas-oficializadas",
    legislative: null,
  },
  {
    tseId: "280002553884",
    name: "Pablo Marçal",
    displayName: "Pablo Marçal",
    party: "PRTB",
    number: 28,
    coalition: "Partido isolado",
    coalitionParties: [],
    viceName: "Leonardo Avalanche",
    viceParty: "PRTB",
    registrationStatus: "PENDING_JUDGMENT",
    tseStatusLabel: "Aguardando julgamento",
    biography: null,
    governmentPlanUrl: null,
    officialSiteUrl: null,
    sourceUrl: "https://www12.senado.leg.br/noticias/materias/2026/08/17/eleicoes-2026-veja-os-numeros-das-candidaturas-oficializadas",
    legislative: null,
  },
  {
    tseId: "280002552487",
    name: "Rui Costa Pimenta",
    displayName: "Rui Costa Pimenta",
    party: "PCO",
    number: 29,
    coalition: "Partido isolado",
    coalitionParties: [],
    viceName: "Antônio Carlos",
    viceParty: "PCO",
    registrationStatus: "PENDING_JUDGMENT",
    tseStatusLabel: "Aguardando julgamento",
    biography: null,
    governmentPlanUrl: null,
    officialSiteUrl: null,
    sourceUrl: "https://www12.senado.leg.br/noticias/materias/2026/08/17/eleicoes-2026-veja-os-numeros-das-candidaturas-oficializadas",
    legislative: null,
  },
  {
    tseId: "280002539826",
    name: "Romeu Zema",
    displayName: "Romeu Zema",
    party: "NOVO",
    number: 30,
    coalition: "Partido isolado",
    coalitionParties: [],
    viceName: "Eduardo Girão",
    viceParty: "NOVO",
    registrationStatus: "PENDING_JUDGMENT",
    tseStatusLabel: "Aguardando julgamento",
    biography: null,
    governmentPlanUrl: null,
    officialSiteUrl: null,
    sourceUrl: "https://www12.senado.leg.br/noticias/materias/2026/08/17/eleicoes-2026-veja-os-numeros-das-candidaturas-oficializadas",
    legislative: null,
  },
  {
    tseId: "280002548139",
    name: "Wilson Grassi",
    displayName: "Wilson Grassi",
    party: "DEMOCRATA",
    number: 35,
    coalition: "Partido isolado",
    coalitionParties: [],
    viceName: "Suêd Haidar",
    viceParty: "DEMOCRATA",
    registrationStatus: "PENDING_JUDGMENT",
    tseStatusLabel: "Aguardando julgamento",
    biography: null,
    governmentPlanUrl: null,
    officialSiteUrl: null,
    sourceUrl: "https://www12.senado.leg.br/noticias/materias/2026/08/17/eleicoes-2026-veja-os-numeros-das-candidaturas-oficializadas",
    legislative: null,
  },
  {
    tseId: "280002551932",
    name: "Ronaldo Caiado",
    displayName: "Ronaldo Caiado",
    party: "PSD",
    number: 55,
    coalition: "Partido isolado",
    coalitionParties: [],
    viceName: "Gilberto Kassab",
    viceParty: "PSD",
    registrationStatus: "PENDING_JUDGMENT",
    tseStatusLabel: "Aguardando julgamento",
    biography: null,
    governmentPlanUrl: null,
    officialSiteUrl: null,
    sourceUrl: "https://www12.senado.leg.br/noticias/materias/2026/08/17/eleicoes-2026-veja-os-numeros-das-candidaturas-oficializadas",
    legislative: null,
  },
  {
    tseId: "280002551547",
    name: "Augusto Cury",
    displayName: "Augusto Cury",
    party: "AVANTE",
    number: 70,
    coalition: "Partido isolado",
    coalitionParties: [],
    viceName: "Júlio Delgado",
    viceParty: "AVANTE",
    registrationStatus: "PENDING_JUDGMENT",
    tseStatusLabel: "Aguardando julgamento",
    biography: null,
    governmentPlanUrl: null,
    officialSiteUrl: null,
    sourceUrl: "https://www12.senado.leg.br/noticias/materias/2026/08/17/eleicoes-2026-veja-os-numeros-das-candidaturas-oficializadas",
    legislative: null,
  },
  {
    tseId: "280002538811",
    name: "Samara Martins",
    displayName: "Samara",
    party: "UP",
    number: 80,
    coalition: "Partido isolado",
    coalitionParties: [],
    viceName: "Raquel Brício",
    viceParty: "UP",
    registrationStatus: "PENDING_JUDGMENT",
    tseStatusLabel: "Aguardando julgamento",
    biography: null,
    governmentPlanUrl: null,
    officialSiteUrl: null,
    sourceUrl: "https://www12.senado.leg.br/noticias/materias/2026/08/17/eleicoes-2026-veja-os-numeros-das-candidaturas-oficializadas",
    legislative: null,
  },
];

/**
 * PROCEDÊNCIA E LACUNAS CONHECIDAS
 *
 * Confirmado por três fontes independentes (as 13 pessoas, partido e chapa):
 *   1. Agência Senado, 17/08/2026 — "Eleições 2026: veja os números das
 *      candidaturas oficializadas"
 *   2. Wikipédia (pt) — "Eleição presidencial no Brasil em 2026"
 *   3. Gazeta do Povo — "Quem são os candidatos a presidente em 2026"
 *
 * Números de urna: confirmados por (2) e (3), que concordam integralmente.
 *
 * Vínculo legislativo: apenas Flávio Bolsonaro tem mandato em exercício.
 * O código 5894 vem da API oficial do Senado
 * (legis.senado.leg.br/dadosabertos/senador/lista/atual), consultada em
 * 25/08/2026 — nome completo "Flávio Nantes Bolsonaro", PL/RJ.
 *
 * PENDENTE DE CONFIRMAÇÃO — não preencher por inferência:
 * - `name`: Lula, Flávio Bolsonaro e Renan Santos têm nome completo
 *   confirmado. Nos demais o campo repete o nome de urna até o sync do TSE
 *   trazer o registro.
 * - `coalitionParties`: vazio em todos. A Agência Senado informa que a
 *   coligação de Lula reúne sete partidos, mas não os nomeia; o nome
 *   "Brasil Pronto pra Mais" aparece em uma única fonte.
 * - Vice de Renan Santos: (1) e (2) trazem "Coronel Medina", (3) traz
 *   "Aroldo Medina". Adotado o nome de urna, que é o que aparece na cédula.
 * - `governmentPlanUrl` e `officialSiteUrl`: preenchidos só para Renan
 *   Santos, os únicos dois que foi possível buscar e conferir. As propostas
 *   vivem no DivulgaCandContas do TSE, que responde 403 ao ambiente onde
 *   este arquivo foi montado; espelhos de imprensa cobrem parte dos casos.
 *   Dois IDs já localizados, a baixar de uma rede sem o bloqueio:
 *     Wilson Grassi  -> doc 280017075366 ("Brasil em Primeiro Lugar.pdf")
 *     Clariana Barão -> doc 280017113380 ("PLANO DE GOVERNO.pdf")
 *   Grassi e Clariana não declararam site de campanha ao TSE — o `null`
 *   aqui é a ausência real, não uma lacuna de apuração.
 * - `biography`: nulo de propósito. Biografia é trabalho editorial e entra
 *   pelo /admin, com fonte — não é gerada a partir de conhecimento prévio.
 *
 * Situação de registro: as treze constam como "Aguardando julgamento".
 * CORRIGIDO em 26/08/2026. O arquivo antes trazia doze "Deferido" e Marçal
 * "Sub judice", inferidos de uma matéria sobre candidaturas OFICIALIZADAS —
 * oficializar é protocolar o registro, não é tê-lo deferido. Duas apurações
 * independentes (grep no HTML de dois espelhos do DivulgaCandContas; e
 * Nexo/TribunaPR/Agência Sertão, que renderizam o campo do TSE literalmente)
 * convergem: nenhuma candidatura foi julgada até esta data. Afirmar
 * deferimento aqui seria atribuir a treze pessoas reais uma situação
 * jurídica que elas não têm.
 * A situação muda durante a campanha; `npm run sync:tse` é a forma correta
 * de mantê-la atualizada (SC-104 exige defasagem máxima de 24h).
 */
