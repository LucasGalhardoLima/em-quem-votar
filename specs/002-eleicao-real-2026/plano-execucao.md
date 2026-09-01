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

- [x] **1.1** Rams `review_files` nos arquivos de UI alterados → aplicar o que
      apontar → `verify_fixes`. (Exigência do `CLAUDE.md` de `Personal/`.)
      **92/100, zero críticos** em 6 levas; 4 correções reais aplicadas na raiz
      (`aria-hidden` em ícones decorativos, alvo de toque e anel de foco nos
      links "Ficha"/"Fonte", barra de gastos escondida do leitor de tela, 9
      glifos `→`). Dois apontamentos foram rejeitados com medição, não por
      opinião: o contraste do contador (fundo real `#f6f6fe` → 5,84:1, passa AA)
      e o "filtro de situação perdido no refresh" (o arquivo chama
      `syncUrl({ situacao })`). Restou **1 crédito de 30**.
- [x] **1.2** `npm run build` — o build de produção nunca rodou sobre este diff;
      MDX e rotas novas só quebram aqui. Passou, e o build foi subido localmente
      contra o banco real: `/` 200 com canonical, 301 do slug antigo,
      `/candidatos?uf=SP` com título por estado, ficha 200, `/resultado` e
      `/votacoes` 200. Anotação para o 5.1: a ficha levou **4,2s** no primeiro
      carregamento com o banco remoto daqui — medir na Vercel antes de concluir.
- [x] **1.3** Commits em blocos coerentes, **incluindo os untracked**:
      `prisma/migrations/20260828160000_add_tse_declared_counts/`,
      `educacao.funcoes-legislativo.mdx`, `educacao.funcoes-vereador.tsx` (301),
      `app/components/admin/styles.ts` e os 3 arquivos de teste novos.
      Critério: `git status` limpo e `npm test` verde depois do último commit.
      Cuidado: `routes.ts` já referencia os dois arquivos de educação untracked —
      commit parcial quebra o build. Fechado: árvore limpa, **426 testes** em 16
      arquivos, `typecheck` limpo.
- [x] **1.4** `CLAUDE.md`: registrar a rota `/educacao/funcoes-legislativo` e o
      301 do slug antigo na lista de rotas.
- [x] **1.5** **[PORTÃO]** push da branch + abrir PR para `main`.
      [PR #5](https://github.com/LucasGalhardoLima/em-quem-votar/pull/5), 33
      commits, preview da Vercel verde.
- [x] **1.6** **[PORTÃO]** merge + deploy. Conferido em produção em 01/09, em
      `https://em-quem-votar.vercel.app` (o domínio `emquemvotar.app` que a
      cópia do site cita ainda não resolve — NXDOMAIN):
      - `/candidatos`: 211 candidaturas, filtros somando 99 aguardando
        julgamento + 3 sub judice + 107 deferido + 2 renúncia, agrupadas por
        cargo, peso visual igual.
      - Ficha com aba de bens: CABO DACIOLO (Governador — Amazonas) com
        R$ 190.750 detalhados nos itens; canonical próprio; as 5 abas na
        ordem fixa.
      - `/quiz` → `/resultado`: percentual calculado no navegador, LULA 90% em
        8 de 8 temas comparáveis, "baseado em 20 de 24 perguntas", e as demais
        candidaturas como **"Sem dados"** — não 0%. É a prova em produção do
        que os commits `6249dc8` e `9b457b6` prometeram.
      - `/educacao/funcoes-vereador` → **301** para `funcoes-legislativo`.
      - `/`, `/votacoes`, `/metodologia`, `/candidatos?uf=SP`: 200, canonical
        presente, contador em "Faltam 33 dias".

      O check do GitGuardian entrou vermelho no merge, como previsto: os 3
      incidentes de fixture seguem presos ao commit `1dd3d8c` do histórico do
      PR. A `main` está limpa desde `841d6eb`. Fechar os incidentes no
      dashboard continua pendente e só o Lucas tem acesso.

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
