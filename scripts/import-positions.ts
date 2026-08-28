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
 * NADA AQUI PUBLICA, E NADA AQUI DESPUBLICA. Toda linha NOVA entra com
 * `approvedAt: null`; toda linha que já existe conserva o `approvedAt` que
 * tem. O site só lê posição aprovada (`approvedAt: { not: null }` em
 * position.server.ts e candidate.server.ts), então importar é seguro: o texto
 * de uma linha nova fica visível apenas em /admin/candidato/:id, para revisão
 * humana, e a publicação continua sendo um ato deliberado de quem edita.
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

  // Estado atual das posições desta candidatura, numa consulta só. É contra
  // ele que cada linha do arquivo é comparada antes de gravar — mesmo caminho
  // do `prisma/seed.ts`: ler o que existe, dizer o que muda, não tocar no
  // resto. Sem esta leitura o script escreve às cegas e não tem como avisar.
  const existentes = await db.candidatePosition.findMany({
    where: { candidateId: file.candidateId },
    select: {
      id: true,
      topicId: true,
      approvedAt: true,
      stance: true,
      description: true,
      sourceType: true,
      sourceUrl: true,
      sourceDocument: true,
      sourcePage: true,
      sourceQuote: true,
    },
  });
  const byTopicId = new Map(existentes.map(p => [p.topicId, p]));

  console.log(`\n${candidate.displayName} (${candidate.party}, nº ${candidate.number})`);
  // O denominador vem do banco, não de um literal. Ele estava fixo em 20
  // enquanto a base já tem 24 temas, o que imprimia "-2 tema(s) sem registro"
  // — um número negativo é ruído, e aqui ele mediria a cobertura da extração.
  const semRegistro = topics.length - file.positions.length;
  console.log(`${file.positions.length} posição(ões) de ${topics.length} tema(s) — ${semRegistro} sem registro`);
  console.log(
    dryRun
      ? "MODO DRY-RUN: nada será gravado.\n"
      : "Gravando: linha nova entra PENDENTE (não aparece no site); linha que já\n" +
          "existe conserva a aprovação que tiver.\n",
  );

  let criadas = 0;
  let atualizadas = 0;
  let intactas = 0;
  /** Temas já no ar cujo conteúdo esta execução reescreveu. */
  const editadasNoAr: string[] = [];

  for (const p of file.positions) {
    const topic = bySlug.get(p.topicSlug)!;

    // `approvedAt` NÃO está aqui, e é a diferença entre este script e a versão
    // que ele substitui.
    //
    // POR QUE O `update` NÃO TOCA EM `approvedAt`
    //
    // Antes o `upsert` mandava o mesmo objeto no `create` e no `update`, e o
    // objeto trazia `approvedAt: null`. Numa linha NOVA isso é a regra do
    // cabeçalho; numa linha que JÁ EXISTE é um `unapprove()` — quatorze
    // posições aprovadas à mão em /admin voltavam a pendente e sumiam de
    // /candidato/:id, de /comparar e da conta do quiz porque alguém corrigiu
    // um `sourcePage`. Nenhuma linha de log dizia isso.
    //
    // Das duas saídas possíveis — preservar o `approvedAt` ou recusar a
    // escrever sobre linha aprovada —, esta preserva. Recusar protegeria o
    // mesmo bem e custaria a correção legítima: `sourcePage` errado numa
    // posição publicada é exatamente o defeito que mais urge consertar, e o
    // reparo ficaria bloqueado justamente onde o leitor já pode ver o erro.
    // Preservar não perde nada: aprovar continua sendo ato humano (linha nova
    // nasce pendente) e desaprovar também (só `unapprove()` no /admin escreve
    // `approvedAt: null` numa linha existente).
    //
    // O que preservar não resolve sozinho é o silêncio, e por isso a edição de
    // uma linha no ar é anunciada campo a campo e repetida no fim. A validação
    // deste arquivo é mais dura que `approvalBlocker()` (exige documento,
    // página E citação), então uma linha aprovada nunca fica inaprovável por
    // um import — o risco não é publicar um furo de fonte, é trocar o texto
    // que já está no ar sem nova revisão. Isso o operador tem de ler.
    const data = {
      stance: p.stance,
      description: p.description ?? null,
      sourceType: "PLATFORM" as const,
      sourceUrl: file.sourceUrl,
      sourceDocument: file.sourceDocument,
      sourcePage: p.sourcePage,
      sourceQuote: p.sourceQuote.trim(),
    };

    const found = byTopicId.get(topic.id);
    const rotulo = `[${p.stance}] ${topic.name} — p.${p.sourcePage}`;

    if (!found) {
      criadas++;
      console.log(`  + ${rotulo} — nova, entra PENDENTE`);
      if (dryRun) continue;
      await db.candidatePosition.create({
        data: {
          candidateId: file.candidateId,
          topicId: topic.id,
          ...data,
          // Só a linha nova nasce pendente. Publicar é ato humano no /admin.
          approvedAt: null,
        },
      });
      continue;
    }

    const situacao = found.approvedAt ? "NO AR" : "pendente";
    const campos: string[] = [];
    if (found.stance !== data.stance) campos.push("stance");
    if (found.description !== data.description) campos.push("description");
    if (found.sourceType !== data.sourceType) campos.push("sourceType");
    if (found.sourceUrl !== data.sourceUrl) campos.push("sourceUrl");
    if (found.sourceDocument !== data.sourceDocument) campos.push("sourceDocument");
    if (found.sourcePage !== data.sourcePage) campos.push("sourcePage");
    if (found.sourceQuote !== data.sourceQuote) campos.push("sourceQuote");

    if (campos.length === 0) {
      intactas++;
      console.log(`  = ${rotulo} — já idêntica (${situacao}), nada a fazer`);
      continue;
    }

    atualizadas++;
    console.log(`  ~ ${rotulo} — existe (${situacao}), atualiza: ${campos.join(", ")}`);
    if (found.approvedAt) editadasNoAr.push(topic.name);
    if (dryRun) continue;

    await db.candidatePosition.update({ where: { id: found.id }, data });
  }

  console.log(
    `\n→ ${criadas} nova(s), ${atualizadas} atualizada(s), ${intactas} intacta(s)`,
  );

  if (editadasNoAr.length > 0) {
    console.warn(
      `! ${editadasNoAr.length} posição(ões) JÁ PUBLICADA(S) mudaram de conteúdo: ${editadasNoAr.join(", ")}.\n` +
        "  Elas continuam aprovadas — este script não despublica —, mas o que o\n" +
        `  site exibe mudou sem nova revisão. Confira em /admin/candidato/${file.candidateId}.`,
    );
  }

  console.log(dryRun ? "\nOK (dry-run)." : "\nGravado. Revise em /admin/candidato/" + file.candidateId);
}

main()
  .catch(err => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
