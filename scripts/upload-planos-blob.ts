/**
 * Sobe as propostas de governo de `public/planos/` para o Vercel Blob e
 * atualiza `governmentPlanUrl` de cada candidatura para a URL pública.
 *
 * POR QUE BLOB, E NÃO O REPOSITÓRIO
 * São ~210 MB de PDF. No git, isso pesaria em todo clone e todo deploy, para
 * sempre. Em `public/` sem git, não chegaria ao deploy e o link quebraria em
 * produção. O Blob resolve os dois: deploy leve e URL estável em CDN.
 *
 * Idempotente: `addRandomSuffix: false` faz o mesmo arquivo sobrescrever a si
 * mesmo, então rodar duas vezes não duplica nada.
 *
 *   npx tsx scripts/upload-planos-blob.ts [--dry-run] [--concurrency 5]
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { put } from "@vercel/blob";
import { PrismaClient } from "@prisma/client";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PLAN_DIR = path.join(PROJECT_ROOT, "public", "planos");

const argv = process.argv.slice(2);
const dryRun = argv.includes("--dry-run");
const concurrency = Math.max(1, Number(argv[argv.indexOf("--concurrency") + 1]) || 5);

function requireToken(): string {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    throw new Error(
      "BLOB_READ_WRITE_TOKEN ausente. Rode `npx vercel env pull .env.local` " +
        "ou exporte a variável antes de executar."
    );
  }
  return token;
}

async function main() {
  const files = readdirSync(PLAN_DIR).filter(f => f.toLowerCase().endsWith(".pdf"));
  if (files.length === 0) {
    console.log("Nenhum PDF em public/planos. Rode `npm run sync:tse -- --plans-file <zip>` antes.");
    return;
  }

  const totalBytes = files.reduce((acc, f) => acc + statSync(path.join(PLAN_DIR, f)).size, 0);
  console.log(`📄 ${files.length} PDFs (${(totalBytes / 1048576).toFixed(1)} MB)`);
  if (dryRun) {
    console.log("🧪 --dry-run: nada será enviado nem gravado.");
    return;
  }

  const token = requireToken();
  const prisma = new PrismaClient();
  const results: Array<{ tseId: string; url: string }> = [];
  const failures: Array<{ file: string; error: string }> = [];

  let cursor = 0;
  async function worker() {
    while (cursor < files.length) {
      const file = files[cursor++];
      const tseId = path.basename(file, ".pdf");
      try {
        const blob = await put(`planos/${file}`, readFileSync(path.join(PLAN_DIR, file)), {
          access: "public",
          token,
          // Sem sufixo aleatório: a URL tem de ser estável entre execuções,
          // senão cada sync geraria um link novo e o anterior viraria lixo.
          addRandomSuffix: false,
          contentType: "application/pdf",
        });
        results.push({ tseId, url: blob.url });
        if (results.length % 25 === 0) {
          console.log(`   ${results.length}/${files.length}…`);
        }
      } catch (err) {
        failures.push({ file, error: (err as Error).message });
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));
  console.log(`\n☁️  ${results.length} enviados, ${failures.length} falharam`);

  let updated = 0;
  for (const { tseId, url } of results) {
    const r = await prisma.candidate.updateMany({
      where: { tseId },
      data: { governmentPlanUrl: url },
    });
    updated += r.count;
  }
  console.log(`🗄️  ${updated} candidaturas apontam agora para o Blob`);

  if (failures.length > 0) {
    console.log("\n⚠️  Falhas (nada foi apagado; rode de novo para reenviar):");
    for (const f of failures.slice(0, 10)) console.log(`   ${f.file}: ${f.error}`);
  }
  await prisma.$disconnect();
}

main().catch(err => {
  console.error("❌", err instanceof Error ? err.message : err);
  process.exit(1);
});
