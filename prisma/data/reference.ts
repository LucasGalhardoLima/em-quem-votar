/**
 * Dados de referência do quiz e dos eixos temáticos.
 *
 * Extraído de prisma/seed.ts para que o seed seja idempotente: nada aqui
 * carrega id gerado em tempo de execução. A chave natural de cada registro
 * é o `slug` (tópicos e tags) ou o par tópico+ordem (perguntas), então
 * rodar o seed duas vezes não duplica linha nenhuma.
 */

export interface TopicSeed {
  name: string;
  category: string;
  slug: string;
  description: string;
  order: number;
}

export interface TagSeed {
  name: string;
  category: string;
  slug: string;
  description: string;
}

export interface LikertOptionSeed {
  label: string;
  stanceValue: number;
  order: number;
  icon: string;
}

export interface QuestionSeed {
  topicSlug: string;
  text: string;
  order: number;
}

export const TOPICS: TopicSeed[] = [
  // Economia e Fiscal
  {
    name: "Privatizações",
    category: "Economia e Fiscal",
    slug: "privatizacao",
    description:
      "Debate sobre a venda de empresas estatais (Petrobras, Correios, Banco do Brasil) para a iniciativa privada, visando eficiência e redução do papel do Estado na economia.",
    order: 0,
  },
  {
    name: "Reforma Tributária",
    category: "Economia e Fiscal",
    slug: "reforma-tributaria",
    description:
      "Discussão sobre a simplificação e unificação do sistema tributário brasileiro, incluindo a criação de impostos únicos e redistribuição da carga fiscal.",
    order: 1,
  },
  {
    name: "Programas Sociais",
    category: "Economia e Fiscal",
    slug: "bolsa-familia-programas-sociais",
    description:
      "Debate sobre a ampliação ou redução de programas de transferência de renda como o Bolsa Família e seus impactos no orçamento e na desigualdade.",
    order: 2,
  },
  {
    name: "Política de Juros",
    category: "Economia e Fiscal",
    slug: "politica-de-juros",
    description:
      "Discussão sobre a taxa básica de juros (Selic), autonomia do Banco Central e o equilíbrio entre controle da inflação e estímulo ao crescimento.",
    order: 3,
  },
  // Segurança Pública
  {
    name: "Armamento Civil",
    category: "Segurança Pública",
    slug: "armamento-civil",
    description:
      "Debate sobre o acesso de cidadãos a armas de fogo, envolvendo argumentos de legítima defesa versus riscos de aumento da violência.",
    order: 0,
  },
  {
    name: "Política de Drogas",
    category: "Segurança Pública",
    slug: "politica-de-drogas",
    description:
      "Discussão sobre abordagens para lidar com o uso e tráfico de drogas, incluindo criminalização, descriminalização e políticas de redução de danos.",
    order: 1,
  },
  {
    name: "Policiamento",
    category: "Segurança Pública",
    slug: "policiamento",
    description:
      "Debate sobre modelos de policiamento, uso da força, desmilitarização e integração entre polícias civil e militar.",
    order: 2,
  },
  {
    name: "Sistema Prisional",
    category: "Segurança Pública",
    slug: "sistema-prisional",
    description:
      "Discussão sobre o sistema carcerário brasileiro, abordando superlotação, ressocialização, penas alternativas e privatização de presídios.",
    order: 3,
  },
  // Meio Ambiente e Agro
  {
    name: "Desmatamento/Amazônia",
    category: "Meio Ambiente e Agro",
    slug: "desmatamento-amazonia",
    description:
      "Debate sobre a preservação da Floresta Amazônica, combate ao desmatamento ilegal e o equilíbrio entre conservação e desenvolvimento regional.",
    order: 0,
  },
  {
    name: "Créditos de Carbono",
    category: "Meio Ambiente e Agro",
    slug: "creditos-de-carbono",
    description:
      "Discussão sobre o mercado de créditos de carbono, metas de redução de emissões e a transição para uma economia de baixo carbono.",
    order: 1,
  },
  {
    name: "Política Agrícola",
    category: "Meio Ambiente e Agro",
    slug: "politica-agricola",
    description:
      "Debate sobre subsídios agrícolas, uso de agrotóxicos, agricultura familiar versus agronegócio e segurança alimentar.",
    order: 2,
  },
  {
    name: "Demarcação de Terras Indígenas",
    category: "Meio Ambiente e Agro",
    slug: "demarcacao-terras-indigenas",
    description:
      "Discussão sobre a demarcação e proteção de territórios indígenas, envolvendo direitos originários, marco temporal e conflitos fundiários.",
    order: 3,
  },
  // Direitos e Costumes
  {
    name: "Direitos LGBTQIA+",
    category: "Direitos e Costumes",
    slug: "direitos-lgbtqia",
    description:
      "Debate sobre igualdade de direitos para pessoas LGBTQIA+, incluindo casamento, adoção, criminalização da homofobia e identidade de gênero.",
    order: 0,
  },
  {
    name: "Aborto",
    category: "Direitos e Costumes",
    slug: "aborto",
    description:
      "Discussão sobre a legislação do aborto no Brasil, envolvendo argumentos de saúde pública, autonomia da mulher, aspectos religiosos e éticos.",
    order: 1,
  },
  {
    name: "Educação de Gênero",
    category: "Direitos e Costumes",
    slug: "educacao-de-genero",
    description:
      "Debate sobre a inclusão de temas de gênero e diversidade no currículo escolar, envolvendo argumentos pedagógicos, culturais e familiares.",
    order: 2,
  },
  {
    name: "Liberdade Religiosa",
    category: "Direitos e Costumes",
    slug: "liberdade-religiosa",
    description:
      "Discussão sobre a laicidade do Estado, influência religiosa na política, proteção a minorias religiosas e limites da liberdade de expressão religiosa.",
    order: 3,
  },
  // Democracia e Institucional
  {
    name: "Sistema Eleitoral",
    category: "Democracia e Institucional",
    slug: "sistema-eleitoral",
    description:
      "Debate sobre o modelo de votação brasileiro, incluindo voto impresso, urna eletrônica, financiamento de campanha e reforma política.",
    order: 0,
  },
  {
    name: "Independência do STF",
    category: "Democracia e Institucional",
    slug: "independencia-do-stf",
    description:
      "Discussão sobre a autonomia do Supremo Tribunal Federal, nomeação de ministros, mandato fixo e limites de atuação do poder judiciário.",
    order: 1,
  },
  {
    name: "Regulação de Mídia/IA",
    category: "Democracia e Institucional",
    slug: "regulacao-midia-ia",
    description:
      "Debate sobre a regulamentação de plataformas digitais, inteligência artificial, combate à desinformação e liberdade de expressão online.",
    order: 2,
  },
  {
    name: "Papel das Forças Armadas",
    category: "Democracia e Institucional",
    slug: "papel-forcas-armadas",
    description:
      "Discussão sobre a atuação das Forças Armadas na política, operações de garantia da lei e da ordem, orçamento militar e defesa nacional.",
    order: 3,
  },
  ];

export const TAGS: TagSeed[] = [
  // Economia
  {
    name: "Privatista",
    category: "Economia",
    slug: "privatista",
    description:
      "Favorável à privatização de empresas estatais e redução da participação do Estado na economia.",
  },
  {
    name: "Estatizante",
    category: "Economia",
    slug: "estatizante",
    description:
      "Favorável à manutenção e ampliação de empresas estatais e maior participação do Estado na economia.",
  },
  {
    name: "Reformista Fiscal",
    category: "Economia",
    slug: "reformista-fiscal",
    description:
      "Defende reformas no sistema tributário e fiscal para simplificação e maior eficiência arrecadatória.",
  },
  {
    name: "Protecionista",
    category: "Economia",
    slug: "protecionista",
    description:
      "Favorável a políticas de proteção ao mercado interno, com barreiras comerciais e incentivos à produção nacional.",
  },
  // Segurança
  {
    name: "Armamentista",
    category: "Segurança",
    slug: "armamentista",
    description:
      "Defende a flexibilização do acesso a armas de fogo para cidadãos como forma de legítima defesa.",
  },
  {
    name: "Desarmamentista",
    category: "Segurança",
    slug: "desarmamentista",
    description:
      "Defende o controle rigoroso e restrição do acesso a armas de fogo pela população civil.",
  },
  {
    name: "Punitivista",
    category: "Segurança",
    slug: "punitivista",
    description:
      "Favorável ao endurecimento das penas e políticas de segurança mais rigorosas contra a criminalidade.",
  },
  {
    name: "Garantista Penal",
    category: "Segurança",
    slug: "garantista-penal",
    description:
      "Defende o respeito estrito às garantias constitucionais do acusado e foco na ressocialização do preso.",
  },
  // Meio Ambiente
  {
    name: "Ambientalista Radical",
    category: "Meio Ambiente",
    slug: "ambientalista-radical",
    description:
      "Prioriza a preservação ambiental de forma rigorosa, defendendo restrições severas a atividades econômicas que impactem o meio ambiente.",
  },
  {
    name: "Desenvolvimentista",
    category: "Meio Ambiente",
    slug: "desenvolvimentista",
    description:
      "Prioriza o desenvolvimento econômico e infraestrutura, buscando conciliar crescimento com responsabilidade ambiental.",
  },
  {
    name: "Agro-Business",
    category: "Meio Ambiente",
    slug: "agro-business",
    description:
      "Defende os interesses do agronegócio como motor econômico do país, com foco em produtividade e exportação.",
  },
  // Costumes
  {
    name: "Conservador Social",
    category: "Costumes",
    slug: "conservador-social",
    description:
      "Defende valores tradicionais e familiares, com posições conservadoras em temas de costumes e comportamento social.",
  },
  {
    name: "Progressista Social",
    category: "Costumes",
    slug: "progressista-social",
    description:
      "Defende a ampliação de direitos individuais e liberdades civis, com posições progressistas em temas de costumes.",
  },
  // Institucional
  {
    name: "Institucionalista",
    category: "Institucional",
    slug: "institucionalista",
    description:
      "Defende o fortalecimento das instituições democráticas, separação de poderes e respeito ao ordenamento jurídico vigente.",
  },
  {
    name: "Anti-Establishment",
    category: "Institucional",
    slug: "anti-establishment",
    description:
      "Postura crítica ao sistema político vigente, defende reformas profundas nas instituições e combate ao chamado 'sistema'.",
  },
  ];

/** Escala Likert de 5 pontos, idêntica em todas as perguntas. */
export const LIKERT_OPTIONS: LikertOptionSeed[] = [
  {
    label: "Discordo Totalmente",
    stanceValue: 1,
    order: 0,
    icon: "thumbs-down",
  },
  {
    label: "Discordo",
    stanceValue: 2,
    order: 1,
    icon: "minus-circle",
  },
  {
    label: "Neutro",
    stanceValue: 3,
    order: 2,
    icon: "minus",
  },
  {
    label: "Concordo",
    stanceValue: 4,
    order: 3,
    icon: "plus-circle",
  },
  {
    label: "Concordo Totalmente",
    stanceValue: 5,
    order: 4,
    icon: "thumbs-up",
  },
  ];

export const QUESTIONS: QuestionSeed[] = [
  // Economia e Fiscal
  {
    topicSlug: "privatizacao",
    text: "O governo deveria vender empresas estatais como Petrobras, Banco do Brasil e Correios para a iniciativa privada, visando maior eficiência e redução de gastos públicos?",
    order: 0,
  },
  {
    topicSlug: "reforma-tributaria",
    text: "A reforma tributária deveria simplificar os impostos e unificar tributos, mesmo que isso signifique mudanças na carga tributária de alguns setores?",
    order: 1,
  },
  {
    topicSlug: "bolsa-familia-programas-sociais",
    text: "O governo deveria ampliar programas de transferência de renda como o Bolsa Família para combater a pobreza, mesmo com o aumento dos gastos públicos?",
    order: 2,
  },
  {
    topicSlug: "politica-de-juros",
    text: "O Banco Central deveria ter total autonomia para definir a taxa de juros, sem interferência do governo, mesmo que isso resulte em juros altos por períodos prolongados?",
    order: 3,
  },
  // Segurança Pública
  {
    topicSlug: "armamento-civil",
    text: "O cidadão brasileiro deveria ter direito facilitado à posse e ao porte de armas de fogo para sua proteção pessoal?",
    order: 4,
  },
  {
    topicSlug: "politica-de-drogas",
    text: "O Brasil deveria adotar políticas de descriminalização do uso pessoal de drogas, focando em tratamento de saúde ao invés de punição criminal?",
    order: 5,
  },
  {
    topicSlug: "policiamento",
    text: "As polícias militar e civil deveriam ser unificadas em uma única força policial, com treinamento focado em mediação de conflitos e respeito aos direitos humanos?",
    order: 6,
  },
  {
    topicSlug: "sistema-prisional",
    text: "O sistema prisional deveria priorizar a ressocialização dos detentos com programas educacionais e de trabalho, ao invés de focar exclusivamente na punição?",
    order: 7,
  },
  // Meio Ambiente e Agro
  {
    topicSlug: "desmatamento-amazonia",
    text: "O governo deveria proibir completamente qualquer novo desmatamento na Amazônia, mesmo que isso limite a expansão agrícola em áreas de fronteira?",
    order: 8,
  },
  {
    topicSlug: "creditos-de-carbono",
    text: "O Brasil deveria estabelecer um mercado regulado de créditos de carbono com metas obrigatórias de redução de emissões para empresas?",
    order: 9,
  },
  {
    topicSlug: "politica-agricola",
    text: "O governo deveria direcionar mais recursos para a agricultura familiar e produção orgânica, mesmo que isso reduza o investimento no agronegócio de exportação?",
    order: 10,
  },
  {
    topicSlug: "demarcacao-terras-indigenas",
    text: "O governo deveria acelerar a demarcação de terras indígenas conforme a Constituição, mesmo em áreas atualmente ocupadas por produtores rurais?",
    order: 11,
  },
  // Direitos e Costumes
  {
    topicSlug: "direitos-lgbtqia",
    text: "O Estado deveria aprovar legislação que garanta explicitamente igualdade de direitos para pessoas LGBTQIA+, incluindo casamento, adoção e proteção contra discriminação?",
    order: 12,
  },
  {
    topicSlug: "aborto",
    text: "A legislação brasileira deveria ampliar as situações em que o aborto é permitido, priorizando a autonomia da mulher e a saúde pública?",
    order: 13,
  },
  {
    topicSlug: "educacao-de-genero",
    text: "As escolas deveriam incluir discussões sobre gênero e diversidade no currículo, visando combater o preconceito e promover o respeito às diferenças?",
    order: 14,
  },
  {
    topicSlug: "liberdade-religiosa",
    text: "O Estado deveria ser estritamente laico, sem influência religiosa nas decisões políticas, mesmo que a maioria da população se identifique com alguma religião?",
    order: 15,
  },
  // Democracia e Institucional
  {
    topicSlug: "sistema-eleitoral",
    text: "O Brasil deveria implementar o voto impresso auditável junto à urna eletrônica para aumentar a transparência do processo eleitoral?",
    order: 16,
  },
  {
    topicSlug: "independencia-do-stf",
    text: "Os ministros do STF deveriam ter mandatos fixos com limite de tempo, ao invés de permanecerem no cargo até a aposentadoria compulsória?",
    order: 17,
  },
  {
    topicSlug: "regulacao-midia-ia",
    text: "O governo deveria regular plataformas digitais e o uso de inteligência artificial para combater a desinformação, mesmo com possíveis impactos na liberdade de expressão?",
    order: 18,
  },
  {
    topicSlug: "papel-forcas-armadas",
    text: "As Forças Armadas deveriam ter um papel estritamente de defesa nacional, sem participação em operações de segurança interna ou questões políticas?",
    order: 19,
  },
  ];
