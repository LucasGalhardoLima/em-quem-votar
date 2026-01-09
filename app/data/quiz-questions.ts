
export interface QuizQuestion {
    id: number;
    text: string;
    yesAffects: { tagSlug: string; weight: number }[]; // If user says YES, these tags get points
    noAffects: { tagSlug: string; weight: number }[];  // If user says NO, these tags get points
}

export const QUIZ_QUESTIONS: QuizQuestion[] = [
    {
        id: 1,
        text: "Você prefere políticos que votaram a favor da Reforma Tributária (simplificação de impostos)?",
        yesAffects: [{ tagSlug: "reformista-economico", weight: 2 }, { tagSlug: "governista-flexivel", weight: 1 }],
        noAffects: [{ tagSlug: "conservador-economico", weight: 2 }, { tagSlug: "oposicao-rigoroso", weight: 1 }]
    },
    {
        id: 2,
        text: "Você prioriza candidatos que gastam pouco (Baixo Custo) em vez de trazerem muitos recursos (Alto Custo)?",
        yesAffects: [{ tagSlug: "baixo-custo", weight: 3 }],
        noAffects: [{ tagSlug: "gastao", weight: 2 }]
    },
    {
        id: 3,
        text: "Você é contra a 'Saidinha' de presos (saídas temporárias em datas comemorativas)?",
        yesAffects: [{ tagSlug: "rigoroso", weight: 3 }, { tagSlug: "conservador-costumes", weight: 1 }],
        noAffects: [{ tagSlug: "garantista", weight: 3 }, { tagSlug: "progressista-costumes", weight: 1 }]
    },
    {
        id: 4,
        text: "Você apoia a tese do Marco Temporal (limitar demarcação de terras indígenas à data de 1988)?",
        yesAffects: [{ tagSlug: "ruralista", weight: 3 }],
        noAffects: [{ tagSlug: "ambientalista", weight: 3 }]
    },
    {
        id: 5,
        text: "Você prefere um político Novato (renovação) ou Veterano (experiência)?",
        yesAffects: [{ tagSlug: "novato", weight: 3 }], // YES = Novato
        noAffects: [{ tagSlug: "veterano", weight: 3 }]  // NO = Veterano
    },
    {
        id: 6,
        text: "Você é favorável à criminalização do porte de qualquer quantidade de drogas (PEC das Drogas)?",
        yesAffects: [{ tagSlug: "conservador-costumes", weight: 3 }, { tagSlug: "rigoroso", weight: 1 }],
        noAffects: [{ tagSlug: "progressista-costumes", weight: 3 }]
    }
];
