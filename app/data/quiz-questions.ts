
export interface QuizQuestion {
    id: number;
    text: string;
    yesAffects: { tagSlug: string; weight: number }[]; // If user says YES, these tags get points
    noAffects: { tagSlug: string; weight: number }[];  // If user says NO, these tags get points
}

export const QUIZ_QUESTIONS: QuizQuestion[] = [
    {
        id: 1,
        text: "Você é a favor da Reforma Tributária que unificou impostos?",
        yesAffects: [{ tagSlug: "reformista", weight: 2 }, { tagSlug: "governista", weight: 1 }],
        noAffects: [{ tagSlug: "oposicao", weight: 1 }]
    },
    {
        id: 2,
        text: "Você acha que o governo deve gastar menos, mesmo que corte serviços?",
        yesAffects: [{ tagSlug: "baixo-custo", weight: 3 }, { tagSlug: "oposicao", weight: 1 }],
        noAffects: [{ tagSlug: "gastao", weight: 1 }]
    },
    {
        id: 3,
        text: "Você é contra a 'Saidinha' de presos em datas comemorativas?",
        yesAffects: [{ tagSlug: "linha-dura", weight: 3 }, { tagSlug: "conservador-costumes", weight: 1 }],
        noAffects: [{ tagSlug: "garantista", weight: 3 }]
    },
    {
        id: 4,
        text: "Você apoia a demarcação de terras indígenas (Marco Temporal)?",
        yesAffects: [{ tagSlug: "ambientalista", weight: 2 }],
        noAffects: [{ tagSlug: "ruralista", weight: 3 }]
    },
    {
        id: 5,
        text: "Você se considera parte da base aliada do atual governo?",
        yesAffects: [{ tagSlug: "governista", weight: 3 }],
        noAffects: [{ tagSlug: "oposicao", weight: 3 }]
    }
];
