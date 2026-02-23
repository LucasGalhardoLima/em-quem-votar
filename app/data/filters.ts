export const FILTER_GROUPS = [
  {
    title: "Economia & Fiscal",
    filters: [
      { label: "Reformista Econômico", slug: "reformista-economico" },
      { label: "Conservador Econômico", slug: "conservador-economico" },
      { label: "Liberal", slug: "liberal" },
      { label: "Estatista", slug: "estatista" },
    ],
  },
  {
    title: "Segurança Pública",
    filters: [
      { label: "Rigoroso", slug: "rigoroso" },
      { label: "Garantista", slug: "garantista" },
    ],
  },
  {
    title: "Meio Ambiente & Agro",
    filters: [
      { label: "Ambientalista", slug: "ambientalista" },
      { label: "Ruralista", slug: "ruralista" },
    ],
  },
  {
    title: "Direitos & Costumes",
    filters: [
      { label: "Conservador", slug: "conservador-costumes" },
      { label: "Progressista", slug: "progressista-costumes" },
    ],
  },
  {
    title: "Democracia & Institucional",
    filters: [
      { label: "Regulação Digital", slug: "regulacao-digital" },
      { label: "Liberdade Digital", slug: "liberdade-digital" },
    ],
  },
  {
    title: "Perfil Político",
    filters: [
      { label: "Base do Governo", slug: "base-governo" },
      { label: "Oposição", slug: "oposicao-governo" },
      { label: "Governista", slug: "governista-flexivel" },
    ],
  },
];

export const FEATURED_FILTERS = [
  { label: "Reformista", slug: "reformista-economico" },
  { label: "Ambientalista", slug: "ambientalista" },
  { label: "Rigoroso", slug: "rigoroso" },
  { label: "Progressista", slug: "progressista-costumes" },
  { label: "Liberal", slug: "liberal" },
];

export const TOPIC_CATEGORIES = [
  "Economia e Fiscal",
  "Segurança Pública",
  "Meio Ambiente e Agro",
  "Direitos e Costumes",
  "Democracia e Institucional",
] as const;

export const STANCE_OPTIONS = [
  { value: "favor", label: "A favor" },
  { value: "contra", label: "Contra" },
] as const;
