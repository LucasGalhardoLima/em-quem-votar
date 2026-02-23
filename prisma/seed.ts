import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Iniciando seed do banco de dados...\n");

  // ============================================================
  // 1. Political Topics (20 topics, 4 per thematic axis)
  // ============================================================

  const topicsData = [
    // Economia e Fiscal
    {
      id: crypto.randomUUID(),
      name: "Privatizações",
      category: "Economia e Fiscal",
      slug: "privatizacao",
      description:
        "Debate sobre a venda de empresas estatais (Petrobras, Correios, Banco do Brasil) para a iniciativa privada, visando eficiência e redução do papel do Estado na economia.",
      order: 0,
    },
    {
      id: crypto.randomUUID(),
      name: "Reforma Tributária",
      category: "Economia e Fiscal",
      slug: "reforma-tributaria",
      description:
        "Discussão sobre a simplificação e unificação do sistema tributário brasileiro, incluindo a criação de impostos únicos e redistribuição da carga fiscal.",
      order: 1,
    },
    {
      id: crypto.randomUUID(),
      name: "Programas Sociais",
      category: "Economia e Fiscal",
      slug: "bolsa-familia-programas-sociais",
      description:
        "Debate sobre a ampliação ou redução de programas de transferência de renda como o Bolsa Família e seus impactos no orçamento e na desigualdade.",
      order: 2,
    },
    {
      id: crypto.randomUUID(),
      name: "Política de Juros",
      category: "Economia e Fiscal",
      slug: "politica-de-juros",
      description:
        "Discussão sobre a taxa básica de juros (Selic), autonomia do Banco Central e o equilíbrio entre controle da inflação e estímulo ao crescimento.",
      order: 3,
    },
    // Segurança Pública
    {
      id: crypto.randomUUID(),
      name: "Armamento Civil",
      category: "Segurança Pública",
      slug: "armamento-civil",
      description:
        "Debate sobre o acesso de cidadãos a armas de fogo, envolvendo argumentos de legítima defesa versus riscos de aumento da violência.",
      order: 0,
    },
    {
      id: crypto.randomUUID(),
      name: "Política de Drogas",
      category: "Segurança Pública",
      slug: "politica-de-drogas",
      description:
        "Discussão sobre abordagens para lidar com o uso e tráfico de drogas, incluindo criminalização, descriminalização e políticas de redução de danos.",
      order: 1,
    },
    {
      id: crypto.randomUUID(),
      name: "Policiamento",
      category: "Segurança Pública",
      slug: "policiamento",
      description:
        "Debate sobre modelos de policiamento, uso da força, desmilitarização e integração entre polícias civil e militar.",
      order: 2,
    },
    {
      id: crypto.randomUUID(),
      name: "Sistema Prisional",
      category: "Segurança Pública",
      slug: "sistema-prisional",
      description:
        "Discussão sobre o sistema carcerário brasileiro, abordando superlotação, ressocialização, penas alternativas e privatização de presídios.",
      order: 3,
    },
    // Meio Ambiente e Agro
    {
      id: crypto.randomUUID(),
      name: "Desmatamento/Amazônia",
      category: "Meio Ambiente e Agro",
      slug: "desmatamento-amazonia",
      description:
        "Debate sobre a preservação da Floresta Amazônica, combate ao desmatamento ilegal e o equilíbrio entre conservação e desenvolvimento regional.",
      order: 0,
    },
    {
      id: crypto.randomUUID(),
      name: "Créditos de Carbono",
      category: "Meio Ambiente e Agro",
      slug: "creditos-de-carbono",
      description:
        "Discussão sobre o mercado de créditos de carbono, metas de redução de emissões e a transição para uma economia de baixo carbono.",
      order: 1,
    },
    {
      id: crypto.randomUUID(),
      name: "Política Agrícola",
      category: "Meio Ambiente e Agro",
      slug: "politica-agricola",
      description:
        "Debate sobre subsídios agrícolas, uso de agrotóxicos, agricultura familiar versus agronegócio e segurança alimentar.",
      order: 2,
    },
    {
      id: crypto.randomUUID(),
      name: "Demarcação de Terras Indígenas",
      category: "Meio Ambiente e Agro",
      slug: "demarcacao-terras-indigenas",
      description:
        "Discussão sobre a demarcação e proteção de territórios indígenas, envolvendo direitos originários, marco temporal e conflitos fundiários.",
      order: 3,
    },
    // Direitos e Costumes
    {
      id: crypto.randomUUID(),
      name: "Direitos LGBTQIA+",
      category: "Direitos e Costumes",
      slug: "direitos-lgbtqia",
      description:
        "Debate sobre igualdade de direitos para pessoas LGBTQIA+, incluindo casamento, adoção, criminalização da homofobia e identidade de gênero.",
      order: 0,
    },
    {
      id: crypto.randomUUID(),
      name: "Aborto",
      category: "Direitos e Costumes",
      slug: "aborto",
      description:
        "Discussão sobre a legislação do aborto no Brasil, envolvendo argumentos de saúde pública, autonomia da mulher, aspectos religiosos e éticos.",
      order: 1,
    },
    {
      id: crypto.randomUUID(),
      name: "Educação de Gênero",
      category: "Direitos e Costumes",
      slug: "educacao-de-genero",
      description:
        "Debate sobre a inclusão de temas de gênero e diversidade no currículo escolar, envolvendo argumentos pedagógicos, culturais e familiares.",
      order: 2,
    },
    {
      id: crypto.randomUUID(),
      name: "Liberdade Religiosa",
      category: "Direitos e Costumes",
      slug: "liberdade-religiosa",
      description:
        "Discussão sobre a laicidade do Estado, influência religiosa na política, proteção a minorias religiosas e limites da liberdade de expressão religiosa.",
      order: 3,
    },
    // Democracia e Institucional
    {
      id: crypto.randomUUID(),
      name: "Sistema Eleitoral",
      category: "Democracia e Institucional",
      slug: "sistema-eleitoral",
      description:
        "Debate sobre o modelo de votação brasileiro, incluindo voto impresso, urna eletrônica, financiamento de campanha e reforma política.",
      order: 0,
    },
    {
      id: crypto.randomUUID(),
      name: "Independência do STF",
      category: "Democracia e Institucional",
      slug: "independencia-do-stf",
      description:
        "Discussão sobre a autonomia do Supremo Tribunal Federal, nomeação de ministros, mandato fixo e limites de atuação do poder judiciário.",
      order: 1,
    },
    {
      id: crypto.randomUUID(),
      name: "Regulação de Mídia/IA",
      category: "Democracia e Institucional",
      slug: "regulacao-midia-ia",
      description:
        "Debate sobre a regulamentação de plataformas digitais, inteligência artificial, combate à desinformação e liberdade de expressão online.",
      order: 2,
    },
    {
      id: crypto.randomUUID(),
      name: "Papel das Forças Armadas",
      category: "Democracia e Institucional",
      slug: "papel-forcas-armadas",
      description:
        "Discussão sobre a atuação das Forças Armadas na política, operações de garantia da lei e da ordem, orçamento militar e defesa nacional.",
      order: 3,
    },
  ];

  console.log("Criando tópicos políticos...");
  await prisma.politicalTopic.createMany({
    data: topicsData,
    skipDuplicates: true,
  });

  // Build a lookup map for topics by slug
  const topicsBySlug = new Map(topicsData.map((t) => [t.slug, t]));

  // ============================================================
  // 2. Tags (upsert to avoid conflicts with existing data)
  // ============================================================

  const tagsData = [
    // Economia
    {
      id: crypto.randomUUID(),
      name: "Privatista",
      category: "Economia",
      slug: "privatista",
      description:
        "Favorável à privatização de empresas estatais e redução da participação do Estado na economia.",
    },
    {
      id: crypto.randomUUID(),
      name: "Estatizante",
      category: "Economia",
      slug: "estatizante",
      description:
        "Favorável à manutenção e ampliação de empresas estatais e maior participação do Estado na economia.",
    },
    {
      id: crypto.randomUUID(),
      name: "Reformista Fiscal",
      category: "Economia",
      slug: "reformista-fiscal",
      description:
        "Defende reformas no sistema tributário e fiscal para simplificação e maior eficiência arrecadatória.",
    },
    {
      id: crypto.randomUUID(),
      name: "Protecionista",
      category: "Economia",
      slug: "protecionista",
      description:
        "Favorável a políticas de proteção ao mercado interno, com barreiras comerciais e incentivos à produção nacional.",
    },
    // Segurança
    {
      id: crypto.randomUUID(),
      name: "Armamentista",
      category: "Segurança",
      slug: "armamentista",
      description:
        "Defende a flexibilização do acesso a armas de fogo para cidadãos como forma de legítima defesa.",
    },
    {
      id: crypto.randomUUID(),
      name: "Desarmamentista",
      category: "Segurança",
      slug: "desarmamentista",
      description:
        "Defende o controle rigoroso e restrição do acesso a armas de fogo pela população civil.",
    },
    {
      id: crypto.randomUUID(),
      name: "Punitivista",
      category: "Segurança",
      slug: "punitivista",
      description:
        "Favorável ao endurecimento das penas e políticas de segurança mais rigorosas contra a criminalidade.",
    },
    {
      id: crypto.randomUUID(),
      name: "Garantista Penal",
      category: "Segurança",
      slug: "garantista-penal",
      description:
        "Defende o respeito estrito às garantias constitucionais do acusado e foco na ressocialização do preso.",
    },
    // Meio Ambiente
    {
      id: crypto.randomUUID(),
      name: "Ambientalista Radical",
      category: "Meio Ambiente",
      slug: "ambientalista-radical",
      description:
        "Prioriza a preservação ambiental de forma rigorosa, defendendo restrições severas a atividades econômicas que impactem o meio ambiente.",
    },
    {
      id: crypto.randomUUID(),
      name: "Desenvolvimentista",
      category: "Meio Ambiente",
      slug: "desenvolvimentista",
      description:
        "Prioriza o desenvolvimento econômico e infraestrutura, buscando conciliar crescimento com responsabilidade ambiental.",
    },
    {
      id: crypto.randomUUID(),
      name: "Agro-Business",
      category: "Meio Ambiente",
      slug: "agro-business",
      description:
        "Defende os interesses do agronegócio como motor econômico do país, com foco em produtividade e exportação.",
    },
    // Costumes
    {
      id: crypto.randomUUID(),
      name: "Conservador Social",
      category: "Costumes",
      slug: "conservador-social",
      description:
        "Defende valores tradicionais e familiares, com posições conservadoras em temas de costumes e comportamento social.",
    },
    {
      id: crypto.randomUUID(),
      name: "Progressista Social",
      category: "Costumes",
      slug: "progressista-social",
      description:
        "Defende a ampliação de direitos individuais e liberdades civis, com posições progressistas em temas de costumes.",
    },
    // Institucional
    {
      id: crypto.randomUUID(),
      name: "Institucionalista",
      category: "Institucional",
      slug: "institucionalista",
      description:
        "Defende o fortalecimento das instituições democráticas, separação de poderes e respeito ao ordenamento jurídico vigente.",
    },
    {
      id: crypto.randomUUID(),
      name: "Anti-Establishment",
      category: "Institucional",
      slug: "anti-establishment",
      description:
        "Postura crítica ao sistema político vigente, defende reformas profundas nas instituições e combate ao chamado 'sistema'.",
    },
  ];

  console.log("Criando/atualizando tags...");
  for (const tag of tagsData) {
    await prisma.tag.upsert({
      where: { slug: tag.slug },
      update: {
        name: tag.name,
        category: tag.category,
        description: tag.description,
      },
      create: tag,
    });
  }

  // ============================================================
  // 3. Quiz Questions (20 questions, one per topic, 5 options each)
  // ============================================================

  const likertOptions = [
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

  const questionsData: {
    topicSlug: string;
    text: string;
    order: number;
  }[] = [
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

  console.log("Criando perguntas do quiz...");
  for (const q of questionsData) {
    const topic = topicsBySlug.get(q.topicSlug);
    if (!topic) {
      console.warn(`Tópico não encontrado para slug: ${q.topicSlug}`);
      continue;
    }

    const questionId = crypto.randomUUID();

    await prisma.quizQuestion.create({
      data: {
        id: questionId,
        text: q.text,
        topicId: topic.id,
        order: q.order,
        isActive: true,
        options: {
          createMany: {
            data: likertOptions.map((opt) => ({
              id: crypto.randomUUID(),
              label: opt.label,
              stanceValue: opt.stanceValue,
              order: opt.order,
              icon: opt.icon,
            })),
          },
        },
      },
    });
  }

  // ============================================================
  // 4. Candidates with positions
  // ============================================================

  const candidatesData = [
    {
      id: crypto.randomUUID(),
      name: "Luiz Inácio Lula da Silva",
      displayName: "Lula",
      party: "PT",
      biography:
        "Presidente da República em exercício (2023-2026), ex-presidente por dois mandatos (2003-2010). Metalúrgico e sindicalista de origem, fundador do Partido dos Trabalhadores. Sua gestão é marcada por políticas de combate à fome, programas sociais e protagonismo internacional do Brasil.",
      registrationStatus: "PRE_CANDIDATE" as const,
      positions: [
        { topicSlug: "privatizacao", stance: 2 },
        { topicSlug: "bolsa-familia-programas-sociais", stance: 5 },
        { topicSlug: "politica-de-juros", stance: 2 },
        { topicSlug: "armamento-civil", stance: 1 },
        { topicSlug: "politica-de-drogas", stance: 3 },
        { topicSlug: "desmatamento-amazonia", stance: 4 },
        { topicSlug: "demarcacao-terras-indigenas", stance: 5 },
        { topicSlug: "direitos-lgbtqia", stance: 4 },
        { topicSlug: "regulacao-midia-ia", stance: 4 },
        { topicSlug: "independencia-do-stf", stance: 3 },
      ],
    },
    {
      id: crypto.randomUUID(),
      name: "Tarcísio Gomes de Freitas",
      displayName: "Tarcísio de Freitas",
      party: "REPUBLICANOS",
      biography:
        "Governador de São Paulo (2023-2026), ex-Ministro da Infraestrutura (2019-2022). Engenheiro militar de formação, ganhou destaque por obras de infraestrutura e concessões. Representa uma direita pragmática com foco em gestão e resultados.",
      registrationStatus: "PRE_CANDIDATE" as const,
      positions: [
        { topicSlug: "privatizacao", stance: 5 },
        { topicSlug: "reforma-tributaria", stance: 4 },
        { topicSlug: "bolsa-familia-programas-sociais", stance: 3 },
        { topicSlug: "politica-de-juros", stance: 4 },
        { topicSlug: "armamento-civil", stance: 4 },
        { topicSlug: "policiamento", stance: 2 },
        { topicSlug: "desmatamento-amazonia", stance: 2 },
        { topicSlug: "politica-agricola", stance: 2 },
        { topicSlug: "sistema-eleitoral", stance: 3 },
        { topicSlug: "papel-forcas-armadas", stance: 2 },
        { topicSlug: "regulacao-midia-ia", stance: 2 },
      ],
    },
    {
      id: crypto.randomUUID(),
      name: "Simone Nassar Tebet",
      displayName: "Simone Tebet",
      party: "MDB",
      biography:
        "Ministra do Planejamento e Orçamento (2023-2026), ex-senadora por Mato Grosso do Sul (2015-2022). Advogada e professora, representante do centro político. Ganhou destaque na CPI da Pandemia e na eleição presidencial de 2022 como terceira colocada.",
      registrationStatus: "PRE_CANDIDATE" as const,
      positions: [
        { topicSlug: "privatizacao", stance: 3 },
        { topicSlug: "reforma-tributaria", stance: 5 },
        { topicSlug: "bolsa-familia-programas-sociais", stance: 4 },
        { topicSlug: "politica-de-juros", stance: 3 },
        { topicSlug: "armamento-civil", stance: 2 },
        { topicSlug: "desmatamento-amazonia", stance: 4 },
        { topicSlug: "creditos-de-carbono", stance: 4 },
        { topicSlug: "direitos-lgbtqia", stance: 4 },
        { topicSlug: "aborto", stance: 3 },
        { topicSlug: "independencia-do-stf", stance: 4 },
        { topicSlug: "regulacao-midia-ia", stance: 4 },
        { topicSlug: "educacao-de-genero", stance: 3 },
      ],
    },
    {
      id: crypto.randomUUID(),
      name: "Ciro Ferreira Gomes",
      displayName: "Ciro Gomes",
      party: "PDT",
      biography:
        "Político cearense com longa trajetória, ex-governador do Ceará (1991-1994), ex-ministro da Fazenda e da Integração Nacional. Candidato à presidência em 2002, 2018 e 2022. Defende um projeto nacional-desenvolvimentista com foco em industrialização e soberania.",
      registrationStatus: "PRE_CANDIDATE" as const,
      positions: [
        { topicSlug: "privatizacao", stance: 1 },
        { topicSlug: "reforma-tributaria", stance: 5 },
        { topicSlug: "bolsa-familia-programas-sociais", stance: 4 },
        { topicSlug: "politica-de-juros", stance: 1 },
        { topicSlug: "armamento-civil", stance: 2 },
        { topicSlug: "politica-de-drogas", stance: 3 },
        { topicSlug: "desmatamento-amazonia", stance: 4 },
        { topicSlug: "demarcacao-terras-indigenas", stance: 4 },
        { topicSlug: "independencia-do-stf", stance: 4 },
        { topicSlug: "regulacao-midia-ia", stance: 5 },
      ],
    },
    {
      id: crypto.randomUUID(),
      name: "Pablo Henrique Costa Marçal",
      displayName: "Pablo Marçal",
      party: "PRTB",
      biography:
        "Empresário, coach e influenciador digital. Candidato a deputado federal em 2022 e à prefeitura de São Paulo em 2024. Representa uma nova direita digital com discurso empreendedor, conservadorismo nos costumes e forte presença nas redes sociais.",
      registrationStatus: "PRE_CANDIDATE" as const,
      positions: [
        { topicSlug: "privatizacao", stance: 5 },
        { topicSlug: "reforma-tributaria", stance: 4 },
        { topicSlug: "bolsa-familia-programas-sociais", stance: 1 },
        { topicSlug: "armamento-civil", stance: 5 },
        { topicSlug: "sistema-prisional", stance: 1 },
        { topicSlug: "desmatamento-amazonia", stance: 2 },
        { topicSlug: "direitos-lgbtqia", stance: 1 },
        { topicSlug: "aborto", stance: 1 },
        { topicSlug: "educacao-de-genero", stance: 1 },
        { topicSlug: "liberdade-religiosa", stance: 2 },
        { topicSlug: "regulacao-midia-ia", stance: 1 },
        { topicSlug: "papel-forcas-armadas", stance: 2 },
      ],
    },
  ];

  console.log("Criando candidatos e posições...");
  for (const candidate of candidatesData) {
    const { positions, ...candidateInfo } = candidate;

    const createdCandidate = await prisma.candidate.create({
      data: {
        id: candidateInfo.id,
        name: candidateInfo.name,
        displayName: candidateInfo.displayName,
        party: candidateInfo.party,
        biography: candidateInfo.biography,
        registrationStatus: candidateInfo.registrationStatus,
      },
    });

    for (const pos of positions) {
      const topic = topicsBySlug.get(pos.topicSlug);
      if (!topic) {
        console.warn(
          `Tópico não encontrado: ${pos.topicSlug} para candidato ${candidateInfo.displayName}`
        );
        continue;
      }

      await prisma.candidatePosition.create({
        data: {
          id: crypto.randomUUID(),
          candidateId: createdCandidate.id,
          topicId: topic.id,
          stance: pos.stance,
          sourceType: "MANUAL",
          description: `Posição atribuída manualmente com base em declarações públicas e histórico político de ${candidateInfo.displayName}.`,
        },
      });
    }

    console.log(`  ✓ ${candidateInfo.displayName} (${candidateInfo.party})`);
  }

  // ============================================================
  // Summary
  // ============================================================

  const topicCount = await prisma.politicalTopic.count();
  const tagCount = await prisma.tag.count();
  const questionCount = await prisma.quizQuestion.count();
  const optionCount = await prisma.quizOption.count();
  const candidateCount = await prisma.candidate.count();
  const positionCount = await prisma.candidatePosition.count();

  console.log("\n========================================");
  console.log("Seed concluído com sucesso!");
  console.log("========================================");
  console.log(`Tópicos políticos: ${topicCount}`);
  console.log(`Tags: ${tagCount}`);
  console.log(`Perguntas do quiz: ${questionCount}`);
  console.log(`Opções de resposta: ${optionCount}`);
  console.log(`Candidatos: ${candidateCount}`);
  console.log(`Posições de candidatos: ${positionCount}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
