export interface Article {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  content: string;
  keywords: string[];
  image: string;
  datePublished: string;
  author: string;
  references: {
    title: string;
    url: string;
  }[];
}

export const ARTICLES: Article[] = [
  {
    slug: "importancia-do-voto",
    title: "A Importância do Seu Voto",
    excerpt: "Entenda como o seu voto impacta diretamente o futuro da sua cidade e do país. A democracia precisa de você.",
    category: "Cidadania",
    keywords: ["voto", "democracia", "cidadania", "eleições", "política", "brasil"],
    image: "/images/voto-consciente.jpg",
    datePublished: "2025-10-01",
    author: "Equipe Em Quem Votar",
    content: `
      <p>O <strong>voto no Brasil</strong> é um pilar fundamental da democracia e um instrumento crucial para a participação cidadã. Ele não é apenas um direito; é a ferramenta mais poderosa que temos para transformar a nossa realidade social.</p>
      
      <h2>História e Evolução</h2>
      <p>O direito de escolher nossos representantes não foi dado de graça; foi conquistado. A história do voto no Brasil passou por diversas transformações:</p>
      <ul>
        <li><strong>Voto de Cabresto:</strong> Períodos onde o voto era controlado pelos "coronéis".</li>
        <li><strong>Voto Feminino (1932):</strong> Um marco histórico na luta pela igualdade.</li>
        <li><strong>Constituição de 1988:</strong> Consolidou o sufrágio universal, direto e secreto.</li>
      </ul>

      <h2>O Poder da Escolha</h2>
      <blockquote>
        "O voto é a arma do cidadão para mudar o destino de uma nação sem derramar uma gota de sangue."
      </blockquote>
      <p>Numa democracia representativa, você delega o poder de decisão. Ao votar, você está dizendo: "Eu confio que essa pessoa vai gerenciar o meu dinheiro (impostos) e cuidar da minha cidade melhor do que qualquer outra."</p>

      <h2>O Que é o Voto Consciente?</h2>
      <p>Votar com consciência vai além de escolher um número. Significa:</p>
      <ol>
        <li>Analisar o passado do candidato.</li>
        <li>Ler as propostas e ver se são viáveis.</li>
        <li>Entender que o voto tem consequências por 4 anos.</li>
      </ol>
      <p>Um voto consciente impede a eleição de maus políticos e fortalece as instituições democráticas.</p>
    `,
    references: [
      { title: "TSE - A importância do voto", url: "https://www.tse.jus.br" },
      { title: "Politize! - História do voto no Brasil", url: "https://www.politize.com.br" },
      { title: "Constituição Federal de 1988", url: "https://www.planalto.gov.br" }
    ]
  },
  {
    slug: "como-escolher",
    title: "Como Escolher um Candidato",
    excerpt: "Guia prático para analisar propostas, histórico e partidos. Não vote no escuro.",
    category: "Guia Prático",
    keywords: ["candidato", "eleições", "vereador", "prefeito", "guia eleitoral", "escolha consciente"],
    image: "/images/escolher-candidato.jpg",
    datePublished: "2025-10-02",
    author: "Equipe Em Quem Votar",
    content: `
      <p>Escolher um candidato é como contratar um funcionário para uma empresa muito importante: a sua cidade. Você contrataria alguém sem ler o currículo? Sem checar as referências?</p>

      <h2>Passo 1: Entenda o Cargo</h2>
      <p>Não adianta votar em um vereador esperando que ele construa uma ponte. As funções são diferentes:</p>
      <ul>
        <li><strong>Prefeito (Executivo):</strong> Administra a cidade, faz obras, cuida da saúde e educação.</li>
        <li><strong>Vereador (Legislativo):</strong> Cria leis e fiscaliza o Prefeito.</li>
      </ul>

      <h2>Passo 2: Investigação (Checa o Currículo!)</h2>
      <p>Use ferramentas oficiais para investigar:</p>
      <ul>
        <li>Acesse o <strong>DivulgaCandContas</strong> do TSE para ver o patrimônio e as contas.</li>
        <li>Pesquise se o candidato responde a processos judiciais.</li>
        <li>Veja se ele já ocupou cargos públicos e o que entregou.</li>
      </ul>

      <h2>Passo 3: Propostas vs. Promessas Vazias</h2>
      <p>Cuidado com promessas genéricas como "vou melhorar a saúde". Procure saber <strong>como</strong>. Um bom candidato diz: "Vou aumentar o número de médicos no posto do bairro X remanejando verbas da área Y".</p>
      
      <blockquote>
        Desconfie de soluções milagrosas. Problemas complexos exigem soluções planejadas.
      </blockquote>
    `,
    references: [
      { title: "TSE - DivulgaCandContas", url: "https://divulgacandcontas.tse.jus.br" },
      { title: "Politize! - Como escolher um candidato", url: "https://www.politize.com.br" }
    ]
  },
  {
    slug: "funcoes-vereador",
    title: "O Que Faz um Vereador?",
    excerpt: "Muitos desconhecem as funções reais de um vereador. Saiba o que cobrar do seu representante.",
    category: "Educação Política",
    keywords: ["vereador", "câmara municipal", "fiscalização", "leis", "poder legislativo"],
    image: "/images/funcoes-vereador.jpg",
    datePublished: "2025-10-03",
    author: "Equipe Em Quem Votar",
    content: `
      <p>O vereador é o elo mais próximo entre o cidadão e o poder público. Ele trabalha na Câmara Municipal e tem responsabilidades muito claras, que muitas vezes são confundidas pela população.</p>

      <h2>1. Função Legislativa (Criar Leis)</h2>
      <p>O vereador propõe, debate e vota leis que afetam o dia a dia da cidade. Isso inclui:</p>
      <ul>
        <li>Plano Diretor (como a cidade vai crescer).</li>
        <li>Lei Orçamentária (onde o dinheiro será gasto).</li>
        <li>Regras de trânsito, posturas municipais e nomes de ruas.</li>
      </ul>

      <h2>2. Função Fiscalizadora (O "Fiscal do Povo")</h2>
      <p>Talvez a função mais importante. O vereador deve vigiar o Prefeito:</p>
      <ul>
        <li>O dinheiro da merenda está sendo bem gasto?</li>
        <li>A obra do posto de saúde está no prazo?</li>
        <li>Os contratos da prefeitura estão regulares?</li>
      </ul>

      <h2>O Que o Vereador NÃO Pode Fazer</h2>
      <p>É crucial saber que o vereador <strong>não tem poder de execução</strong>. Ele não pode:</p>
      <ul>
        <li>Asfaltar ruas (ele só pode pedir/indicar ao prefeito).</li>
        <li>Contratar médicos ou professores.</li>
        <li>Perdoar dívidas ou multas.</li>
      </ul>
      <p>Se um candidato prometer isso, ele está mentindo ou desconhece a própria função.</p>
    `,
    references: [
      { title: "Câmara dos Deputados - O papel do vereador", url: "https://www.camara.leg.br" },
      { title: "Senado Federal - Atribuições do legislativo municipal", url: "https://www12.senado.leg.br" }
    ]
  },
  {
    slug: "espectro-politico",
    title: "Esquerda, Direita e Centro: Entenda as Diferenças",
    excerpt: "Você sabe onde se encaixa no espectro político? Um guia simples para entender as ideologias sem 'politiquês'.",
    category: "Conceitos Básicos",
    keywords: ["esquerda", "direita", "centro", "ideologia", "política"],
    image: "/images/espectro-politico.jpg",
    datePublished: "2025-10-04",
    author: "Equipe Em Quem Votar",
    content: "", // MDX handles content
    references: []
  },
  {
    slug: "mito-voto-nulo",
    title: "Voto Nulo Anula a Eleição? O Maior Mito",
    excerpt: "Se mais de 50% votarem nulo, a eleição é cancelada? Descubra a verdade sobre como seu voto é contabilizado.",
    category: "Mitos Eleitorais",
    keywords: ["voto nulo", "voto branco", "eleição", "fake news"],
    image: "/images/voto-nulo.jpg",
    datePublished: "2025-10-05",
    author: "Equipe Em Quem Votar",
    content: "", 
    references: []
  },
  {
    slug: "centrao",
    title: "O Que é o \"Centrão\"?",
    excerpt: "Eles não são de esquerda nem de direita. Entenda como funciona o grupo mais poderoso (e polêmico) do Congresso.",
    category: "Bastidores do Poder",
    keywords: ["centrão", "congresso", "câmara", "fisiologismo", "governabilidade"],
    image: "/images/centrao.jpg",
    datePublished: "2025-10-06",
    author: "Equipe Em Quem Votar",
    content: "",
    references: []
  }
];
