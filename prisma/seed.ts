/**
 * Seed idempotente.
 *
 * Rodar duas vezes não duplica nada: tópicos e tags têm `slug` único,
 * posições têm a chave composta (candidato, tópico), e as perguntas do quiz
 * são recriadas em bloco — elas não guardam estado do usuário, já que as
 * respostas ficam no aparelho, indexadas por slug de tópico.
 */

import { PrismaClient } from "@prisma/client";
import { LIKERT_OPTIONS, QUESTIONS, TAGS, TOPICS } from "./data/reference";
import { CANDIDATES_2026 } from "./data/candidates-2026";

const prisma = new PrismaClient();

async function seedTopics() {
  console.log("Tópicos políticos...");
  for (const topic of TOPICS) {
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

async function seedQuiz(topicIdBySlug: Map<string, string>) {
  console.log("Perguntas do quiz...");
  // As opções caem junto por cascade. Nenhuma resposta de usuário é
  // perdida: elas vivem no localStorage, indexadas pelo slug do tópico.
  await prisma.quizQuestion.deleteMany({});

  for (const q of QUESTIONS) {
    const topicId = topicIdBySlug.get(q.topicSlug);
    if (!topicId) {
      console.warn(`  ! tópico inexistente para a pergunta: ${q.topicSlug}`);
      continue;
    }
    await prisma.quizQuestion.create({
      data: {
        text: q.text,
        topicId,
        order: q.order,
        isActive: true,
        options: { createMany: { data: LIKERT_OPTIONS } },
      },
    });
  }
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
  for (const c of CANDIDATES_2026) {
    // Casa por nome de urna OU nome completo. O nome de urna é o que não muda;
    // `name` é refinado conforme a apuração avança (de "Renan Santos" para o
    // registro completo, por exemplo). Casar só por `name`, como esta consulta
    // fazia, criaria uma candidatura DUPLICADA a cada refinamento desses.
    const existing = await prisma.candidate.findFirst({
      where: {
        electionType: "presidential",
        OR: [{ displayName: c.displayName }, { name: c.name }],
      },
      select: { id: true },
    });

    const data = {
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

    const candidate = existing
      ? await prisma.candidate.update({ where: { id: existing.id }, data })
      : await prisma.candidate.create({ data });

    if (c.legislative) {
      await prisma.candidateLegislativeLink.upsert({
        where: { candidateId: candidate.id },
        update: {
          sourceType: c.legislative.source,
          sourceId: c.legislative.sourceId,
          legislaturePeriod: c.legislative.legislaturePeriod,
        },
        create: {
          candidateId: candidate.id,
          sourceType: c.legislative.source,
          sourceId: c.legislative.sourceId,
          legislaturePeriod: c.legislative.legislaturePeriod,
        },
      });
    }

    console.log(`  ✓ ${c.displayName} (${c.party})`);
  }
}

async function main() {
  console.log("Iniciando seed...\n");

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
  console.log("Seed concluído");
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
