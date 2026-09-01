/**
 * Seed idempotente.
 *
 * Rodar duas vezes não duplica nada: tópicos e tags têm `slug` único,
 * posições têm a chave composta (candidato, tópico), as candidaturas casam
 * por `tseId` (ver `seedCandidates()`) e as perguntas do quiz casam por tema
 * (ver `seedQuiz()`).
 *
 * NENHUM BLOCO AQUI APAGA LINHA. O seed cria o que falta e preenche o que
 * está vazio; o que já existe e ele não descreve fica onde está. Se você
 * estiver prestes a escrever um `deleteMany`, leia primeiro o cabeçalho de
 * `seedQuiz()` — havia um lá, e o que ele arriscava não era teórico.
 *
 *   npx tsx prisma/seed.ts             # grava
 *   npx tsx prisma/seed.ts --dry-run   # só mostra o plano, não escreve nada
 *   npx prisma db seed -- --dry-run    # idem, pelo caminho do Prisma
 *
 * O `--dry-run` existe porque este arquivo escreve em banco compartilhado e a
 * pergunta "isto vai duplicar as candidaturas?" precisa ter resposta ANTES da
 * escrita, não depois.
 */

import { PrismaClient, type Prisma } from "@prisma/client";
import { LIKERT_OPTIONS, QUESTIONS, TAGS, TOPICS } from "./data/reference";
import { CANDIDATES_2026, type CandidateSeed } from "./data/candidates-2026";

const prisma = new PrismaClient();

const DRY_RUN = process.argv.includes("--dry-run");

async function seedTopics() {
  console.log("Tópicos políticos...");
  for (const topic of TOPICS) {
    if (DRY_RUN) continue;
    await prisma.politicalTopic.upsert({
      where: { slug: topic.slug },
      update: {
        name: topic.name,
        category: topic.category,
        description: topic.description,
        order: topic.order,
      },
      create: topic,
    });
  }
  return new Map(
    (await prisma.politicalTopic.findMany({ select: { id: true, slug: true } })).map(
      (t) => [t.slug, t.id],
    ),
  );
}

async function seedTags() {
  console.log("Tags...");
  for (const tag of TAGS) {
    if (DRY_RUN) continue;
    await prisma.tag.upsert({
      where: { slug: tag.slug },
      update: {
        name: tag.name,
        category: tag.category,
        description: tag.description,
      },
      create: tag,
    });
  }
}

/** Assinatura canônica das opções de uma pergunta, para comparar sem recriar. */
function optionsSignature(
  options: Array<{ label: string; stanceValue: number; order: number; icon: string | null }>,
): string {
  return [...options]
    .sort((a, b) => a.stanceValue - b.stanceValue)
    .map((o) => `${o.stanceValue}|${o.label}|${o.order}|${o.icon ?? ""}`)
    .join("¦");
}

/**
 * Perguntas do quiz, casadas POR TEMA.
 *
 * POR QUE NÃO `deleteMany({})`
 *
 * Era o que este bloco fazia, incondicionalmente, contra qualquer
 * `DATABASE_URL` — e o `.env` deste repositório aponta para o banco de
 * produção. Três coisas estavam em risco, em ordem de gravidade:
 *
 *   1. A JANELA VAZIA. Não há transação: entre o `deleteMany` e o fim do laço
 *      de `create`, `/quiz` devolve zero perguntas e `/resultado` conta zero.
 *      Se a execução morrer no meio (uma queda de rede contra o Supabase
 *      basta), o quiz fica parcial ou vazio até alguém rodar de novo — e o
 *      `deleteMany` já terá apagado o que existia.
 *   2. TEMA PERDIDO EM SILÊNCIO. O `deleteMany` apaga TODAS as perguntas; o
 *      laço recria só as que estão em `reference.ts`. Uma pergunta cujo tema
 *      não esteja no arquivo some sem uma linha de log. Hoje não há nenhuma
 *      (24 temas e 24 perguntas no banco, 1:1 com o arquivo, verificado em
 *      27/08/2026), mas o arquivo e o banco já divergiram — o conjunto
 *      cresceu de 20 para 24 ao longo de várias rodadas. E um tema que some
 *      do quiz some também do denominador de `app/lib/match.ts`: a
 *      compatibilidade muda de número sem que nada na tela explique por quê.
 *   3. As `QuizOption` caem por cascade e voltam com `id` novo a cada
 *      execução, à toa.
 *
 * As POSIÇÕES das candidaturas não estavam em risco: `CandidatePosition`
 * aponta para `PoliticalTopic`, não para `QuizQuestion` (schema, `topicId`),
 * e os temas sempre foram upsert por `slug`. As respostas do usuário também
 * não: vivem no localStorage, indexadas por slug de tema.
 *
 * A identidade de uma pergunta aqui é o TEMA (uma por tema), e não há
 * `@@unique([topicId])` no schema para um `upsert` do Prisma casar — daí o
 * casamento em memória: são 24 linhas, uma consulta só.
 */
async function seedQuiz(topicIdBySlug: Map<string, string>) {
  console.log("Perguntas do quiz...");

  const existing = await prisma.quizQuestion.findMany({
    select: {
      id: true,
      topicId: true,
      text: true,
      order: true,
      isActive: true,
      options: {
        select: { label: true, stanceValue: true, order: true, icon: true },
      },
    },
    orderBy: { id: "asc" },
  });

  const byTopicId = new Map<string, (typeof existing)[number]>();
  for (const q of existing) {
    // Sem constraint no banco, duas perguntas podem dividir um tema. Fica com
    // a primeira (ordem estável por `id`) e avisa, em vez de escolher uma
    // diferente a cada execução — mas não apaga a outra: decidir sozinho qual
    // pergunta descartar é exatamente o que este bloco deixou de fazer.
    if (byTopicId.has(q.topicId)) {
      console.warn(`  ! mais de uma pergunta para o mesmo tema (topicId ${q.topicId})`);
      continue;
    }
    byTopicId.set(q.topicId, q);
  }

  const expectedOptions = optionsSignature(LIKERT_OPTIONS);
  let criadas = 0;
  let atualizadas = 0;
  let intactas = 0;

  for (const q of QUESTIONS) {
    const topicId = topicIdBySlug.get(q.topicSlug);
    if (!topicId) {
      console.warn(`  ! tópico inexistente para a pergunta: ${q.topicSlug}`);
      continue;
    }

    const found = byTopicId.get(topicId);

    if (!found) {
      criadas++;
      console.log(`  + ${q.topicSlug} — pergunta nova`);
      if (DRY_RUN) continue;
      await prisma.quizQuestion.create({
        data: {
          text: q.text,
          topicId,
          order: q.order,
          isActive: true,
          options: { createMany: { data: LIKERT_OPTIONS } },
        },
      });
      continue;
    }

    const campos: string[] = [];
    if (found.text !== q.text) campos.push("text");
    if (found.order !== q.order) campos.push("order");
    if (!found.isActive) campos.push("isActive");
    const optionsDiffer = optionsSignature(found.options) !== expectedOptions;
    if (optionsDiffer) campos.push("options");

    if (campos.length === 0) {
      intactas++;
      console.log(`  = ${q.topicSlug} — nada a fazer`);
      continue;
    }

    atualizadas++;
    console.log(`  ~ ${q.topicSlug} — atualiza: ${campos.join(", ")}`);
    if (DRY_RUN) continue;

    await prisma.quizQuestion.update({
      where: { id: found.id },
      data: { text: q.text, order: q.order, isActive: true },
    });
    if (optionsDiffer) {
      // Recorte de UMA pergunta, não da tabela, e numa transação: a escala
      // Likert é fixa e não guarda estado de usuário, mas entre o delete e o
      // create a pergunta ficaria sem alternativa nenhuma no /quiz.
      //
      // Isto não é hipótese: 4 perguntas (saude-publica, educacao-basica,
      // legislacao-trabalhista, exploracao-petroleo) foram criadas por outro
      // caminho e têm outra redação — "Discordo em parte" / "Neutro / não
      // sei", sem `icon` (verificado em 27/08/2026). O seed anterior também
      // as reescrevia; a diferença é que agora ele diz qual e por quê.
      await prisma.$transaction([
        prisma.quizOption.deleteMany({ where: { questionId: found.id } }),
        prisma.quizOption.createMany({
          data: LIKERT_OPTIONS.map((o) => ({ ...o, questionId: found.id })),
        }),
      ]);
    }
  }

  const orfas = existing.length - byTopicId.size;
  console.log(
    `  → ${criadas} criada(s), ${atualizadas} atualizada(s), ${intactas} intacta(s)`,
  );

  // Perguntas no banco que o arquivo não descreve. NÃO são apagadas: podem ter
  // sido criadas de propósito, e sumir com elas em silêncio era o defeito 2.
  const fileTopicIds = new Set(
    QUESTIONS.map((q) => topicIdBySlug.get(q.topicSlug)).filter(Boolean),
  );
  const extras = [...byTopicId.values()].filter((q) => !fileTopicIds.has(q.topicId));
  if (extras.length > 0 || orfas > 0) {
    console.warn(
      `  ! ${extras.length + orfas} pergunta(s) no banco fora de reference.ts — preservada(s).\n` +
        "    Remova pelo /admin se for intencional; o seed não apaga pergunta.",
    );
  }
}

/** Caixa alta, sem acento, sem espaço duplicado — "Clariana Barão" → "CLARIANA BARAO". */
function nameKey(value: string): string {
  return value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .toUpperCase();
}

/** O que precisamos saber de uma linha que já existe para decidir o que fazer com ela. */
type ExistingCandidate = {
  id: string;
  tseId: string | null;
  name: string;
  displayName: string;
  dataSource: string;
  biography: string | null;
  governmentPlanUrl: string | null;
  officialSiteUrl: string | null;
};

/**
 * Acha a linha correspondente a uma candidatura do arquivo.
 *
 * `tseId` primeiro, porque é a chave real — a mesma que `sync-tse-2026.ts`
 * usa no upsert. O nome é fallback e nada mais: o TSE grava caixa alta sem
 * acento e às vezes com prefixo de urna ("ESCRITOR AUGUSTO CURY"), então
 * comparar nome resolve alguns casos e erra outros. Por isso a comparação é
 * insensível a caixa e a acento — a versão anterior era byte a byte e não
 * encontrava NENHUMA das 13 (verificado contra o banco em 27/08/2026:
 * encontraria 0 e duplicaria 13 de 13).
 */
function findExisting(
  c: CandidateSeed,
  rows: ExistingCandidate[],
): ExistingCandidate | null {
  if (c.tseId) {
    const byTseId = rows.find((r) => r.tseId === c.tseId);
    if (byTseId) return byTseId;
  }
  const keys = new Set([nameKey(c.displayName), nameKey(c.name)]);
  return (
    rows.find((r) => keys.has(nameKey(r.displayName)) || keys.has(nameKey(r.name))) ??
    null
  );
}

/**
 * O QUE O SEED PODE ESCREVER NUMA LINHA QUE JÁ EXISTE: só campo vazio.
 *
 * Estes dados são de imprensa (`dataSource: "press"`). O TSE é a fonte
 * canônica e chega depois, pelo `npm run sync:tse`, que escreve `name`,
 * `displayName`, `party`, `number`, `coalition`, `coalitionParties`,
 * `viceName`, `viceParty`, `registrationStatus`, `tseStatusLabel`,
 * `tseStatusDetail`, `dataSource` e `sourceUrl`. Mandar o pacote inteiro num
 * `update`, como este arquivo fazia, rebaixaria `dataSource` de "tse" para
 * "press" e trocaria a situação apurada na Justiça Eleitoral pela situação
 * noticiada — "Deferido" viraria "Aguardando julgamento" para quem já foi
 * julgado. É uma afirmação falsa sobre uma pessoa real, e ela não se
 * desfaz sozinha: o sync seguinte não vê diferença de rótulo e passa reto.
 *
 * Preencher buraco é seguro e útil (biografia, plano de governo e site
 * oficial não vêm no CSV do TSE; `tseId` numa linha antiga faz a próxima
 * execução casar pela chave em vez do nome). Sobrescrever nunca é.
 */
function fillBlanksOnly(
  existing: ExistingCandidate,
  c: CandidateSeed,
): Prisma.CandidateUpdateInput {
  const data: Prisma.CandidateUpdateInput = {};
  if (!existing.tseId && c.tseId) data.tseId = c.tseId;
  if (!existing.biography && c.biography) data.biography = c.biography;
  if (!existing.governmentPlanUrl && c.governmentPlanUrl)
    data.governmentPlanUrl = c.governmentPlanUrl;
  if (!existing.officialSiteUrl && c.officialSiteUrl)
    data.officialSiteUrl = c.officialSiteUrl;
  return data;
}

async function seedCandidates() {
  if (CANDIDATES_2026.length === 0) {
    console.warn(
      "\n! Nenhuma candidatura em prisma/data/candidates-2026.ts.\n" +
        "  Rode `npm run sync:tse` para importar os dados oficiais do TSE.\n",
    );
    return;
  }

  console.log("Candidaturas...");

  // Uma consulta só, e o casamento acontece em memória: são 13 linhas, e é
  // assim que dá para comparar ignorando acento — `mode: "insensitive"` do
  // Prisma resolve caixa, mas não "BARAO" × "Barão".
  const rows: ExistingCandidate[] = await prisma.candidate.findMany({
    where: { electionType: "presidential" },
    select: {
      id: true,
      tseId: true,
      name: true,
      displayName: true,
      dataSource: true,
      biography: true,
      governmentPlanUrl: true,
      officialSiteUrl: true,
    },
  });

  let criadas = 0;
  let preenchidas = 0;
  let intactas = 0;

  for (const c of CANDIDATES_2026) {
    const existing = findExisting(c, rows);

    if (!existing) {
      const data = {
        tseId: c.tseId,
        name: c.name,
        displayName: c.displayName,
        party: c.party,
        number: c.number,
        coalition: c.coalition,
        coalitionParties: c.coalitionParties,
        viceName: c.viceName,
        viceParty: c.viceParty,
        registrationStatus: c.registrationStatus,
        tseStatusLabel: c.tseStatusLabel,
        biography: c.biography,
        governmentPlanUrl: c.governmentPlanUrl,
        officialSiteUrl: c.officialSiteUrl,
        electionType: "presidential",
        dataSource: "press" as const,
        sourceUrl: c.sourceUrl,
      };
      criadas++;
      console.log(`  + ${c.displayName} (${c.party}) — nova, dado de imprensa`);
      if (DRY_RUN) continue;
      const created = await prisma.candidate.create({ data });
      await linkLegislative(created.id, c);
      continue;
    }

    const data = fillBlanksOnly(existing, c);
    const campos = Object.keys(data);
    if (campos.length > 0) {
      preenchidas++;
      console.log(
        `  ~ ${c.displayName} (${c.party}) — existe [${existing.dataSource}], preenche: ${campos.join(", ")}`,
      );
    } else {
      intactas++;
      console.log(
        `  = ${c.displayName} (${c.party}) — existe [${existing.dataSource}], nada a fazer`,
      );
    }

    if (DRY_RUN) continue;
    if (campos.length > 0) {
      await prisma.candidate.update({ where: { id: existing.id }, data });
    }
    await linkLegislative(existing.id, c);
  }

  console.log(
    `  → ${criadas} criada(s), ${preenchidas} com campo preenchido, ${intactas} intacta(s)`,
  );
}

async function linkLegislative(candidateId: string, c: CandidateSeed) {
  if (!c.legislative) return;
  await prisma.candidateLegislativeLink.upsert({
    where: { candidateId },
    update: {
      sourceType: c.legislative.source,
      sourceId: c.legislative.sourceId,
      legislaturePeriod: c.legislative.legislaturePeriod,
    },
    create: {
      candidateId,
      sourceType: c.legislative.source,
      sourceId: c.legislative.sourceId,
      legislaturePeriod: c.legislative.legislaturePeriod,
    },
  });
}

async function main() {
  console.log(
    DRY_RUN
      ? "MODO DRY-RUN: nada será gravado.\n"
      : "Iniciando seed...\n",
  );

  const topicIdBySlug = await seedTopics();
  await seedTags();
  await seedQuiz(topicIdBySlug);
  await seedCandidates();

  const [topics, tags, questions, options, candidates, positions] =
    await Promise.all([
      prisma.politicalTopic.count(),
      prisma.tag.count(),
      prisma.quizQuestion.count(),
      prisma.quizOption.count(),
      prisma.candidate.count({ where: { electionType: "presidential" } }),
      prisma.candidatePosition.count(),
    ]);

  const approved = await prisma.candidatePosition.count({
    where: { approvedAt: { not: null } },
  });

  console.log("\n========================================");
  console.log(DRY_RUN ? "Dry-run concluído (nada gravado)" : "Seed concluído");
  console.log("========================================");
  console.log(`Tópicos:              ${topics}`);
  console.log(`Tags:                 ${tags}`);
  console.log(`Perguntas:            ${questions} (${options} opções)`);
  console.log(`Candidaturas:         ${candidates}`);
  console.log(`Posições:             ${positions} (${approved} aprovadas)`);

  if (candidates > 0 && approved === 0) {
    console.log(
      "\n! Nenhuma posição aprovada. As telas de candidato e o quiz vão\n" +
        "  exibir 'sem posição registrada' até que a Fase B rode e as\n" +
        "  posições sejam aprovadas no /admin.",
    );
  }
}

main()
  .catch((e) => {
    console.error("Falha no seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
