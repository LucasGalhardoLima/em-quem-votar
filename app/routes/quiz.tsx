import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Check } from "lucide-react";
import type { Route } from "./+types/quiz";
import { pageMeta } from "~/root";
import { Container, MAIN_CONTENT_ID } from "~/components/layout";
import { useQuizHydration, useQuizStore } from "~/stores/quizStore";
import {
  IMPORTANCE_LABELS,
  IMPORTANCE_LEVELS,
  USER_STANCE_LABELS,
  type ImportanceLevel,
} from "~/lib/stance";
import { db } from "~/utils/db.server";
import { cn } from "~/lib/utils";

export function meta({}: Route.MetaArgs) {
  return [
    ...pageMeta({
      title: "Quiz — descubra quais candidaturas mais se aproximam de você",
      description:
        "Responda ao quiz e compare suas respostas com as posições documentadas dos candidatos à Presidência. Sem cadastro: as respostas ficam no seu aparelho.",
      type: "website",
    }),
    { name: "robots", content: "index,follow" },
  ];
}

export async function loader({}: Route.LoaderArgs) {
  const questions = await db.quizQuestion.findMany({
    where: { isActive: true },
    orderBy: { order: "asc" },
    include: {
      topic: { select: { slug: true, name: true, category: true, order: true } },
      options: { orderBy: { stanceValue: "asc" } },
    },
  });

  return {
    questions: questions.map((q) => ({
      id: q.id,
      text: q.text,
      topicSlug: q.topic.slug,
      topicName: q.topic.name,
      topicCategory: q.topic.category,
      options: q.options.map((o) => ({
        id: o.id,
        label: o.label || USER_STANCE_LABELS[o.stanceValue] || "",
        description: o.description,
        stanceValue: o.stanceValue,
      })),
    })),
  };
}

/**
 * Atraso entre tocar numa opção e a etapa seguinte aparecer.
 *
 * Não é enfeite: sem pausa a tela troca no mesmo quadro do toque e a pessoa
 * não chega a ver a própria escolha marcada — fica sem saber se registrou a
 * resposta certa. Curto o bastante para não parecer travamento, longo o
 * bastante para a borda e o "✓" aparecerem antes da troca. Tocar outra opção
 * dentro da janela cancela e reinicia o relógio.
 */
const AUTO_ADVANCE_MS = 350;

const HINT_ID = "quiz-dica-avancar";
const WEIGHT_ID = "quiz-peso-eixo";

/**
 * Altura do cabeçalho do site, medida em tempo de execução.
 *
 * A barra de progresso precisa ficar grudada LOGO ABAIXO do `SiteHeader`, que
 * é `sticky top-0` e mora em `root.tsx` — fora deste arquivo. Cravar a altura
 * aqui como número resolveria hoje e quebraria em silêncio na primeira vez que
 * alguém mexesse no cabeçalho: a barra passaria a flutuar sobre ele ou a
 * abrir um vão, e nada no código acusaria. O `ResizeObserver` também cobre o
 * caso em que o cabeçalho CRESCE — é o que acontece quando o menu do telefone
 * abre, porque a navegação mobile vive dentro do mesmo `<header>`.
 *
 * No SSR o valor é 0 e a barra encosta no topo; ela se corrige na montagem,
 * antes de existir rolagem para revelar a diferença.
 */
function useStickyHeaderOffset(): number {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const header = document.querySelector("header");
    if (!header) return;
    const update = () => setOffset(header.getBoundingClientRect().height);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(header);
    return () => observer.disconnect();
  }, []);

  return offset;
}

export default function Quiz({ loaderData }: Route.ComponentProps) {
  const { questions } = loaderData;
  const navigate = useNavigate();
  const hydrated = useQuizHydration();
  const headerOffset = useStickyHeaderOffset();

  const [index, setIndex] = useState(0);
  const [hint, setHint] = useState(false);
  /** Índice da pergunta → controle de peso aberto, sobrepondo o padrão do eixo. */
  const [weightOverride, setWeightOverride] = useState<Record<number, boolean>>(
    {},
  );

  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(false);

  const answers = useQuizStore((s) => s.answers);
  const weights = useQuizStore((s) => s.weights);
  const setAnswer = useQuizStore((s) => s.setAnswer);
  const clearAnswer = useQuizStore((s) => s.clearAnswer);
  const setWeight = useQuizStore((s) => s.setWeight);

  const total = questions.length;
  const question = questions[index];

  /**
   * Posição do EIXO temático, não do tema: os 20 temas estão agrupados em
   * categorias, e é a categoria que carrega o peso. A pílula acima do
   * enunciado é que diz o tema.
   */
  const axisPosition = useMemo(() => {
    if (!question) return { current: 0, total: 0 };
    const categories = [...new Set(questions.map((q) => q.topicCategory))];
    return {
      current: categories.indexOf(question.topicCategory) + 1,
      total: categories.length,
    };
  }, [questions, question]);

  /** Quantas perguntas o peso deste eixo cobre — é o que a frase promete. */
  const axisQuestionCount = useMemo(
    () =>
      question
        ? questions.filter((q) => q.topicCategory === question.topicCategory)
            .length
        : 0,
    [questions, question],
  );

  /**
   * Troca de pergunta devolve o foco ao enunciado.
   *
   * Sem isto o auto-avanço desmonta o botão que estava com o foco e ele cai no
   * `<body>`: quem usa leitor de tela não é avisado de que a pergunta mudou e
   * quem usa teclado recomeça a tabulação do topo do documento. Levar o foco
   * ao `<h1>` (que ganha `tabIndex={-1}` só para isso) anuncia o novo
   * enunciado e deixa a próxima tabulação cair nas opções.
   *
   * A rolagem é explícita e o foco vem com `preventScroll`, porque o navegador
   * alinharia o `<h1>` ao topo do viewport — ou seja, embaixo do cabeçalho e
   * da barra de progresso, os dois grudados.
   */
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    setHint(false);
    window.scrollTo({ top: 0 });
    headingRef.current?.focus({ preventScroll: true });
  }, [index]);

  useEffect(() => {
    return () => {
      if (advanceTimer.current !== null) clearTimeout(advanceTimer.current);
    };
  }, []);

  if (total === 0) {
    return (
      <main id={MAIN_CONTENT_ID} className="flex-1">
        <Container className="py-20 text-center">
          <h1 className="font-heading text-2xl font-bold text-slate-800">
            O quiz ainda não está disponível
          </h1>
          <p className="mx-auto mt-3 max-w-md text-base text-slate-500">
            As perguntas ainda não foram carregadas neste ambiente. Enquanto
            isso, você pode navegar pelos candidatos e ver as posições
            documentadas.
          </p>
          <Link
            to="/candidatos"
            className="focus-ring mt-6 inline-block rounded-xl bg-slate-800 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-900"
          >
            Ver os candidatos
          </Link>
        </Container>
      </main>
    );
  }

  if (!question) return null;

  const answer = hydrated ? answers[question.topicSlug] : undefined;
  const weight: ImportanceLevel =
    (hydrated ? weights[question.topicCategory] : undefined) ?? "medium";
  const isLast = index === total - 1;
  const canAdvance = answer !== undefined;

  /**
   * O controle de peso abre sozinho na PRIMEIRA pergunta de cada eixo e fica
   * recolhido nas outras.
   *
   * O peso é por eixo — quatro perguntas compartilham o mesmo — então repeti-lo
   * em todas era entrada redundante (WCAG 2.2 SC 3.3.7 no espírito) e era o
   * bloco que empurrava o "Próxima" para fora da tela. Recolhido não é
   * escondido: o botão do rodapé mostra o valor atual e reabre o controle na
   * mesma etapa, sem custar altura nas outras 18 perguntas.
   */
  const isFirstOfAxis =
    index === 0 ||
    questions[index - 1]?.topicCategory !== question.topicCategory;
  const weightOpen = weightOverride[index] ?? isFirstOfAxis;

  /**
   * A barra mede a pergunta atual, e não as concluídas — a mesma escala do
   * rótulo "Pergunta 1 de 24" e do `aria-valuenow` ao lado. Medir as
   * concluídas deixaria a trilha vazia na abertura, e a barra é a única
   * confirmação visual de que o quiz começou.
   */
  const progressPct = ((index + 1) / total) * 100;

  function clearAdvance() {
    if (advanceTimer.current !== null) {
      clearTimeout(advanceTimer.current);
      advanceTimer.current = null;
    }
  }

  function advance() {
    if (isLast) navigate("/resultado");
    else setIndex((i) => i + 1);
  }

  /**
   * "Próxima" fica SEMPRE habilitada, e a recusa é dita em texto.
   *
   * Botão desabilitado não recebe foco, não entra na tabulação e não tem onde
   * pendurar o motivo: quem chega nele pelo teclado não descobre que ele
   * existe, e quem chega pelo toque vê um retângulo cinza sem explicação. Aqui
   * o botão responde, a mensagem aparece num `role="status"` (portanto é
   * anunciada) e o foco vai para a primeira opção — que é onde a ação
   * pendente está.
   */
  function goNext() {
    clearAdvance();
    if (!canAdvance) {
      setHint(true);
      optionRefs.current[0]?.focus();
      return;
    }
    advance();
  }

  function goBack() {
    clearAdvance();
    setIndex((i) => Math.max(0, i - 1));
  }

  function skip() {
    clearAdvance();
    clearAnswer(question.topicSlug);
    advance();
  }

  /**
   * Roving tabindex + setas — o contrato de um `role="radiogroup"`. Sem isso
   * o grupo consome uma parada de tabulação por opção e o leitor de tela
   * anuncia "radio 1 de 5" enquanto as setas não fazem nada. A seta seleciona
   * ao mover, como num grupo de rádio nativo.
   */
  const answeredIndex = question.options.findIndex(
    (o) => o.stanceValue === answer,
  );
  const rovingIndex = answeredIndex >= 0 ? answeredIndex : 0;

  function selectOption(position: number) {
    const option = question.options[position];
    if (!option) return;
    setAnswer(question.topicSlug, option.stanceValue);
    setHint(false);
    optionRefs.current[position]?.focus();
  }

  /**
   * Selecionar avança sozinho — mas só quando o toque veio de ponteiro.
   *
   * São 24 perguntas com uma escolha exclusiva cada; exigir "escolher" e
   * depois "Próxima" custa 48 toques para 24 decisões. O avanço automático
   * corta isso pela metade e nada se perde: o "Voltar" continua ao lado e o
   * atraso deixa a marcação visível antes da troca.
   *
   * O guarda `event.detail === 0` é o que torna isso seguro no teclado, e não
   * é detalhe. Num `<button>`, Enter e Espaço disparam um clique SINTÉTICO com
   * `detail` 0, enquanto mouse e toque trazem 1 ou mais. Sem o guarda, quem
   * navega pelas opções confirmando com Espaço seria jogado para a pergunta
   * seguinte no mesmo instante — e as setas, que selecionam ao mover num
   * radiogroup, transformariam uma varredura da escala numa corrida pelo quiz
   * inteiro. (As setas não passam por aqui: chamam `selectOption`. O guarda
   * cobre a outra porta.)
   *
   * A última pergunta nunca avança sozinha: dali o passo seguinte é sair do
   * quiz para "/resultado", e trocar de página é decisão de quem responde.
   */
  function onOptionClick(
    event: React.MouseEvent<HTMLButtonElement>,
    position: number,
  ) {
    const option = question.options[position];
    if (!option) return;
    clearAdvance();
    setAnswer(question.topicSlug, option.stanceValue);
    setHint(false);
    if (event.detail === 0 || isLast) return;
    advanceTimer.current = setTimeout(() => {
      advanceTimer.current = null;
      setIndex((i) => Math.min(i + 1, total - 1));
    }, AUTO_ADVANCE_MS);
  }

  function onOptionKeyDown(
    event: React.KeyboardEvent<HTMLButtonElement>,
    position: number,
  ) {
    const count = question.options.length;
    if (count === 0) return;
    let next: number;
    switch (event.key) {
      case "ArrowDown":
      case "ArrowRight":
        next = (position + 1) % count;
        break;
      case "ArrowUp":
      case "ArrowLeft":
        next = (position - 1 + count) % count;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = count - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    selectOption(next);
  }

  /**
   * Sair do quiz (pergunta 1 → "/") e concluí-lo (última → "/resultado") são
   * mudanças de rota, não estado local: viram `<Link>` para poderem ser
   * abertas em nova aba, copiadas e anunciadas como link. Como cada controle
   * troca de elemento conforme o índice, as classes ficam em constantes.
   *
   * `min-h-11` e o recuo horizontal existem para o alvo, não para o texto:
   * "Voltar" e "Pular este tema" são texto de 14px, e sem eles o alvo tocável
   * teria a altura da linha — abaixo dos 24×24 do SC 2.5.8 e muito abaixo dos
   * 44px que a mão realmente usa. O `-mx-2` devolve o recuo à régua da coluna
   * para que o texto continue alinhado com o enunciado.
   */
  const quietClass =
    "focus-ring -mx-2 inline-flex min-h-11 items-center rounded-xl px-2 text-sm font-semibold text-slate-500 transition-colors hover:text-slate-800";
  const nextClass =
    "focus-ring inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-800 px-7 py-3 text-base font-bold text-white transition-colors hover:bg-slate-900";
  const nextLabel = (
    <>
      {isLast ? "Ver resultado" : "Próxima"} <span aria-hidden="true">→</span>
    </>
  );

  return (
    <main id={MAIN_CONTENT_ID} className="flex-1">
      {/*
        Grudada logo abaixo do cabeçalho do site (ver `useStickyHeaderOffset`).
        Num fluxo de 24 etapas o indicador de progresso é o que sustenta a
        decisão de continuar; sair de vista na primeira rolagem apagava a única
        informação que responde "falta muito?". `z-30` fica sob o `z-40` do
        cabeçalho, então os dois empilham sem se cobrir.
      */}
      <div
        className="sticky z-30 border-b border-slate-200 bg-white/95 backdrop-blur-sm"
        style={{ top: headerOffset }}
      >
        <Container className="flex items-baseline justify-between gap-3 pt-2 pb-1.5 text-xs text-slate-500">
          <span className="flex-none">
            <strong className="font-semibold text-slate-800">
              Pergunta {index + 1}
            </strong>{" "}
            de {total}
          </span>
          <span className="truncate">
            {question.topicCategory} · eixo {axisPosition.current} de{" "}
            {axisPosition.total}
          </span>
        </Container>
        <div
          className="h-1 bg-slate-200"
          role="progressbar"
          aria-valuenow={index + 1}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-label="Progresso do quiz"
        >
          <div
            className="h-full bg-indigo-600 transition-[width] duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      <div className="mx-auto w-full max-w-[640px] px-5 pt-5 pb-8 sm:px-10 sm:pt-8">
        {/*
          Tracking 0.04em, e não os 0.06em usados nos demais rótulos em caixa
          alta: a 12px o nome de tema mais longo ("Mandato nos tribunais
          superiores") passa dos 280px úteis num viewport de 320px e a pílula
          quebra em duas linhas. Estreitar o tracking devolve a folga.
        */}
        <span className="inline-block rounded-full border border-indigo-600/[0.12] bg-indigo-600/[0.06] px-2.5 py-1 text-xs font-bold tracking-[0.04em] text-indigo-600 uppercase">
          {question.topicName}
        </span>

        {/*
          20px no telefone, e não os 24px de antes. O enunciado mais longo do
          banco tem 168 caracteres: a 24px ele ocupava sete linhas e 210px de
          altura sozinho, e era metade da razão de o botão de avançar nascer
          fora da tela. A 20px cabe em seis linhas sem deixar de ser, com folga,
          o maior texto da etapa — o seguinte tem 16px.
        */}
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="font-heading mt-3 text-xl leading-[1.3] font-bold tracking-[-0.01em] text-pretty text-slate-800 sm:text-2xl"
        >
          {question.text}
        </h1>

        {/*
          A coluna de 12px à esquerda das opções é o que diz que as cinco
          formam UMA escala.

          Empilhadas sem pista nenhuma, as cinco caixas são visualmente
          idênticas e obrigam a reler os cinco rótulos a cada pergunta — 24
          vezes. A pista tem duas partes: a linha contínua que atravessa os
          cinco pontos (são posições de um mesmo contínuo, não cinco itens
          soltos) e o tamanho do ponto, que cresce conforme a resposta se
          afasta do meio.

          O tamanho é SIMÉTRICO de propósito: mede convicção, não direção —
          "discordo totalmente" e "concordo totalmente" recebem exatamente o
          mesmo ponto. Nenhuma cor entra na conta, porque tingir uma ponta de
          verde e a outra de vermelho seria dizer que existe resposta certa,
          que é justamente o que a regra de neutralidade proíbe. O indigo só
          marca a opção escolhida, como no resto do site.

          Os pontos são `aria-hidden`: não acrescentam informação nenhuma ao
          que o rótulo já diz, e o radiogroup já anuncia "1 de 5".
        */}
        <div
          className="mt-4 grid grid-cols-[12px_1fr] items-stretch gap-x-3 gap-y-2"
          role="radiogroup"
          aria-label="Sua resposta"
        >
          {question.options.map((option, position) => {
            const selected = answer === option.stanceValue;
            const last = position === question.options.length - 1;
            const middle = (question.options.length - 1) / 2;
            const intensity =
              middle === 0 ? 0 : Math.abs(position - middle) / middle;
            return (
              <Fragment key={option.id}>
                <span
                  aria-hidden="true"
                  className="relative flex items-center justify-center"
                >
                  <span
                    className={cn(
                      "absolute left-1/2 w-px -translate-x-1/2 bg-slate-200",
                      position === 0
                        ? "top-1/2 -bottom-2"
                        : last
                          ? "-top-2 bottom-1/2"
                          : "-top-2 -bottom-2",
                    )}
                  />
                  <span
                    className={cn(
                      "relative rounded-full transition-colors",
                      intensity > 0.66
                        ? "size-2.5"
                        : intensity > 0.33
                          ? "size-2"
                          : "size-1.5",
                      selected ? "bg-indigo-600" : "bg-slate-300",
                    )}
                  />
                </span>
                <button
                  ref={(el) => {
                    optionRefs.current[position] = el;
                  }}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  tabIndex={position === rovingIndex ? 0 : -1}
                  onKeyDown={(event) => onOptionKeyDown(event, position)}
                  onClick={(event) => onOptionClick(event, position)}
                  className={cn(
                    "focus-ring flex items-center justify-between gap-3 rounded-xl px-[18px] text-left text-base transition-colors",
                    selected
                      ? "border-2 border-indigo-600 bg-indigo-600/[0.06] py-3 font-bold text-slate-800"
                      : "border border-slate-200 bg-white py-[13px] font-medium text-slate-600 hover:border-indigo-300",
                  )}
                >
                  <span>
                    {option.label}
                    {option.description && (
                      <span className="mt-0.5 block text-xs font-normal text-slate-500">
                        {option.description}
                      </span>
                    )}
                  </span>
                  {selected && (
                    <Check className="size-4 flex-none text-indigo-600" aria-hidden="true" />
                  )}
                </button>
              </Fragment>
            );
          })}
        </div>

        {/* `hidden` em vez de desmontar: o botão do rodapé aponta para este
            bloco por `aria-controls`, e uma referência para um id que às vezes
            não existe é uma referência quebrada metade do tempo. Escondido
            assim ele também sai da tabulação e da árvore de acessibilidade. */}
        <div id={WEIGHT_ID} hidden={!weightOpen} className="mt-5">
          <p className="text-xs text-slate-500">
            Quanto{" "}
            <strong className="font-semibold text-slate-700">
              {question.topicCategory}
            </strong>{" "}
            pesa para você — vale para as {axisQuestionCount} perguntas deste
            eixo.
          </p>
          <div
            className="mt-1.5 flex gap-1.5"
            role="group"
            aria-label={`Peso de ${question.topicCategory}`}
          >
            {IMPORTANCE_LEVELS.map((level) => {
              const active = weight === level;
              return (
                <button
                  key={level}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setWeight(question.topicCategory, level)}
                  className={cn(
                    "focus-ring inline-flex min-h-11 items-center justify-center rounded-full border px-3.5 py-1.5 text-xs transition-colors",
                    active
                      ? "border-slate-800 bg-slate-800 font-bold text-white"
                      : "border-slate-200 bg-white font-semibold text-slate-500 hover:border-slate-300",
                  )}
                >
                  {IMPORTANCE_LABELS[level]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Sempre no DOM para que a mensagem seja ANUNCIADA quando aparecer:
            um `role="status"` montado junto com o texto costuma não disparar
            leitura em parte dos leitores de tela. A margem é que é
            condicional, para a etapa não guardar um vão vazio. */}
        <p
          id={HINT_ID}
          role="status"
          className={cn("text-sm text-slate-600", hint && "mt-4")}
        >
          {hint
            ? "Escolha uma das cinco opções para continuar — ou use “Pular este tema”."
            : ""}
        </p>

        <div className="mt-5 flex items-center justify-between gap-3">
          {index === 0 ? (
            <Link to="/" className={quietClass}>
              ← Voltar
            </Link>
          ) : (
            <button type="button" onClick={goBack} className={quietClass}>
              ← Voltar
            </button>
          )}
          {isLast && canAdvance ? (
            <Link to="/resultado" className={nextClass}>
              {nextLabel}
            </Link>
          ) : (
            <button
              type="button"
              onClick={goNext}
              aria-describedby={HINT_ID}
              className={nextClass}
            >
              {nextLabel}
            </button>
          )}
        </div>

        <div className="mt-1 flex items-center justify-between gap-3">
          <button type="button" onClick={skip} className={quietClass}>
            Pular este tema
          </button>
          <button
            type="button"
            aria-expanded={weightOpen}
            aria-controls={WEIGHT_ID}
            onClick={() =>
              setWeightOverride((prev) => ({ ...prev, [index]: !weightOpen }))
            }
            className={quietClass}
          >
            Peso do eixo: {IMPORTANCE_LABELS[weight]}
          </button>
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          Pode sair e voltar depois — as respostas ficam no seu aparelho e nada
          é enviado ao servidor.
        </p>
      </div>
    </main>
  );
}
