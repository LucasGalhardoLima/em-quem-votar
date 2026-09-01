import { Link } from "react-router";
import {
  AGREEMENT_CHIP_CLASS,
  agreementFor,
  candidateStanceLabel,
  hasPosition,
  NO_QUIZ_LABEL,
  SKIPPED_LABEL,
  userStanceLabel,
} from "~/lib/stance";
import { cn } from "~/lib/utils";
import { NoSourceNotice, SourceCite } from "./SourceCite";

export interface TopicRow {
  topicSlug: string;
  topicName: string;
  topicCategory: string;
  stance: number | null;
  description: string | null;
  sourceType: string | null;
  sourceUrl: string | null;
  sourceDocument: string | null;
  sourcePage: number | null;
  sourceQuote: string | null;
  sourceDate: string | null;
}

const UNDOCUMENTED_ID = "temas-sem-posicao";

/**
 * Posições por tema. Com quiz respondido, vira "compatibilidade por tema" e
 * ganha a coluna da resposta da pessoa e o chip de proximidade.
 *
 * Célula vazia é informação — mas informação NÃO é a mesma frase repetida.
 * Hoje 210 das 211 candidaturas não têm nenhuma posição aprovada, então a
 * versão anterior desta tela era, para quase todo mundo, 24 cartões idênticos
 * dizendo "Sem posição registrada" um debaixo do outro: mesma altura de
 * página que uma ficha inteiramente documentada, zero informação a mais que a
 * primeira linha, e o que a página REALMENTE tem (proposta protocolada, bens,
 * histórico) empurrado para fora da primeira dobra.
 *
 * A ausência continua sendo dita, e dita com precisão — só deixa de ser dita
 * 24 vezes. Os temas documentados ficam em cartão inteiro; os sem documento
 * viram uma lista agrupada por eixo, com a explicação escrita UMA vez.
 *
 * A explicação também para de escorregar para uma afirmação que não
 * sustentamos. "Sem posição registrada" descreve o NOSSO acervo, não a
 * candidatura: não sabemos distinguir "não existe documento público sobre o
 * tema" de "existe e ainda não foi lido e aprovado aqui" — são estados
 * diferentes do mundo e a plataforma só tem evidência do segundo. É a mesma
 * disciplina de `tseAssetsDeclared` no schema, onde `null` (não sabemos) e `0`
 * (a ficha declara zero) são colunas distintas justamente para que a página
 * não afirme uma quando só tem a outra.
 */
export function PositionsByTopic({
  rows,
  answers,
  hasQuiz,
}: {
  rows: TopicRow[];
  answers: Record<string, number>;
  hasQuiz: boolean;
}) {
  if (rows.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
        Nenhum tema cadastrado ainda para esta eleição.
      </p>
    );
  }

  const documented = rows.filter((row) => hasPosition(row.stance));
  const undocumented = rows.filter((row) => !hasPosition(row.stance));

  /**
   * A ordem dos eixos sai de TODOS os temas, não só dos que sobraram.
   *
   * Os eixos se intercalam na ordem dos temas, então agrupar pela primeira
   * aparição na lista filtrada dava uma ordem de eixos diferente em cada
   * ficha — a mesma lista de seis eixos embaralhada conforme quem está mais
   * documentado. Ancorando na lista completa, o bloco tem a mesma ordem em
   * toda candidatura, que é a regra de peso visual idêntico aplicada ao
   * layout.
   */
  const categoryOrder: string[] = [];
  for (const row of rows) {
    if (!categoryOrder.includes(row.topicCategory))
      categoryOrder.push(row.topicCategory);
  }
  const groups = categoryOrder
    .map((category) => ({
      category,
      names: undocumented
        .filter((row) => row.topicCategory === category)
        .map((row) => row.topicName),
    }))
    .filter((group) => group.names.length > 0);

  return (
    <div className="grid gap-4">
      <PositionsSummary
        documented={documented.length}
        total={rows.length}
        hasQuiz={hasQuiz}
      />

      {documented.length > 0 && (
        <div className="grid gap-2.5">
          {documented.map((row) => (
            <DocumentedTopic
              key={row.topicSlug}
              row={row}
              userStance={answers[row.topicSlug]}
              hasQuiz={hasQuiz}
            />
          ))}
        </div>
      )}

      {undocumented.length > 0 && (
        <UndocumentedTopics
          count={undocumented.length}
          groups={groups}
          hasQuiz={hasQuiz}
        />
      )}
    </div>
  );
}

/**
 * O contador vem ANTES da lista, e não depois dela.
 *
 * Enquanto ele vivia no rodapé da aba, a única forma de descobrir que a
 * candidatura tem zero tema documentado era rolar os 24 blocos até o fim — o
 * leitor pagava a altura inteira da página para receber a informação que
 * dispensava a rolagem.
 */
function PositionsSummary({
  documented,
  total,
  hasQuiz,
}: {
  documented: number;
  total: number;
  hasQuiz: boolean;
}) {
  return (
    <p className="text-sm leading-relaxed text-slate-600">
      <strong className="font-semibold text-slate-800 tabular-nums">
        {documented} de {total} temas
      </strong>{" "}
      com posição documentada nesta candidatura.{" "}
      {documented === 0
        ? "Uma posição só aparece aqui quando existe documento público que a sustente, com página e link. Enquanto não há, a plataforma não deduz nada a partir de partido, coligação ou aliados."
        : "Cada posição exibida cita documento, página e link. Onde não há documento, a plataforma diz que não há, em vez de inferir."}
      {hasQuiz && documented > 0
        ? " Só os temas documentados entram no cálculo de compatibilidade."
        : ""}{" "}
      <Link
        to="/metodologia"
        className="focus-ring rounded-sm font-semibold text-indigo-600 hover:text-indigo-700"
      >
        Ver metodologia
      </Link>
    </p>
  );
}

function DocumentedTopic({
  row,
  userStance,
  hasQuiz,
}: {
  row: TopicRow;
  userStance: number | undefined;
  hasQuiz: boolean;
}) {
  const agreement = agreementFor(row.stance, userStance, { hasQuiz });

  return (
    <article className="grid gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 sm:px-[22px] lg:grid-cols-[150px_1fr_1fr_130px] lg:items-center lg:gap-[18px]">
      {/* `slate-600`, não `indigo-600`. O indigo é o acento de interação do
          site, e o único elemento clicável do cartão é o link da fonte, logo
          abaixo: com o tema também em indigo, o cartão oferecia dois acentos e
          só um deles levava a algum lugar.

          O tamanho subiu de `text-xs` para `text-sm` junto com a h2 da seção.
          A h2 estava em 12px — menor que o corpo que ela rotula — e este h3
          empatava com ela; corrigir só a mãe deixaria a escala plana. Agora a
          ficha tem três degraus de cabeçalho de fato distintos (h1 24/30px,
          h2 18px, h3 14px) e a hierarquia de tom continua valendo por dentro:
          h2 `slate-800`, tema `slate-600` (7,58:1 sobre o branco do cartão),
          rótulos de coluna `slate-500`.

          `break-words` porque a coluna é uma faixa FIXA de 150px no `lg` e
          existe nome de tema que não cabe nela em token único —
          "Desmatamento/Amazônia" passa de 200px em caixa alta, e a barra não é
          ponto de quebra em CSS. Sem isto o nome vaza por cima da coluna
          vizinha, porque a faixa fixa não cresce. */}
      <h3 className="text-sm font-bold tracking-wider break-words text-slate-600 uppercase">
        {row.topicName}
      </h3>

      <div className="min-w-0">
        <p className="mb-0.5 text-xs text-slate-500">Posição do candidato</p>
        <p className="text-sm font-semibold text-slate-800">
          {candidateStanceLabel(row.stance)}
        </p>
        {row.description && (
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            {row.description}
          </p>
        )}
        <div className="mt-1.5">
          {row.sourceType ? (
            <SourceCite
              source={{
                sourceType: row.sourceType,
                sourceUrl: row.sourceUrl,
                sourceDocument: row.sourceDocument,
                sourcePage: row.sourcePage,
                sourceQuote: row.sourceQuote,
                sourceDate: row.sourceDate,
              }}
            />
          ) : (
            <NoSourceNotice />
          )}
        </div>
      </div>

      <div className="min-w-0">
        <p className="mb-0.5 text-xs text-slate-500">Sua resposta</p>
        <p
          className={cn(
            "text-sm font-semibold",
            !hasQuiz || !hasPosition(userStance)
              ? "text-slate-500"
              : "text-slate-800",
          )}
        >
          {!hasQuiz
            ? NO_QUIZ_LABEL
            : hasPosition(userStance)
              ? userStanceLabel(userStance)
              : SKIPPED_LABEL}
        </p>
      </div>

      <span
        className={cn(
          "w-fit rounded-full border px-3 py-1.5 text-xs font-bold lg:justify-self-end",
          AGREEMENT_CHIP_CLASS[agreement.kind],
        )}
      >
        {/* Aqui havia um ✓ para "próximo" e um ✕ para "distante", e eles
            saíram pelo mesmo motivo que o par verde/vermelho saiu de
            `AGREEMENT_CHIP_CLASS`: um check quer dizer "certo" e um ✕ quer
            dizer "errado", mas o chip não mede acerto — mede distância entre a
            resposta de quem lê e a posição documentada de uma pessoa real. A
            valência tinha só trocado de canal, do matiz para a forma, na mesma
            tela e sobre a mesma pessoa.

            Não foram trocados por outro par, e sim removidos. O rótulo ao lado
            já diz "próximo"/"distante" em palavras e o preenchimento do chip
            (tingido contra vazado) já separa os dois sem matiz. */}
        {agreement.label}
      </span>
    </article>
  );
}

/**
 * Os temas sem documento, agrupados por eixo temático.
 *
 * Um bloco, uma explicação, uma linha por eixo — em vez de um cartão por tema.
 * A informação que o leitor tira daqui é QUAIS temas estão descobertos, e
 * essa leitura fica melhor numa lista agrupada do que em 24 cartões de altura
 * fixa que ele precisa rolar para contar.
 */
function UndocumentedTopics({
  count,
  groups,
  hasQuiz,
}: {
  count: number;
  groups: { category: string; names: string[] }[];
  hasQuiz: boolean;
}) {
  return (
    <section
      aria-labelledby={UNDOCUMENTED_ID}
      className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-5 sm:px-[22px]"
    >
      <h3
        id={UNDOCUMENTED_ID}
        className="text-sm font-bold tracking-wider text-slate-600 uppercase"
      >
        Sem posição documentada · {count} {count === 1 ? "tema" : "temas"}
      </h3>
      {/*
        A frase antiga — "Sem posição registrada" — era curta e ambígua, e a
        ambiguidade caía sempre para o mesmo lado: soava como "esta candidatura
        não tem posição sobre isso". Não é o que sabemos. Os dois estados que a
        plataforma não distingue estão escritos aqui, em vez de resolvidos por
        um deles.
      */}
      <p className="mt-2 max-w-prose text-sm leading-relaxed text-slate-500">
        Sobre estes temas não há, nesta plataforma, posição lida e aprovada. Ou
        não existe documento público da candidatura sobre o tema, ou existe um
        que ainda não foi lido e aprovado aqui — a plataforma não afirma qual
        dos dois é o caso sem ter o dado para sustentar, e nada é deduzido de
        partido, coligação ou aliados.
        {hasQuiz
          ? " Temas sem documento ficam fora do cálculo de compatibilidade — não contam como concordância nem como discordância."
          : ""}
      </p>
      <dl className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {groups.map((group) => (
          <div key={group.category} className="min-w-0">
            <dt className="text-xs font-bold tracking-wider text-slate-500 uppercase">
              {group.category}
            </dt>
            <dd className="mt-0.5 text-sm leading-relaxed text-slate-600">
              {group.names.join(" · ")}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
