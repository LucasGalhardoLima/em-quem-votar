export interface QuizOption {
    label: string;
    description?: string;
    value: string; // "A" | "B" | "YES" | "NO" etc
    affects: { tagSlug: string; weight: number }[];
    color?: "green" | "red" | "blue" | "gray";
    icon?: "check" | "x" | "thumbs-up" | "thumbs-down" | "scale" | "shield" | "dollar" | "lock" | "unlock" | "tree" | "tractor" | "sparkles" | "award" | "heart" | "briefcase";
}

export interface QuizQuestion {
    id: number;
    text: string;
    options: QuizOption[];
}

export const QUIZ_QUESTIONS: QuizQuestion[] = [
    {
        id: 1,
        text: "Sobre a simplificação de impostos (Reforma Tributária):",
        options: [
            {
                label: "Sou a favor",
                description: "Simplificar é essencial para o crescimento.",
                value: "A",
                affects: [{ tagSlug: "reformista-economico", weight: 2 }, { tagSlug: "governista-flexivel", weight: 1 }],
                color: "green",
                icon: "check"
            },
            {
                label: "Sou contra",
                description: "Prejudica setores e aumenta a carga.",
                value: "B",
                affects: [{ tagSlug: "conservador-economico", weight: 2 }, { tagSlug: "oposicao-rigoroso", weight: 1 }],
                color: "red",
                icon: "x"
            }
        ]
    },
    {
        id: 2,
        text: "Qual perfil de deputado você prefere?",
        options: [
            {
                label: "Econômico (Baixo Custo)",
                description: "Gasta pouco da cota parlamentar.",
                value: "A",
                affects: [{ tagSlug: "baixo-custo", weight: 3 }],
                color: "green",
                icon: "dollar"
            },
            {
                label: "Atuante (Traz Recursos)",
                description: "Usa a cota para viabilizar o mandato.",
                value: "B",
                affects: [{ tagSlug: "gastao", weight: 2 }],
                color: "blue",
                icon: "briefcase" // fallback to something generic if needed
            }
        ]
    },
    {
        id: 3,
        text: "Sobre a 'Saidinha' de presos em datas comemorativas:",
        options: [
            {
                label: "Deve ser proibida",
                description: "Pena deve ser cumprida integralmente.",
                value: "A",
                affects: [{ tagSlug: "rigoroso", weight: 3 }, { tagSlug: "conservador-costumes", weight: 1 }],
                color: "red",
                icon: "lock" // placeholder icon logic
            },
            {
                label: "Deve ser mantida",
                description: "Ajuda na ressocialização.",
                value: "B",
                affects: [{ tagSlug: "garantista", weight: 3 }, { tagSlug: "progressista-costumes", weight: 1 }],
                color: "blue",
                icon: "unlock" // placeholder
            }
        ]
    },
    {
        id: 4,
        text: "Sobre o Marco Temporal (terras indígenas em 1988):",
        options: [
            {
                label: "A favor do Marco",
                description: "Garante segurança jurídica para produtores.",
                value: "A",
                affects: [{ tagSlug: "ruralista", weight: 3 }],
                color: "green",
                icon: "tractor"
            },
            {
                label: "Contra o Marco",
                description: "Proteção aos povos originários é prioridade.",
                value: "B",
                affects: [{ tagSlug: "ambientalista", weight: 3 }],
                color: "blue",
                icon: "tree"
            }
        ]
    },
    {
        id: 5,
        text: "Você prefere um político Novato ou Veterano?",
        options: [
            {
                label: "Novato",
                description: "Renovação e novas ideias.",
                value: "A",
                affects: [{ tagSlug: "novato", weight: 3 }],
                color: "blue",
                icon: "sparkles"
            },
            {
                label: "Veterano",
                description: "Experiência e articulação.",
                value: "B",
                affects: [{ tagSlug: "veterano", weight: 3 }],
                color: "gray",
                icon: "award"
            }
        ]
    },
    {
        id: 6,
        text: "Sobre a descriminalização do porte de drogas:",
        options: [
            {
                label: "Totalmente Contra",
                description: "Drogas devem continuar criminalizadas.",
                value: "A",
                affects: [{ tagSlug: "conservador-costumes", weight: 3 }, { tagSlug: "rigoroso", weight: 1 }],
                color: "red",
                icon: "shield"
            },
            {
                label: "A favor (flexível)",
                description: "Usuário não deve ser preso.",
                value: "B",
                affects: [{ tagSlug: "progressista-costumes", weight: 3 }],
                color: "blue",
                icon: "heart"
            }
        ]
    },
    {
        id: 7,
        text: "Sobre o combate a Fake News e regulação das redes:",
        options: [
            {
                label: "Regular as Redes",
                description: "Plataformas devem ser responsabilizadas.",
                value: "A",
                affects: [{ tagSlug: "regulacao-digital", weight: 3 }],
                color: "blue",
                icon: "scale"
            },
            {
                label: "Liberdade Total",
                description: "Regulação pode virar censura.",
                value: "B",
                affects: [{ tagSlug: "liberdade-digital", weight: 3 }],
                color: "green",
                icon: "unlock"
            }
        ]
    },
    {
        id: 8,
        text: "Sobre privatizações de estatais estratégicas (ex: Eletrobras):",
        options: [
            {
                label: "A favor (Privatizar)",
                description: "Estado menor é mais eficiente.",
                value: "A",
                affects: [{ tagSlug: "liberal", weight: 3 }],
                color: "green",
                icon: "dollar"
            },
            {
                label: "Contra (Estatal)",
                description: "Manter controle estratégico.",
                value: "B",
                affects: [{ tagSlug: "estatista", weight: 3 }],
                color: "red",
                icon: "shield"
            }
        ]
    },
    // PEC da Transição is implicit in "Aumento de gastos" vs "Responsabilidade fiscal" generally, but let's add specific one.
    {
        id: 9,
        text: "Sobre Aumento de Gastos para Programas Sociais (PEC da Transição):",
        options: [
            {
                label: "A favor dos Gastos",
                description: "Social é prioridade, mesmo aumentando dívida.",
                value: "A",
                affects: [{ tagSlug: "base-governo", weight: 3 }],
                color: "red",
                icon: "heart"
            },
            {
                label: "Responsabilidade Fiscal",
                description: "Não gastar mais do que arrecada.",
                value: "B",
                affects: [{ tagSlug: "oposicao-governo", weight: 3 }],
                color: "blue",
                icon: "scale"
            }
        ]
    }
];
