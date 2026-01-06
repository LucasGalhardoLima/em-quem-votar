

export const FILTER_GROUPS = [
  {
    title: "Economia & Política",
    filters: [
      { label: "Reformista Econômico", slug: "reformista-economico" },
      { label: "Conservador Econômico", slug: "conservador-economico" },
      { label: "Governista", slug: "governista-flexivel" },
      { label: "Oposição", slug: "oposicao-rigoroso" },
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
      { label: "Linha Dura", slug: "linha-dura" },
      { label: "Garantista", slug: "garantista" },
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
      { label: "Gazeteiro", slug: "gazeteiro" },
    ]
  },
  {
    title: "Perfil",
    filters: [
      { label: "Jovem", slug: "jovem" },
      { label: "Novato", slug: "novato" },
      { label: "Veterano", slug: "veterano" },
    ]
  }
];

// Helper for Home Page (Hero Section) - picking key popular filters
export const FEATURED_FILTERS = [
  { label: "Reformista", slug: "reformista-economico" },
  { label: "Ruralista", slug: "ruralista" },
  { label: "Linha Dura", slug: "linha-dura" },
  { label: "Baixo Custo", slug: "baixo-custo" },
  { label: "Jovem", slug: "jovem" },
];
