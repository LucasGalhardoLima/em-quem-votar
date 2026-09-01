/**
 * Confere cada posição gravada contra o PDF que ela cita.
 *
 * POR QUE ESTE SCRIPT EXISTE
 *
 * `import-positions.ts` exige documento, página e citação literal para gravar,
 * mas exigir um campo não é conferir o campo: nada impedia que a citação
 * fosse um trecho que não está naquela página, ou que não está no documento
 * nenhum. A revisão em /admin é humana e é o portão certo para PUBLICAR — mas
 * pedir que uma pessoa abra 122 PDFs para achar 122 trechos é pedir que ela
 * confie no que não deu para conferir.
 *
 * Aqui a conferência é mecânica: baixa o PDF, extrai o texto DA PÁGINA CITADA
 * e procura o trecho. O que sai é a lista do que bate, do que está em outra
 * página, e do que não está no documento — que é a única categoria capaz de
 * pôr uma frase inventada na boca de uma pessoa real.
 *
 * NÃO ESCREVE NADA NO BANCO. É leitura, e o veredito é do humano.
 *
 *   npx tsx scripts/audit-positions.ts [--all] [--candidato "<nome>"] [--json]
 *
 *   --all        inclui as já aprovadas (o padrão são só as pendentes)
 *   --candidato  filtra por parte do nome, sem acento e sem caixa
 *   --json       saída estruturada, para outro passo consumir
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, existsSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const argv = process.argv.slice(2);
const incluirAprovadas = argv.includes("--all");
const saidaJson = argv.includes("--json");
const filtroNome = argv.includes("--candidato")
  ? argv[argv.indexOf("--candidato") + 1]
  : null;

const CACHE = path.join(tmpdir(), "eqv-planos");

/**
 * Normaliza para comparar texto de PDF com texto de banco.
 *
 * O extrator quebra linha no meio de frase, hifeniza no fim da linha e usa
 * espaços largos; a citação no banco veio de outra leitura do mesmo arquivo.
 * Comparar cru falharia por formatação, não por conteúdo — e um falso alarme
 * aqui custa mais caro que a checagem, porque treina quem revisa a ignorar.
 *
 * Dois cuidados vieram de reprovacoes falsas medidas na primeira rodada:
 *
 * 1. O `pdftotext` roda SEM `-layout`. Boa parte das propostas e diagramada
 *    em duas colunas, e `-layout` preserva as colunas lado a lado — a frase
 *    de uma coluna sai intercalada com a da outra, e nenhuma citacao correta
 *    casa. Sem a flag, o extrator entrega ordem de leitura.
 *
 * 3. `[sic]` sai da comparacao. E marca de quem transcreveu, avisando que o
 *    erro esta no original — nao e texto do documento. Deixa-la dentro fazia
 *    a citacao mais curta das 114 caIr para 58% de cobertura e ser acusada de
 *    ausente, quando o problema era a propria marca.
 *
 * 2. Tokens so de digito somem dos DOIS lados. O numero do folio e despejado
 *    no meio do texto ("...primando pela vida das 28 mulheres..."), o que
 *    partiria a citacao ao meio. Tirar de ambos os lados mantem a comparacao
 *    simetrica: um "24 horas" na citacao vira "horas" nos dois.
 */
function normalizar(texto: string): string {
  return texto
    .normalize("NFC")
    .replace(/­/g, "")           // hífen suave
    .replace(/-\s*\n\s*/g, "")        // hifenização de fim de linha
    .replace(/\[\s*sic!?\s*\]/gi, " ") // marca de quem transcreveu, não do original
    .replace(/[“”„]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .split(" ")
    .filter((t) => !/^[\d.,;:%-]+$/.test(t))
    .join(" ")
    .trim();
}

/**
 * A citação costuma ser a colagem de vários itens de lista, separados por
 * "•". Cada item é um trecho literal por si só, então a conferência é por
 * item: exigir a colagem inteira contígua reprovaria extração correta.
 */
function fragmentos(citacao: string): string[] {
  return citacao
    .split("•")
    .map((f) => normalizar(f))
    .filter((f) => f.length >= 25); // fragmento curto casa por acaso
}

async function baixarPlano(url: string): Promise<string> {
  mkdirSync(CACHE, { recursive: true });
  const destino = path.join(CACHE, path.basename(new URL(url).pathname));
  if (existsSync(destino)) return destino;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ao baixar ${url}`);
  writeFileSync(destino, Buffer.from(await res.arrayBuffer()));
  return destino;
}

function textoDaPagina(pdf: string, pagina: number): string {
  try {
    return execFileSync(
      "pdftotext",
      ["-f", String(pagina), "-l", String(pagina), pdf, "-"],
      { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
    );
  } catch {
    return "";
  }
}

function totalDePaginas(pdf: string): number {
  try {
    const info = execFileSync("pdfinfo", [pdf], { encoding: "utf8" });
    return Number(info.match(/^Pages:\s+(\d+)/m)?.[1] ?? 0);
  } catch {
    return 0;
  }
}

/**
 * `parcial` existe porque a alternativa era mentir. Sete citações das 114 da
 * primeira rodada reprovaram no casamento literal e TODAS estavam no
 * documento: duas trazem um "[sic]" que o extrator inseriu para marcar erro
 * de digitação do original, e as outras perdem palavras em quebra de coluna.
 * Chamar isso de "ausente" ensinaria quem revisa que o alarme não vale nada —
 * e o alarme precisa valer, porque "ausente" é a categoria que significa
 * frase posta na boca de alguém.
 *
 * A medida é a fração de janelas de 5 palavras da citação presentes no
 * documento. Acima de 70%, é a mesma passagem com outra transcrição; abaixo,
 * é para um humano olhar.
 */
type Veredito = "confere" | "outra-pagina" | "parcial" | "ausente" | "sem-pdf";

const PISO_PARCIAL = 0.7;

/** Fração de janelas de 5 palavras da citação que existem no documento. */
function cobertura(citacaoNormalizada: string, docNormalizado: string): number {
  const palavras = citacaoNormalizada.split(" ");
  const janelas = palavras.length - 4;
  if (janelas <= 0) return docNormalizado.includes(citacaoNormalizada) ? 1 : 0;
  let achadas = 0;
  for (let i = 0; i < janelas; i += 1) {
    if (docNormalizado.includes(palavras.slice(i, i + 5).join(" "))) achadas += 1;
  }
  return achadas / janelas;
}

async function main() {
  const posicoes = await db.candidatePosition.findMany({
    where: incluirAprovadas ? {} : { approvedAt: null },
    select: {
      id: true, stance: true, sourcePage: true, sourceQuote: true,
      approvedAt: true,
      topic: { select: { slug: true } },
      candidate: { select: { displayName: true, governmentPlanUrl: true } },
    },
    orderBy: [{ candidate: { displayName: "asc" } }, { topic: { slug: "asc" } }],
  });

  const alvo = filtroNome
    ? posicoes.filter((p) =>
        normalizar(p.candidate.displayName).includes(normalizar(filtroNome)))
    : posicoes;

  const resultados: Array<{
    candidato: string; tema: string; pagina: number | null;
    veredito: Veredito; achadaEm?: number; detalhe?: string;
  }> = [];

  const cacheTexto = new Map<string, string>();

  for (const p of alvo) {
    const base = {
      candidato: p.candidate.displayName,
      tema: p.topic.slug,
      pagina: p.sourcePage,
    };
    const url = p.candidate.governmentPlanUrl;
    if (!url || !p.sourceQuote || !p.sourcePage) {
      resultados.push({ ...base, veredito: "sem-pdf", detalhe: !url ? "candidatura sem governmentPlanUrl" : "posição sem citação ou página" });
      continue;
    }

    const pdf = await baixarPlano(url);
    const chave = `${pdf}#${p.sourcePage}`;
    if (!cacheTexto.has(chave)) cacheTexto.set(chave, normalizar(textoDaPagina(pdf, p.sourcePage)));
    const naPagina = cacheTexto.get(chave)!;

    const partes = fragmentos(p.sourceQuote);
    if (partes.length === 0) {
      resultados.push({ ...base, veredito: "ausente", detalhe: "citação curta demais para conferir" });
      continue;
    }

    if (partes.every((f) => naPagina.includes(f))) {
      resultados.push({ ...base, veredito: "confere" });
      continue;
    }

    // Não bateu na página citada: procurar no documento inteiro diz se o erro
    // é de numeração (recuperável na revisão) ou de conteúdo (grave).
    const paginas = totalDePaginas(pdf);
    let achadaEm: number | undefined;
    for (let n = 1; n <= paginas; n += 1) {
      const k = `${pdf}#${n}`;
      if (!cacheTexto.has(k)) cacheTexto.set(k, normalizar(textoDaPagina(pdf, n)));
      if (partes.every((f) => cacheTexto.get(k)!.includes(f))) { achadaEm = n; break; }
    }

    if (achadaEm) {
      resultados.push({ ...base, veredito: "outra-pagina", achadaEm });
      continue;
    }

    const docInteiro = normalizar(
      execFileSync("pdftotext", [pdf, "-"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }),
    );
    const cob = cobertura(normalizar(p.sourceQuote), docInteiro);
    const pct = `${Math.round(cob * 100)}% da citação encontrada no documento`;
    resultados.push(
      cob >= PISO_PARCIAL
        ? { ...base, veredito: "parcial", detalhe: pct }
        : { ...base, veredito: "ausente", detalhe: pct },
    );
  }

  if (saidaJson) {
    console.log(JSON.stringify(resultados, null, 2));
    return;
  }

  const porVeredito = (v: Veredito) => resultados.filter((r) => r.veredito === v);
  console.log(`\nConferidas ${resultados.length} posições${incluirAprovadas ? "" : " pendentes"}.\n`);
  console.log(`  confere ............ ${porVeredito("confere").length}`);
  console.log(`  outra página ....... ${porVeredito("outra-pagina").length}`);
  console.log(`  parcial ............ ${porVeredito("parcial").length}`);
  console.log(`  ausente ............ ${porVeredito("ausente").length}`);
  console.log(`  sem PDF ............ ${porVeredito("sem-pdf").length}\n`);

  for (const r of resultados.filter((x) => x.veredito !== "confere")) {
    const onde = r.veredito === "outra-pagina" ? `citada p.${r.pagina}, está na p.${r.achadaEm}` : r.detalhe;
    console.log(`  [${r.veredito}] ${r.candidato} · ${r.tema} — ${onde}`);
  }

  const porCandidato = new Map<string, { ok: number; total: number }>();
  for (const r of resultados) {
    const e = porCandidato.get(r.candidato) ?? { ok: 0, total: 0 };
    e.total += 1;
    if (r.veredito === "confere" || r.veredito === "parcial") e.ok += 1;
    porCandidato.set(r.candidato, e);
  }
  console.log("\nPor candidatura:");
  for (const [nome, e] of [...porCandidato].sort((a, b) => b[1].ok - a[1].ok)) {
    console.log(`  ${String(e.ok).padStart(3)}/${String(e.total).padEnd(3)} ${nome}`);
  }
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => db.$disconnect());
