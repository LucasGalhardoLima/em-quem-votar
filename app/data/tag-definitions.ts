export interface TagDefinition {
  slug: string;
  sourceBillId: string;
  triggerVote: "SIM" | "NÃO";
  billTitle: string;
  reasonText: string;
}

export const TAG_DEFINITIONS: Record<string, TagDefinition> = {
  // Reforma Tributária
  "reformista-economico": {
    slug: "reformista-economico",
    sourceBillId: "2196833-326",
    triggerVote: "SIM",
    billTitle: "Reforma Tributária",
    reasonText: "Votou A FAVOR da Reforma Tributária (PEC 45/2019), apoiando a simplificação de impostos."
  },
  "conservador-economico": {
    slug: "conservador-economico",
    sourceBillId: "2196833-326",
    triggerVote: "NÃO",
    billTitle: "Reforma Tributária",
    reasonText: "Votou CONTRA a Reforma Tributária (PEC 45/2019), opondo-se à mudança no sistema fiscal proposta."
  },

  // Marco Temporal
  "ruralista": {
    slug: "ruralista",
    sourceBillId: "345311-270",
    triggerVote: "SIM",
    billTitle: "Marco Temporal",
    reasonText: "Votou A FAVOR do Marco Temporal (PL 490/2007), defendendo critérios mais rígidos para demarcação de terras indígenas."
  },
  "ambientalista": {
    slug: "ambientalista",
    sourceBillId: "345311-270",
    triggerVote: "NÃO",
    billTitle: "Marco Temporal",
    reasonText: "Votou CONTRA o Marco Temporal (PL 490/2007), defendendo a proteção ampla das terras indígenas."
  },

  // Arcabouço Fiscal
  "governista-flexivel": {
    slug: "governista-flexivel",
    sourceBillId: "2357053-47",
    triggerVote: "SIM",
    billTitle: "Arcabouço Fiscal",
    reasonText: "Votou A FAVOR do Arcabouço Fiscal (PLP 93/2023), alinhando-se à pauta econômica do governo."
  },

  "oposicao-rigoroso": {
    slug: "oposicao-rigoroso",
    sourceBillId: "2357053-47",
    triggerVote: "NÃO",
    billTitle: "Arcabouço Fiscal",
    reasonText: "Votou CONTRA o Arcabouço Fiscal (PLP 93/2023), opondo-se às novas regras de gastos públicos."
  },

  // Segurança Pública
  "rigoroso": {
    slug: "rigoroso",
    sourceBillId: "2423268-40",
    triggerVote: "SIM",
    billTitle: "Prisão Chiquinho Brazão",
    reasonText: "Votou A FAVOR da manutenção da prisão preventiva do deputado Chiquinho Brazão."
  },
  "garantista": {
    slug: "garantista",
    sourceBillId: "2423268-40",
    triggerVote: "NÃO",
    billTitle: "Prisão Chiquinho Brazão",
    reasonText: "Votou CONTRA a manutenção da prisão, defendendo o mandato ou o devido processo legal."
  },

  // Economia & Governo
  "base-governo": {
    slug: "base-governo",
    sourceBillId: "2194899-103",
    triggerVote: "SIM",
    billTitle: "PEC da Transição",
    reasonText: "Votou A FAVOR da PEC da Transição, viabilizando o orçamento do governo Lula."
  },
  "oposicao-governo": {
    slug: "oposicao-governo",
    sourceBillId: "2194899-103",
    triggerVote: "NÃO",
    billTitle: "PEC da Transição",
    reasonText: "Votou CONTRA a PEC da Transição, marcando posição de oposição ao aumento de gastos."
  },
  "liberal": {
    slug: "liberal",
    sourceBillId: "2270789-73",
    triggerVote: "SIM",
    billTitle: "Privatização Eletrobras",
    reasonText: "Votou A FAVOR da privatização da Eletrobras, apoiando a redução do estado na economia."
  },
  "estatista": {
    slug: "estatista",
    sourceBillId: "2270789-73",
    triggerVote: "NÃO",
    billTitle: "Privatização Eletrobras",
    reasonText: "Votou CONTRA a privatização da Eletrobras, defendendo o controle estatal de setores estratégicos."
  },

  // Tecnologia
  "regulacao-digital": {
    slug: "regulacao-digital",
    sourceBillId: "2310837-8",
    triggerVote: "SIM",
    billTitle: "PL das Fake News",
    reasonText: "Votou A FAVOR da urgência do PL das Fake News, apoiando maior regulação das redes sociais."
  },
  "liberdade-digital": {
    slug: "liberdade-digital",
    sourceBillId: "2310837-8",
    triggerVote: "NÃO",
    billTitle: "PL das Fake News",
    reasonText: "Votou CONTRA a urgência do PL das Fake News, alegando defesa da liberdade de expressão."
  },

  // Costumes
  "conservador-costumes": {
    slug: "conservador-costumes",
    sourceBillId: "pec-45-2023",
    triggerVote: "SIM",
    billTitle: "PEC das Drogas",
    reasonText: "Votou A FAVOR da criminalização do porte de qualquer quantidade de drogas."
  },
  "progressista-costumes": {
    slug: "progressista-costumes",
    sourceBillId: "pec-45-2023",
    triggerVote: "NÃO",
    billTitle: "PEC das Drogas",
    reasonText: "Votou CONTRA a criminalização indiscriminada, diferenciando usuário de traficante."
  },

  // Performance (Baseado em Dados)
  "baixo-custo": {
    slug: "baixo-custo",
    sourceBillId: "metrics",
    triggerVote: "SIM", // Virtual
    billTitle: "Análise de Gastos (CEAP)",
    reasonText: "Gastou menos de 80% da média de gastos parlamentares nos últimos 12 meses."
  },
  "gastao": {
    slug: "gastao",
    sourceBillId: "metrics",
    triggerVote: "SIM", // Virtual
    billTitle: "Análise de Gastos (CEAP)",
    reasonText: "Gastou acima de 120% da média de gastos parlamentares nos últimos 12 meses."
  },
  "ausente": {
    slug: "ausente",
    sourceBillId: "metrics",
    triggerVote: "SIM", // Virtual
    billTitle: "Assiduidade em Plenário",
    reasonText: "Esteve presente em menos de 80% das sessões deliberativas."
  },
  "assiduo": {
    slug: "assiduo",
    sourceBillId: "metrics",
    triggerVote: "SIM", // Virtual
    billTitle: "Assiduidade em Plenário",
    reasonText: "Esteve presente em mais de 95% das sessões deliberativas."
  },

  // Perfil
  "novato": {
    slug: "novato",
    sourceBillId: "demographics",
    triggerVote: "SIM", // Virtual
    billTitle: "Histórico Eleitoral",
    reasonText: "Exercendo seu primeiro mandato na Câmara Federal. (Anteriormente 'Jovem')"
  },
  "veterano": {
    slug: "veterano",
    sourceBillId: "demographics",
    triggerVote: "SIM", // Virtual
    billTitle: "Histórico Eleitoral",
    reasonText: "Parlamentar reeleito, com experiência prévia na casa."
  }
};
