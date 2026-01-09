

export const FILTER_GROUPS = [
  {
    title: "Economia & Política",
    filters: [
      { label: "Reformista Econômico", slug: "reformista-economico" },
      { label: "Conservador Econômico", slug: "conservador-economico" },
      { label: "Governista", slug: "governista-flexivel" },
      { label: "Oposição", slug: "oposicao-rigoroso" }, // Keep for backwards compat if needed, or replace with oposicao-governo
      { label: "Base do Governo (Lula)", slug: "base-governo" },
      { label: "Oposição ao Governo", slug: "oposicao-governo" },
      { label: "Liberal (Eletrobras)", slug: "liberal" },
      { label: "Estatista (Eletrobras)", slug: "estatista" },
    ]
  },
  {
    title: "Pauta Verde",
    filters: [
      { label: "Ruralista", slug: "ruralista" },
      { label: "Ambientalista", slug: "ambientalista" },
    ]
  },
  {
    title: "Segurança Pública",
    filters: [
      { label: "Rigoroso", slug: "rigoroso" },
      { label: "Garantista", slug: "garantista" },
    ]
  },
  {
    title: "Tecnologia & Comunicação",
    filters: [
      { label: "Regulação Digital", slug: "regulacao-digital" },
      { label: "Liberdade Digital", slug: "liberdade-digital" },
    ]
  },
  {
    title: "Costumes",
    filters: [
      { label: "Conservador", slug: "conservador-costumes" },
      { label: "Progressista", slug: "progressista-costumes" },
    ]
  },
  {
    title: "Uso de Verba",
    filters: [
      { label: "Baixo Custo", slug: "baixo-custo" },
      { label: "Alto Custo", slug: "gastao" },
    ]
  },
  {
    title: "Assiduidade",
    filters: [
      { label: "Assíduo", slug: "assiduo" },
      { label: "Ausente", slug: "ausente" },
    ]
  },
  {
    title: "Perfil",
    filters: [
      { label: "Novato", slug: "novato" },
      { label: "Veterano", slug: "veterano" },
    ]
  }
];

// Helper for Home Page (Hero Section) - picking key popular filters
export const FEATURED_FILTERS = [
  { label: "Reformista", slug: "reformista-economico" },
  { label: "Ruralista", slug: "ruralista" },
  { label: "Rigoroso", slug: "rigoroso" },
  { label: "Baixo Custo", slug: "baixo-custo" },
  { label: "Novato", slug: "novato" },
];
