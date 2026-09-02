/**
 * Publica em bloco as 106 posições revisadas em 01/09/2026.
 *
 * POR QUE ESTE SCRIPT EXISTE
 *
 * Aprovar é publicar uma afirmação sobre uma pessoa real, e o portão é humano
 * por design (`/admin/candidato/:id`, uma posição por vez). Só que a revisão
 * das 114 pendentes das 13 presidenciais já aconteceu — uma a uma, cada stance
 * contra a citação que o sustenta — e o resultado foi: 106 prontas, 8 retidas.
 * Repetir 106 cliques não acrescenta julgamento nenhum; acrescenta chance de
 * errar o clique. O julgamento está aqui embaixo, escrito, e o Lucas mandou
 * publicá-lo.
 *
 * O QUE ESTE SCRIPT NÃO FAZ
 *
 * Não escolhe o que aprovar. A lista é o COMPLEMENTO de `RETIDAS`: tudo que
 * estava pendente menos as 8 que a revisão segurou. E ele se recusa a rodar se
 * o conjunto pendente não for exatamente o que foi revisado (114, com as 8
 * presentes) — posição que apareceu depois da revisão não foi revisada, e
 * aprovar por contagem seria aprovar às cegas.
 *
 * A checagem de fonte não é refeita aqui: quem aprova é
 * `PositionService.approve()`, o mesmo caminho do /admin, que relê documento e
 * página NO BANCO e recusa em vez de aprovar em silêncio.
 *
 *   npx tsx scripts/approve-positions.ts              # mostra o plano, não grava
 *   npx tsx scripts/approve-positions.ts --confirmar  # grava o approvedAt
 *
 * PROCEDÊNCIA DAS 106
 *
 * Toda citação foi conferida contra o PDF protocolado por
 * `scripts/audit-positions.ts`: 109 batem literalmente na página citada e 5
 * são "parciais" — todas as 5 estão dentro destas 106 e foram abertas no PDF
 * uma a uma antes desta lista existir:
 *
 *   CURY · creditos-de-carbono (p.51), CURY · independencia-do-stf (p.64),
 *   CAIADO · creditos-de-carbono (p.51), CAIADO · exploracao-petroleo (p.37)
 *     — a citação emenda o TÍTULO da seção no parágrafo e insere um ponto
 *       final que o documento não tem ("Mercado de carbono" → "Mercado de
 *       carbono."). O resto é literal, palavra por palavra.
 *   MARÇAL · sistema-prisional (p.25) — a página é um diagrama de colunas.
 *     Sem `-layout`, "Ensino técnico obrigatório" sai perto da coluna
 *     "Policia"; com `-layout`, aparece onde a citação diz que está, na
 *     coluna "Sistema prisional". O erro era do extrator, não da citação.
 */
import { db } from "~/utils/db.server";
import { PositionService } from "~/services/position.server";

/**
 * As 8 que a revisão segurou, com o motivo. Nenhuma é citação inventada — a
 * auditoria não achou nenhuma. São julgamentos que precisam do editor.
 */
const RETIDAS: Array<{ candidato: string; tema: string; motivo: string }> = [
  {
    candidato: "ESCRITOR AUGUSTO CURY",
    tema: "regulacao-midia-ia",
    motivo:
      "stance 4 com a mesma prova que o Caiado recebeu 3: marco legal de IA, e nenhum dos dois documentos trata de desinformação, que é o objeto da pergunta. Dois pesos na mesma situação probatória é o único achado que ameaça a neutralidade.",
  },
  {
    candidato: "RONALDO CAIADO",
    tema: "regulacao-midia-ia",
    motivo: "o outro lado da mesma incoerência: stance 3 onde o Cury levou 4.",
  },
  {
    candidato: "EDMILSON COSTA",
    tema: "bolsa-familia-programas-sociais",
    motivo:
      "a citação fala de seguro-desemprego e auxílios emergenciais; a afirmação é sobre transferência de renda. A direção vem do contexto, não do trecho citado.",
  },
  {
    candidato: "SAMARA",
    tema: "bolsa-familia-programas-sociais",
    motivo:
      "a citação é sobre o BPC, e a própria leitura registra que o documento não menciona o Bolsa Família nem a expressão 'transferência de renda'.",
  },
  {
    candidato: "ESCRITOR AUGUSTO CURY",
    tema: "bolsa-familia-programas-sociais",
    motivo:
      "a citação carrega um erro do documento protocolado ('será muitíssimo valorizado o [sic] como paternalismo') que na tela lê o oposto do stance 2. O [sic] está certo — o erro é do original. Cabe decidir se encurta para a frase que se sustenta sozinha.",
  },
  {
    candidato: "SAMARA",
    tema: "educacao-de-genero",
    motivo:
      "a citação fala de campanhas nas escolas; a afirmação pergunta sobre currículo, e a leitura reconhece que o documento não trata de currículo.",
  },
  {
    candidato: "RENAN SANTOS",
    tema: "politica-agricola",
    motivo:
      "a citação é sobre crédito do BNDES atrelado a metas de exportação; não menciona agricultura familiar, que é o objeto da pergunta.",
  },
  {
    candidato: "ZEMA",
    tema: "armamento-civil",
    motivo:
      "a citação trata do produtor rural na extensão da propriedade dele; a afirmação é sobre 'o cidadão brasileiro'. Extrapolar de uma classe para o todo é leitura, não fonte.",
  },
];

/** O conjunto revisado em 01/09. Se o banco não for este, não é este trabalho. */
const PENDENTES_REVISADAS = 114;
const A_APROVAR = 106;

const gravar = process.argv.includes("--confirmar");

async function main() {
  const pendentes = await db.candidatePosition.findMany({
    where: { approvedAt: null },
    select: {
      id: true,
      stance: true,
      sourcePage: true,
      topic: { select: { slug: true } },
      candidate: { select: { displayName: true } },
    },
    orderBy: [{ candidate: { displayName: "asc" } }, { topic: { slug: "asc" } }],
  });

  const chave = (c: string, t: string) => `${c}|${t}`;
  const retidas = new Set(RETIDAS.map((r) => chave(r.candidato, r.tema)));
  const aprovar = pendentes.filter(
    (p) => !retidas.has(chave(p.candidate.displayName, p.topic.slug)),
  );

  const faltando = RETIDAS.filter(
    (r) =>
      !pendentes.some(
        (p) =>
          p.candidate.displayName === r.candidato && p.topic.slug === r.tema,
      ),
  );

  // Já rodou: sobram exatamente as 8 retidas, e não há o que fazer.
  if (aprovar.length === 0 && faltando.length === 0) {
    console.log(
      `\nNada a aprovar: as ${pendentes.length} pendentes são exatamente as retidas pela revisão.\n`,
    );
    return;
  }

  const problemas: string[] = [];
  if (pendentes.length !== PENDENTES_REVISADAS) {
    problemas.push(
      `o banco tem ${pendentes.length} posições pendentes, e a revisão cobriu ${PENDENTES_REVISADAS}`,
    );
  }
  if (aprovar.length !== A_APROVAR) {
    problemas.push(`o complemento das retidas deu ${aprovar.length}, e não ${A_APROVAR}`);
  }
  for (const r of faltando) {
    problemas.push(`a retida ${r.candidato} · ${r.tema} não está mais pendente`);
  }

  if (problemas.length > 0) {
    console.error(
      "\nRecusado — o conjunto pendente não é o que foi revisado:\n" +
        problemas.map((p) => `  · ${p}`).join("\n") +
        "\n\nPosição que apareceu depois da revisão não foi revisada. Rode\n" +
        "`npx tsx scripts/audit-positions.ts` e reveja o que entrou antes de publicar.\n",
    );
    process.exitCode = 1;
    return;
  }

  const porCandidato = new Map<string, typeof aprovar>();
  for (const p of aprovar) {
    const k = p.candidate.displayName;
    porCandidato.set(k, [...(porCandidato.get(k) ?? []), p]);
  }

  console.log(
    `\n${aprovar.length} posições a publicar em ${porCandidato.size} candidaturas` +
      `${gravar ? "" : "  (simulação — nada gravado)"}\n`,
  );
  for (const [nome, ps] of [...porCandidato].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`  ${String(ps.length).padStart(2)}  ${nome}`);
    console.log(
      `      ${ps.map((p) => `${p.topic.slug} ${p.stance} (p.${p.sourcePage})`).join(" · ")}`,
    );
  }

  console.log(`\n${RETIDAS.length} continuam pendentes, para o seu olho:`);
  for (const r of RETIDAS) console.log(`  · ${r.candidato} · ${r.tema}\n      ${r.motivo}`);

  if (!gravar) {
    console.log("\nRode com --confirmar para publicar.\n");
    return;
  }

  let ok = 0;
  const recusadas: string[] = [];
  for (const p of aprovar) {
    const r = await PositionService.approve(p.id);
    if (r.ok) ok += 1;
    else recusadas.push(`${p.candidate.displayName} · ${p.topic.slug}: ${r.error}`);
  }

  console.log(`\nPublicadas ${ok} de ${aprovar.length}.`);
  if (recusadas.length > 0) {
    console.log("Recusadas pelo portão de fonte:");
    for (const m of recusadas) console.log(`  · ${m}`);
    process.exitCode = 1;
  }
  console.log("");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
