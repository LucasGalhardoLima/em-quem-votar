/**
 * Importa posições extraídas de proposta de governo como PENDENTES.
 *
 * POR QUE ESTE SCRIPT EXISTE
 *
 * A extração das posições é trabalho de leitura: alguém abre o PDF protocolado
 * no TSE, acha o trecho, classifica o tema. Fazer isso para as 13 candidaturas
 * significa várias rodadas de extração em paralelo, e cada rodada precisa
 * gravar do mesmo jeito. Sem um caminho único, cada rodada inventa o seu — e a
 * disciplina de fonte vira sorte.
 *
 * NADA AQUI PUBLICA. Toda linha entra e permanece com `approvedAt: null`. O
 * site só lê posição aprovada (`approvedAt: { not: null }` em
 * position.server.ts e candidate.server.ts), então importar é seguro: o texto
 * fica visível apenas em /admin/candidato/:id, para revisão humana, e a
 * publicação continua sendo um ato deliberado de quem edita.
 *
 * A validação é mais dura que a do banco de propósito. `approvalBlocker()`
 * exige documento e página para APROVAR; aqui exigimos documento, página E
 * citação literal para sequer GRAVAR. Uma posição sem trecho copiado do PDF é
 * uma afirmação sobre uma pessoa real que ninguém consegue conferir, e não
 * queremos esse rascunho nem no banco.
 *
 *   npx tsx scripts/import-positions.ts <arquivo.json> [--dry-run]
 *
 * Formato:
 *   { "candidateId": "<uuid>",
 *     "sourceDocument": "Proposta de governo — TSE",
 *     "sourceUrl": "https://.../planos/<tseId>.pdf",
 *     "positions": [
 *       { "topicSlug": "armamento-civil", "stance": 1, "sourcePage": 28,
 *         "sourceQuote": "trecho literal", "description": "leitura em 1 frase" }
 *     ] }
 *
 * Tema que a proposta não trata simplesmente NÃO entra na lista. Ausência é
 * informação legítima — ver metodologia §2 — e é assim que ela se representa.
 */
import { readFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

interface PositionInput {
  topicSlug: string;
  stance: number;
  sourcePage: number;
  sourceQuote: string;
  description?: string | null;
}

interface ImportFile {
  candidateId: string;
  sourceDocument: string;
  sourceUrl: string;
  positions: PositionInput[];
}

/** Erros de forma. Lista tudo antes de desistir, para o autor corrigir de uma vez. */
function validate(file: ImportFile, knownSlugs: Set<string>): string[] {
  const errors: string[] = [];
  if (!file.candidateId) errors.push("candidateId ausente");
  if (!file.sourceUrl?.trim()) errors.push("sourceUrl ausente");
  if (!file.sourceDocument?.trim()) errors.push("sourceDocument ausente");
  if (!Array.isArray(file.positions)) {
    errors.push("positions não é lista");
    return errors;
  }

  const seen = new Set<string>();
  file.positions.forEach((p, i) => {
    const at = `positions[${i}] (${p.topicSlug ?? "sem slug"})`;
    if (!knownSlugs.has(p.topicSlug)) errors.push(`${at}: tema inexistente`);
    if (seen.has(p.topicSlug)) errors.push(`${at}: tema repetido`);
    seen.add(p.topicSlug);
    if (!Number.isInteger(p.stance) || p.stance < 1 || p.stance > 5) {
      errors.push(`${at}: stance deve ser inteiro de 1 a 5 (recebido: ${p.stance})`);
    }
    if (!Number.isInteger(p.sourcePage) || p.sourcePage < 1) {
      errors.push(`${at}: sourcePage deve ser inteiro >= 1 (recebido: ${p.sourcePage})`);
    }
    if (!p.sourceQuote || p.sourceQuote.trim().length < 20) {
      errors.push(`${at}: sourceQuote ausente ou curto demais para conferir`);
    }
  });
  return errors;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const path = args.find(a => !a.startsWith("--"));
  if (!path) {
    console.error("uso: npx tsx scripts/import-positions.ts <arquivo.json> [--dry-run]");
    process.exit(1);
  }

  const file = JSON.parse(await readFile(path, "utf8")) as ImportFile;

  const topics = await db.politicalTopic.findMany({ select: { id: true, slug: true, name: true } });
  const bySlug = new Map(topics.map(t => [t.slug, t]));

  const errors = validate(file, new Set(bySlug.keys()));
  if (errors.length > 0) {
    console.error(`\n${errors.length} erro(s) — nada foi gravado:`);
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }

  const candidate = await db.candidate.findUnique({
    where: { id: file.candidateId },
    select: { displayName: true, party: true, number: true },
  });
  if (!candidate) {
    console.error(`candidateId ${file.candidateId} não existe — nada foi gravado.`);
    process.exit(1);
  }

  console.log(`\n${candidate.displayName} (${candidate.party}, nº ${candidate.number})`);
  // O denominador vem do banco, não de um literal. Ele estava fixo em 20
  // enquanto a base já tem 24 temas, o que imprimia "-2 tema(s) sem registro"
  // — um número negativo é ruído, e aqui ele mediria a cobertura da extração.
  const semRegistro = topics.length - file.positions.length;
  console.log(`${file.positions.length} posição(ões) de ${topics.length} tema(s) — ${semRegistro} sem registro`);
  console.log(dryRun ? "MODO DRY-RUN: nada será gravado.\n" : "Gravando como PENDENTES (não aparecem no site).\n");

  for (const p of file.positions) {
    const topic = bySlug.get(p.topicSlug)!;
    console.log(`  [${p.stance}] ${topic.name} — p.${p.sourcePage}`);
    if (dryRun) continue;

    const data = {
      stance: p.stance,
      description: p.description ?? null,
      sourceType: "PLATFORM" as const,
      sourceUrl: file.sourceUrl,
      sourceDocument: file.sourceDocument,
      sourcePage: p.sourcePage,
      sourceQuote: p.sourceQuote.trim(),
      // Sempre pendente. A publicação é ato humano em /admin/candidato/:id.
      approvedAt: null,
    };

    await db.candidatePosition.upsert({
      where: { candidateId_topicId: { candidateId: file.candidateId, topicId: topic.id } },
      create: { candidateId: file.candidateId, topicId: topic.id, ...data },
      update: data,
    });
  }

  console.log(dryRun ? "\nOK (dry-run)." : "\nGravado. Revise em /admin/candidato/" + file.candidateId);
}

main()
  .catch(err => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
