# Plano de execução — do estado atual até o 1º turno

**Criado**: 2026-09-01 · **Branch**: `feat/ficha-tse-seo-e-seguranca-admin`
**Faltam 33 dias para 04/10.**

Este arquivo é a lista de trabalho, não a estratégia — a estratégia está em
`reposicionamento.md`. Um item só é marcado quando **rodou e o resultado foi
visto**, nunca quando "deve funcionar".

## Estado medido em 01/09/2026

| Fato | Valor | Como foi medido |
|------|-------|-----------------|
| Candidaturas no banco | 211 (206 com plano de governo) | `prisma.candidate.count()` |
| Posições | 122 gravadas, **8 aprovadas**, cobrindo **1 candidatura** | `candidatePosition.count()` |
| `VoteRecord` | **0 linhas** | `voteRecord.count()` |
| Proposições | 58 (8 aprovadas, 2 rejeitadas, **48 pendentes**) | `bill.groupBy(status)` |
| Gastos | 1.483 registros, **todos `DECLARED_ASSETS`** (173 candidaturas); zero de campanha | `spendingRecord.groupBy(type)` |
| Migrations | 11, banco em dia | `prisma migrate status` |
| Testes / tipos | 426 testes em 16 arquivos, `tsc` limpo | `npm test`, `npm run typecheck` |
| Git | 16 commits locais **sem push**, sem PR; árvore com 55 modificados + 7 novos | `git log origin/main..HEAD`, `git status` |

**[PORTÃO]** = precisa de OK explícito do Lucas antes de executar.

---

## Bloco 1 — Entregar o que já está pronto

Bloqueia todo o resto: enquanto a branch não sobe, ficha do TSE, SEO, segurança
do admin e acessibilidade não existem para ninguém fora deste laptop.

- [ ] **1.1** Rams `review_files` nos arquivos de UI alterados → aplicar o que
      apontar → `verify_fixes`. (Exigência do `CLAUDE.md` de `Personal/`.)
- [ ] **1.2** `npm run build` — o build de produção nunca rodou sobre este diff;
      MDX e rotas novas só quebram aqui.
- [ ] **1.3** Commits em blocos coerentes, **incluindo os untracked**:
      `prisma/migrations/20260828160000_add_tse_declared_counts/`,
      `educacao.funcoes-legislativo.mdx`, `educacao.funcoes-vereador.tsx` (301),
      `app/components/admin/styles.ts` e os 3 arquivos de teste novos.
      Critério: `git status` limpo e `npm test` verde depois do último commit.
      Cuidado: `routes.ts` já referencia os dois arquivos de educação untracked —
      commit parcial quebra o build.
- [ ] **1.4** `CLAUDE.md`: registrar a rota `/educacao/funcoes-legislativo` e o
      301 do slug antigo na lista de rotas.
- [ ] **1.5** **[PORTÃO]** push da branch + abrir PR para `main`.
- [ ] **1.6** **[PORTÃO]** merge + deploy. Conferir em produção: `/candidatos`,
      uma ficha com aba de bens, `/quiz` → `/resultado`, e o 301 do slug antigo.

## Bloco 2 — Fase B: posições com fonte (SC-102 e SC-103)

O gargalo real do produto: **1 candidatura de 211** tem posição publicada. O quiz
é o coração do site e hoje compara contra quase nada. A ferramenta já existe
(`scripts/import-positions.ts`, que exige documento, página e trecho literal) e
os 206 PDFs já estão no Blob — o que falta é a leitura.

- [ ] **2.1** Definir a fila de prioridade (presidenciais primeiro, por intenção
      de voto) e o teto de candidaturas por rodada.
- [ ] **2.2** Extrair posições dos planos de governo para JSON no formato do
      script — um arquivo por candidatura, com página e citação literal.
      É a etapa paralelizável (candidata natural a workflow multi-agente).
- [ ] **2.3** `import-positions.ts --dry-run` e depois import real. Tudo entra
      **pendente**; nada publica.
- [ ] **2.4** **[PORTÃO HUMANO]** aprovar em `/admin/candidato/:id`. Publicar uma
      afirmação sobre uma pessoa real é ato deliberado de quem edita, por design.
- [ ] **2.5** Nanicos: fallback partidário com disclosure explícito, ou assumir a
      ausência. Ausência declarada é resposta legítima (metodologia §2).
- [ ] **2.6** Verificar `/quiz` → `/resultado` com dados reais: pódio coerente,
      completude honesta ("baseado em X de 20") e candidatura sem posição que
      **não** vira 0%.

## Bloco 3 — Votações

- [ ] **3.1** Decidir o destino da seção: `VoteRecord` tem 0 linhas, então a aba
      "Votações" da ficha cai sempre em estado vazio. Ou popula, ou sai do ciclo.
- [ ] **3.2** Triar as 48 proposições pendentes em `/admin/votacao/:id`.
- [ ] **3.3** Se seguir: popular `VoteRecord` para quem tem mandato (Senado para
      Flávio Bolsonaro; Câmara para ex-deputados).

## Bloco 4 — Fase C: dinheiro de campanha

Hoje só há bens declarados. Receita e despesa de campanha são zero, e
`spending.server.ts` tem `syncFromTSE`/`syncFromCamara` como placeholder `TODO`.

- [ ] **4.1** Implementar `syncFromTSE` (DivulgaCandContas), com cache e snapshot
      local — nunca chamada externa em tempo de request.
- [ ] **4.2** Agendar a atualização (Actions, junto do sync full — o cron do
      Vercel Hobby só aceita diário).
- [ ] **4.3** Exibir na ficha (`SpendingSummary`/`SpendingChart` já existem) e
      descrever a fonte na metodologia.
- [ ] **4.4** CEAP (`syncFromCamara`): decidir se entra ou vira YAGNI no ciclo.

## Bloco 5 — Fase D: acabamento e pico

- [ ] **5.1** Auditoria de performance (T060 do spec 001) executada de fato.
- [ ] **5.2** OG images conferidas em produção e `sitemap.xml` cobrindo as 211
      fichas.
- [ ] **5.3** SC-105: metodologia descrevendo o pipeline de fontes **antes** de
      qualquer divulgação do relançamento.
- [ ] **5.4** 29/09: congelamento de features. Só dado e estabilidade até 04/10.
