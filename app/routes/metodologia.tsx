import type { Route } from "./+types/metodologia";
import { pageMeta } from "~/root";
import { useEffect, useState, type ReactNode } from "react";
import { useLoaderData } from "react-router";
import { ChevronDown } from "lucide-react";
import { Container, MAIN_CONTENT_ID } from "~/components/layout";
import { cn } from "~/lib/utils";

export function meta({}: Route.MetaArgs) {
  return [
    ...pageMeta({
      title: "Metodologia — Em Quem Votar?",
      description:
        "Como a plataforma coleta dados oficiais do TSE, da Câmara e do Senado, extrai posições com documento e página citados, calcula a compatibilidade do quiz e protege a neutralidade e a privacidade de quem responde.",
    }),
    { name: "robots", content: "index,follow" },
  ];
}

export async function loader(): Promise<{ updatedAt: string; version: string }> {
  return {
    version: "2.5",
    // Data da última revisão desta metodologia (ISO 8601).
    updatedAt: "2026-08-28",
  };
}

// ============================================================
// Conteúdo
// ============================================================

type MethodologySection = {
  /** Âncora usada no menu lateral e no hash da URL */
  id: string;
  /** Número exibido antes do título */
  number: string;
  /** Rótulo curto na trilha lateral */
  navLabel: string;
  /** Título completo da seção */
  title: string;
  body: ReactNode;
};

const SECTIONS: MethodologySection[] = [
  {
    id: "fontes",
    number: "1",
    navLabel: "Fontes de dados",
    title: "Fontes de dados",
    body: (
      <>
        <p>
          A plataforma se alimenta exclusivamente de documentos oficiais e
          públicos. São quatro fontes: as{" "}
          <strong className="font-semibold text-slate-800">
            propostas de governo protocoladas no TSE
          </strong>{" "}
          no registro de candidatura; as{" "}
          <strong className="font-semibold text-slate-800">
            votações nominais da Câmara dos Deputados e do Senado Federal
          </strong>
          , pelos portais de dados abertos de cada casa; as{" "}
          <strong className="font-semibold text-slate-800">
            declarações de bens
          </strong>{" "}
          entregues junto ao pedido de registro; e o{" "}
          <strong className="font-semibold text-slate-800">
            DivulgaCandContas
          </strong>
          , de onde vêm receitas e despesas de campanha.
        </p>
        <p>
          O que não entra é tão importante quanto o que entra. Pesquisa de
          intenção de voto, artigo de opinião, post em rede social, boato de
          bastidor e declaração sem registro verificável não são usados como
          base de nenhuma posição exibida aqui. Se não existe documento público
          para citar, a informação não é publicada.
        </p>
        <p>
          O Portal de Dados Abertos do TSE republica o cadastro de candidaturas
          quatro vezes por dia, e nossa sincronização acompanha essa cadência,
          gravando um snapshot local — nenhuma página depende de uma chamada
          externa no momento em que você a abre. Como a frequência de um robô
          não é algo que você possa verificar de fora, não pedimos que acredite
          nela: cada candidatura exibe a data da sua própria última
          sincronização, e é esse carimbo, não a nossa promessa, que diz se o
          dado está fresco.
        </p>
      </>
    ),
  },
  {
    id: "extracao",
    number: "2",
    navLabel: "Extração de posições",
    title: "Extração de posições",
    body: (
      <>
        <p>
          Cada posição atribuída a uma candidatura aponta para{" "}
          <strong className="font-semibold text-slate-800">
            documento, página e trecho
          </strong>
          . Não há posição sem rastro: o leitor consegue abrir a fonte, achar a
          página e conferir se a leitura que fizemos se sustenta. A extração é
          trabalho editorial — ler o PDF, marcar o trecho, classificar o tema e
          submeter à revisão antes de publicar.
        </p>
        <p>
          Quando não existe registro documental de uma candidatura sobre um
          tema, a plataforma mostra{" "}
          <strong className="font-semibold text-slate-800">
            “sem posição registrada”
          </strong>{" "}
          e para por aí. Não inferimos a partir do partido, de aliados, de
          votações vizinhas, de entrevistas informais ou de proximidade
          ideológica. O silêncio documental é informação legítima e é exibido
          como tal, sem preenchimento.
        </p>
        <p>
          Existe uma única exceção, e ela é declarada: quando a candidatura não
          tem proposta própria sobre o tema mas o partido tem programa
          registrado, a posição pode entrar rotulada como{" "}
          <strong className="font-semibold text-slate-800">
            programa do partido
          </strong>
          , com aviso explícito na própria ficha e link para o documento
          partidário. Esse conteúdo nunca é apresentado como palavra da
          candidatura, aparece visualmente separado das posições próprias e você
          sempre sabe qual dos dois está lendo.
        </p>
      </>
    ),
  },
  {
    id: "calculo",
    number: "3",
    navLabel: "Cálculo de compatibilidade",
    title: "Cálculo de compatibilidade",
    body: (
      <>
        <p>
          Suas respostas no quiz usam uma escala Likert de cinco pontos, de
          “discordo totalmente” (1) a “concordo totalmente” (5). As posições
          documentadas das candidaturas são classificadas na mesma escala, o que
          torna os dois lados diretamente comparáveis. A comparação é uma{" "}
          <strong className="font-semibold text-slate-800">
            distância euclidiana quadrática ponderada
          </strong>
          : para cada tema, elevamos ao quadrado a diferença entre a sua
          resposta e a posição documentada, multiplicamos pelo peso do eixo e
          somamos.
        </p>
        <p>
          O peso vem de você. No fim do quiz, cada eixo temático recebe a
          importância que você atribuiu, com multiplicador{" "}
          <strong className="font-semibold text-slate-800">alta = 1,5</strong>,{" "}
          <strong className="font-semibold text-slate-800">média = 1,0</strong>{" "}
          e <strong className="font-semibold text-slate-800">baixa = 0,5</strong>
          . Dividindo a soma ponderada pelo peso total chega-se à distância
          média, e é ela que normalizamos pela maior diferença ao quadrado
          possível na escala, (5 − 1)² = 16:
        </p>
        <p className="rounded-lg border border-slate-200 bg-white px-3.5 py-3 font-mono text-xs leading-[1.55] text-slate-700">
          distânciaMédia² = somaPonderada / pesoTotal
          <br />
          matchPercentage = round((1 − (nTemas × distânciaMédia² + 3 × 4) /
          ((nTemas + 3) × 16)) × 100)
        </p>
        <p>
          Os dois “3” da fórmula são{" "}
          <strong className="font-semibold text-slate-800">
            três temas virtuais
          </strong>
          , e eles existem para corrigir um defeito que medimos no nosso próprio
          algoritmo. Uma média tirada de poucos temas oscila muito mais que uma
          tirada de muitos, e uma lista ordenada premia justamente quem oscila
          para cima. Na prática, isso fazia a candidatura com{" "}
          <strong className="font-semibold text-slate-800">menos</strong>{" "}
          posições registradas liderar o resultado com mais frequência — o
          oposto do que esta plataforma existe para fazer. Mantendo as respostas
          e as concorrentes fixas e variando só quantas posições de uma
          candidatura estavam documentadas, a chance dela aparecer em primeiro
          caía de 16,6% (com três temas) para 2,2% (com treze), sem que a
          compatibilidade real mudasse.
        </p>
        <p>
          Cada tema virtual vale 4, que é a distância quadrática esperada entre
          duas respostas quaisquer da escala — o equivalente a{" "}
          <strong className="font-semibold text-slate-800">75%</strong>, o ponto
          de “não sabemos nada sobre esta candidatura”. Quanto mais temas
          documentados, menos peso eles têm; com poucos temas, o percentual é
          puxado para esse meio. A consequência aparece na tela e é intencional:
          a escala aperta quando há pouca evidência. Concordância total em três
          temas dá <strong className="font-semibold text-slate-800">88%</strong>,
          não 100%, porque 100% afirmaria uma certeza que três temas não
          sustentam. Com treze temas comparados o teto é 95%; com dezoito, 96%;
          com vinte e quatro, 97%. O piso acompanha na outra ponta: discordância
          total em três temas é 38%, e só chega a 8% com vinte e quatro. Na
          menor base que a plataforma publica — dois temas — o teto é 85% e o
          piso, 45%. Em forma fechada, com n temas comparados, o teto é
          100 − 75/(n+3) e o piso é 225/(n+3), válido de n = 2 em diante, que é
          onde o piso descrito adiante autoriza publicar.
        </p>
        <p>
          Repare onde o peso{" "}
          <strong className="font-semibold text-slate-800">não</strong> entra:
          os três temas virtuais são contados{" "}
          <strong className="font-semibold text-slate-800">em temas</strong>,
          ao lado de nTemas, e nunca ao lado do peso total. A importância que
          você declara serve para ordenar os temas entre si, não para dizer
          quanta evidência existe — afirmar que Saúde importa muito para você
          não documenta nenhuma posição a mais, logo não pode comprar certeza
          sobre ninguém. Nas versões anteriores desta metodologia essa separação
          não existia no código: os temas virtuais eram somados ao peso, e por
          isso uma concordância total em três temas exibia 83%, 88% ou 90%
          conforme a importância que você tivesse dado ao eixo em que a
          candidatura por acaso se pronunciou. Duas candidaturas igualmente
          alinhadas podiam ser ordenadas pelo acaso documental. Está corrigido:
          o teto e o piso passaram a depender apenas de quantos temas foram
          efetivamente comparados, e os números do parágrafo acima valem para
          qualquer combinação de importâncias.
        </p>
        <p>
          Temas sem posição documentada{" "}
          <strong className="font-semibold text-slate-800">
            ficam fora do denominador
          </strong>
          . A candidatura não ganha nem perde pontos por um silêncio: o tema
          simplesmente não entra na conta. É por isso que o número de temas
          comparáveis muda de candidatura para candidatura, e é por isso que
          todo resultado mostra em quantas perguntas ele se baseia. Um
          percentual alto apoiado em 6 temas não vale o mesmo que um percentual
          alto apoiado em 20 — e a plataforma diz isso na cara do resultado, em
          vez de esconder.
        </p>
        <p>
          Há um piso, e ele existe porque a desigualdade de cobertura é real.
          As propostas protocoladas variam muito: algumas tratam quase todos os
          temas, outras são documentos genéricos que quase não se pronunciam.
          Quando conseguimos comparar{" "}
          <strong className="font-semibold text-slate-800">
            menos de três temas
          </strong>{" "}
          — ou menos de dois, se você respondeu quatro perguntas ou menos —, a
          plataforma{" "}
          <strong className="font-semibold text-slate-800">
            não publica percentual nenhum
          </strong>{" "}
          e diz “base insuficiente”. Um número tirado de um único tema pareceria
          tão preciso quanto um tirado de vinte, e ocuparia o topo da lista do
          mesmo jeito. Preferimos dizer que não sabemos.
        </p>
        <p>
          O piso acompanha o tamanho do quiz, para não punir quem respondeu
          pouco: comparar dois temas de três respondidos é cobertura de dois
          terços e vira percentual. Mas ele para de descer em{" "}
          <strong className="font-semibold text-slate-800">dois temas</strong> e
          nunca chega a um, por mais curto que tenha sido o quiz. Um tema
          comparável é uma comparação só — não existe uma segunda para
          confirmá-la ou desmenti-la, e a média de uma comparação tem a
          aparência de medida sem o conteúdo. A consequência merece ser dita com
          todas as letras: se você respondeu{" "}
          <strong className="font-semibold text-slate-800">
            uma única pergunta
          </strong>
          , não haverá percentual para candidatura nenhuma, porque nem no melhor
          caso existe um segundo tema para comparar. A tela diz “base
          insuficiente”, que é verdade, no lugar de um número que não seria.
        </p>
        <p>
          O algoritmo é aberto e auditável. Não há ajuste manual, curadoria de
          resultado nem regra especial para nenhuma candidatura: as mesmas
          respostas produzem sempre o mesmo resultado, e o código que faz esse
          cálculo é público.
        </p>
      </>
    ),
  },
  {
    id: "neutralidade",
    number: "4",
    navLabel: "Neutralidade",
    title: "Neutralidade",
    body: (
      <>
        <p>
          As{" "}
          <strong className="font-semibold text-slate-800">
            13 candidaturas
          </strong>{" "}
          à Presidência recebem peso visual idêntico: mesmo tamanho de card,
          mesmo tratamento de foto, mesma tipografia, mesma profundidade de
          ficha. Nenhuma recebe destaque de layout, selo de relevância ou
          posição privilegiada.
        </p>
        <p>
          A ordem das listagens é{" "}
          <strong className="font-semibold text-slate-800">
            aleatorizada a cada visita
          </strong>
          . Não é alfabética (o que favoreceria nomes no início do alfabeto),
          não é por intenção de voto e não é por qualquer noção de
          “relevância”. Duas pessoas abrindo a mesma página ao mesmo tempo veem
          ordens diferentes.
        </p>
        <p>
          A situação do registro é exibida{" "}
          <strong className="font-semibold text-slate-800">
            na redação do próprio TSE
          </strong>{" "}
          — deferido, deferido com recurso, sub judice, indeferido —, sem
          paráfrase, sem adjetivo nosso e sem interpretação sobre o que aquilo
          significa para a viabilidade da candidatura. Mudanças de situação
          chegam pelo sync do TSE, não por decisão editorial.
        </p>
        <p>
          Não há cores partidárias em lugar nenhum da interface. A paleta é uma
          só para todo mundo, e concordância e discordância não são pintadas de
          verde e vermelho, para que nenhuma posição pareça, pelo desenho, certa
          ou errada. Também não existe ranking editorial, “melhor candidato”,
          nota de qualidade ou endosso — nem explícito, nem por sugestão de
          layout. A plataforma não recebe recursos de campanhas, partidos ou
          coligações.
        </p>
      </>
    ),
  },
  {
    id: "privacidade",
    number: "5",
    navLabel: "Privacidade",
    title: "Privacidade",
    body: (
      <>
        <p>
          O quiz roda{" "}
          <strong className="font-semibold text-slate-800">
            inteiramente no seu navegador
          </strong>
          . Suas respostas ficam no dispositivo, no armazenamento local
          (localStorage), e não são enviadas ao servidor em momento algum. Não
          existe banco de respostas para vazar, ser intimado ou ser vendido,
          porque ele não é criado.
        </p>
        <p>
          Não é preciso criar conta, informar e-mail ou fazer login para
          responder ao quiz e ver o resultado. Se você quiser apagar tudo, basta
          limpar os dados do site no navegador — não há cópia nossa para pedir
          exclusão.
        </p>
        <p>
          Se você compartilhar seu resultado, o link carrega{" "}
          <strong className="font-semibold text-slate-800">
            apenas os percentuais de compatibilidade
          </strong>
          , nunca as respostas. Quem abrir o link vê o placar, e não consegue
          reconstruir o que você respondeu em cada pergunta.
        </p>
        <p>
          Coletamos apenas métricas agregadas de audiência (quantas pessoas
          visitaram cada página e o desempenho de carregamento), sem
          identificação pessoal e sem qualquer ligação com respostas de quiz.
        </p>
      </>
    ),
  },
  {
    id: "limitacoes",
    number: "6",
    navLabel: "Limitações e correções",
    title: "Limitações e correções",
    body: (
      <>
        <p>
          Extrair posições de PDFs de campanha é trabalho editorial, não uma
          operação automática e infalível.{" "}
          <strong className="font-semibold text-slate-800">
            Pode conter erro
          </strong>
          : um trecho pode ser lido fora de contexto, uma proposta deliberadamente
          ambígua pode ser classificada de um jeito que outra leitura razoável
          contestaria, uma revisão pode deixar passar uma contradição interna do
          documento. Assumimos isso na frente, e não atrás.
        </p>
        <p>
          A cobertura é desigual entre candidaturas. As maiores tendem a ter
          propostas de governo longas e detalhadas, além de histórico
          legislativo com votações nominais; várias candidaturas menores têm
          documentos curtos, genéricos ou apenas o programa do partido. O
          resultado prático é que elas aparecem com menos temas comparáveis.
          Isso é uma limitação de fonte, não um juízo de valor sobre a
          candidatura.
        </p>
        <p>
          A plataforma{" "}
          <strong className="font-semibold text-slate-800">
            não é uma recomendação de voto
          </strong>
          . O percentual mede a proximidade entre suas respostas e o que está
          documentado — não mede capacidade de governo, viabilidade das
          propostas, coerência entre discurso e prática, histórico pessoal ou
          honestidade. Um percentual alto é um ponto de partida para pesquisar,
          não uma conclusão.
        </p>
        <p>
          Toda posição exibida tem um caminho de{" "}
          <strong className="font-semibold text-slate-800">reportar</strong>. As
          correções aceitas entram em um registro público com data, o que
          mudou e a justificativa da mudança. Erros não são apagados em
          silêncio: o histórico fica visível, inclusive o desta metodologia.
        </p>
      </>
    ),
  },
  {
    id: "mudancas",
    number: "7",
    navLabel: "Histórico de mudanças",
    title: "Histórico de mudanças",
    body: (
      <>
        <p>
          Esta metodologia tem número de versão, e o número exibido no topo da
          página é o da entrada mais recente desta lista. Toda mudança no
          cálculo de compatibilidade entra aqui, com data, o que mudou na conta
          e por quê. Se um percentual que você viu antes não bate com o de
          hoje, a explicação está abaixo — nada é alterado em silêncio.
        </p>
        <p>
          <strong className="font-semibold text-slate-800">
            Versão 2.5 · 28 de agosto de 2026 — piso de temas e peso no lugar
            certo.
          </strong>{" "}
          Duas correções no cálculo, e as duas mudam percentuais que já tinham
          sido exibidos.
        </p>
        <p>
          A primeira. Uma candidatura com um único tema documentado, se aquele
          tema casasse com a sua resposta, exibia 100% e passava à frente de
          outra com catorze temas e 90%. O rótulo embaixo dizia a verdade — “1
          de 1 tema comparável” —, mas quem fala alto é a barra e a posição na
          lista. Entraram duas travas. Um{" "}
          <strong className="font-semibold text-slate-800">
            piso de temas comparáveis
          </strong>
          : abaixo de três temas — dois, se você respondeu quatro perguntas ou
          menos —, a plataforma não publica percentual nenhum e diz “base
          insuficiente”. E{" "}
          <strong className="font-semibold text-slate-800">
            três temas virtuais
          </strong>{" "}
          valendo 75%, o ponto de “não sabemos nada sobre esta candidatura”,
          que puxam o resultado para esse meio enquanto há pouca evidência e se
          diluem conforme os temas documentados aumentam. Na tela, a
          consequência é que ninguém chega a 100%: o teto passou a ser 88% com
          três temas comparados, 95% com treze e 96% com dezoito.
        </p>
        <p>
          A segunda. Esses três temas virtuais estavam sendo somados ao{" "}
          <strong className="font-semibold text-slate-800">peso</strong>, e não
          à{" "}
          <strong className="font-semibold text-slate-800">
            contagem de temas
          </strong>
          . Como o peso vem da importância que você declara para cada eixo, o
          teto exibido variava com essa declaração: a mesma concordância total
          em três temas saía como 83%, 88% ou 90% conforme a importância dada
          ao eixo em que a proposta por acaso se pronunciou. Duas candidaturas
          igualmente alinhadas podiam ser ordenadas pelo acaso documental. Está
          corrigido — dizer que um tema importa muito não documenta nenhuma
          posição a mais, logo não pode comprar certeza —, e teto e piso passam
          a depender apenas de quantos temas foram efetivamente comparados.
        </p>
        <p className="rounded-lg border border-slate-200 bg-white px-3.5 py-3 font-mono text-xs leading-[1.55] text-slate-700">
          antes (2.1): round((1 − somaPonderada / (pesoTotal × 16)) × 100)
          <br />
          agora (2.5): round((1 − (nTemas × distânciaMédia² + 3 × 4) / ((nTemas
          + 3) × 16)) × 100)
        </p>
        <p>
          <strong className="font-semibold text-slate-800">
            Versão 2.1 · 25 de agosto de 2026 — primeira publicação.
          </strong>{" "}
          A compatibilidade era a distância euclidiana quadrática ponderada
          entre as suas respostas e as posições documentadas, normalizada
          apenas pelo peso total. Não havia piso de temas nem qualquer correção
          para a desigualdade de cobertura: dois temas comparáveis e vinte
          produziam números na mesma escala, de 0% a 100%, e nada na lista
          distinguia um do outro. É a versão que esteve no ar até a mudança
          acima.
        </p>
      </>
    ),
  },
];

// ============================================================
// Data
// ============================================================

const MONTHS = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

/** Formata uma data ISO sem depender de fuso ou locale do runtime. */
function formatUpdatedAt(iso: string): string {
  const [year, month, day] = iso.split("T")[0].split("-").map(Number);
  const monthName = MONTHS[(month ?? 1) - 1] ?? "";
  return `${day} de ${monthName} de ${year}`;
}

// ============================================================
// Page
// ============================================================

export default function Metodologia() {
  const { updatedAt, version } = useLoaderData<typeof loader>();
  const [activeId, setActiveId] = useState<string>(SECTIONS[0].id);

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (typeof IntersectionObserver === "undefined") return;

    const nodes = SECTIONS.map((section) =>
      document.getElementById(section.id)
    ).filter((node): node is HTMLElement => node !== null);

    if (nodes.length === 0) return;

    const visible = new Set<string>();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            visible.add(entry.target.id);
          } else {
            visible.delete(entry.target.id);
          }
        }

        // A seção ativa é a primeira (em ordem de documento) ainda visível
        // dentro da faixa de leitura definida pelo rootMargin.
        const current = SECTIONS.find((section) => visible.has(section.id));
        if (current) setActiveId(current.id);
      },
      { rootMargin: "-96px 0px -55% 0px", threshold: 0 }
    );

    nodes.forEach((node) => observer.observe(node));

    return () => observer.disconnect();
  }, []);

  return (
    <main id={MAIN_CONTENT_ID}>
      <Container className="py-10">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[240px_1fr]">
          {/* Trilha lateral */}
          <nav
            aria-label="Nesta página"
            className="hidden content-start gap-2.5 lg:sticky lg:top-24 lg:grid lg:self-start"
          >
            <span className="text-xs font-bold tracking-[0.06em] text-slate-500 uppercase">
              Nesta página
            </span>
            {SECTIONS.map((section) => {
              const isActive = section.id === activeId;
              return (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  aria-current={isActive ? "true" : undefined}
                  className={cn(
                    "focus-ring flex min-h-11 items-center rounded-lg text-sm transition-colors",
                    isActive
                      ? "font-semibold text-indigo-600"
                      : "text-slate-500 hover:text-slate-800"
                  )}
                >
                  {section.navLabel}
                </a>
              );
            })}
          </nav>

          {/*
            Conteúdo. A medida é dada em `ch`, não em pixels: 720px de Inter a
            16px davam ~90 caracteres por linha, e acima de ~75 o olho erra a
            linha no retorno — nesta página, que é a mais densa do site em texto
            corrido, isso custa leitura de verdade. `64ch` fica em ~74. Em `ch`
            porque a medida acompanha a fonte: se a Inter não carregar e a
            substituta for mais larga, a contagem de caracteres continua a
            mesma, o que um `max-w-[585px]` não garantiria. A borda esquerda não
            se move, então o alinhamento com o `Container` segue de pé.
          */}
          <div className="grid max-w-[64ch] gap-[26px]">
            <header className="grid gap-2">
              <h1 className="font-heading text-4xl font-bold tracking-[-0.02em] text-slate-800">
                Metodologia
              </h1>
              <p className="text-sm text-slate-500">
                Versão {version} · atualizada em {formatUpdatedAt(updatedAt)} ·{" "}
                <a
                  href="#mudancas"
                  className="focus-ring font-medium text-indigo-600 underline underline-offset-2"
                >
                  histórico de mudanças público
                </a>
              </p>
              <p className="mt-1 text-base leading-[1.7] text-pretty text-slate-600">
                Esta página é o contrato público da plataforma. Ela descreve, sem
                atalhos, de onde vem cada dado, como uma posição vira um ponto na
                escala, como a compatibilidade é calculada, o que fazemos para
                não colocar o dedo na balança e onde a plataforma reconhece que
                pode errar. Se algo aqui não for cumprido no produto, é bug — e
                pode ser cobrado.
              </p>
            </header>

            {/*
              O índice do mobile. A trilha lateral acima é `lg:` e desaparece
              abaixo de 1024px — onde a página vira sete seções numeradas em
              rolagem contínua, sem sumário e sem caminho direto para a seção
              citada num link.

              `<details>` e não um estado em React: o elemento nativo já abre e
              fecha pelo teclado, anuncia o próprio estado e funciona antes da
              hidratação. Fechado por padrão porque aberto ele comeria a
              primeira tela inteira antes da primeira frase do texto.
            */}
            <nav aria-label="Nesta página" className="lg:hidden">
              <details className="group rounded-2xl border border-slate-200 bg-white">
                <summary className="focus-ring flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-4 text-sm font-semibold text-slate-800 [&::-webkit-details-marker]:hidden">
                  Nesta página
                  <ChevronDown
                    className="size-4 shrink-0 text-slate-500 transition-transform group-open:rotate-180 motion-reduce:transition-none"
                    aria-hidden="true"
                  />
                </summary>
                <ol className="grid px-2 pb-2">
                  {SECTIONS.map((section) => (
                    <li key={section.id}>
                      <a
                        href={`#${section.id}`}
                        className="focus-ring flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm text-slate-600"
                      >
                        <span className="text-indigo-600 tabular-nums">
                          {section.number}.
                        </span>
                        {section.navLabel}
                      </a>
                    </li>
                  ))}
                </ol>
              </details>
            </nav>

            {SECTIONS.map((section) => (
              <section key={section.id} id={section.id} className="scroll-mt-24">
                <h2 className="text-lg font-bold text-slate-800">
                  <span className="text-indigo-600">{section.number}.</span>{" "}
                  {section.title}
                </h2>
                <div className="mt-2 grid gap-3 text-base leading-[1.7] text-pretty text-slate-600">
                  {section.body}
                </div>
              </section>
            ))}

            <aside className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm leading-relaxed text-slate-600">
              <p>
                <strong className="font-semibold text-slate-800">
                  Achou um erro?
                </strong>{" "}
                Toda posição tem um caminho de reportar, e você também pode
                escrever para{" "}
                <a
                  href="mailto:contato@emquemvotar.app"
                  className="focus-ring font-medium text-indigo-600 underline underline-offset-2"
                >
                  contato@emquemvotar.app
                </a>
                . Correções apontando trecho e documento são analisadas primeiro.
                O que for confirmado é corrigido na fonte do dado e registrado no
                log público de correções, com data, descrição da mudança e
                justificativa — inclusive quando o erro foi nosso. Nada é
                alterado em silêncio, e esta metodologia segue a mesma regra.
              </p>
            </aside>
          </div>
        </div>
      </Container>
    </main>
  );
}
