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
      incidentes de fixture estavam presos ao commit `1dd3d8c` do histórico do
      PR, que nenhum commit novo alcança. A `main` está limpa desde `841d6eb`
      e o Lucas fechou os 3 incidentes no dashboard em 01/09 — incidente
      fechado não é mais levantado por check run, então o assunto está
      encerrado dos dois lados: no código e no scanner.

## Bloco 2 — Fase B: posições com fonte (SC-102 e SC-103)

O gargalo real do produto: **1 candidatura de 211** tem posição publicada. O quiz
é o coração do site e hoje compara contra quase nada. A ferramenta já existe
(`scripts/import-positions.ts`, que exige documento, página e trecho literal) e
os 206 PDFs já estão no Blob — o que falta é a leitura.

      **Medido em 01/09, e muda a premissa do bloco:** a extração das 13
      presidenciais **já está feita** — 122 posições gravadas, todas com
      página e citação literal, criadas em 27/08. O que trava o `/resultado`
      não é leitura: são **114 posições pendentes de aprovação**. Só as 8 do
      LULA estão publicadas. O gargalo é o 2.4, não o 2.2.

- [x] **2.1** Fila de prioridade. Resolvida pelo estado real: a rodada 1 é
      **revisar as 114 pendentes das 13 presidenciais**, que já existem, antes
      de extrair qualquer governador. Aprovar o que está pronto leva o quiz de
      1 para 13 candidaturas comparáveis; extrair governador não muda o
      `/resultado` enquanto essas 114 seguirem invisíveis.
- [ ] **2.2** Extrair posições dos planos de governo para JSON no formato do
      script — um arquivo por candidatura, com página e citação literal.
      É a etapa paralelizável (candidata natural a workflow multi-agente).
- [ ] **2.3** `import-positions.ts --dry-run` e depois import real. Tudo entra
      **pendente**; nada publica. (Não é necessário para as presidenciais: já
      estão no banco.)

- [x] **2.3b** Auditoria das citações contra o PDF — `scripts/audit-positions.ts`.
      Exigir citação literal não é conferir citação literal: nada impedia que
      o trecho gravado não estivesse na página, ou no documento. O script baixa
      o plano, extrai o texto da página citada e procura o trecho.
      **Resultado das 114 pendentes: 109 conferem na página citada, 5 parciais
      (75%–91%, diferença de transcrição), 0 ausentes.** Nenhuma citação
      inventada. Três falsos alarmes foram corrigidos no próprio script e estão
      documentados nele: `-layout` embaralhando PDF de duas colunas, o número
      do fólio despejado no meio da frase, e o `[sic]` do transcritor.
      Depois do 2.4, `--all` cobriu as **122** — inclusive as 8 do LULA, que
      estavam no ar desde 27/08 sem nunca terem sido conferidas: **117
      conferem, as mesmas 5 parciais, 0 ausentes**. Não há citação sem lastro
      no banco.
- [x] **2.4** **[PORTÃO HUMANO]** aprovar. Publicar uma afirmação sobre uma
      pessoa real é ato deliberado de quem edita — e foi: a revisão leu as 114
      uma a uma contra o eixo de cada tema, o Lucas mandou publicar as 106
      limpas em 01/09, e `scripts/approve-positions.ts --confirmar` gravou
      **106 de 106**. O banco fica em **114 aprovadas, 8 pendentes**, e o quiz
      passa de **1 para 13 candidaturas comparáveis**.
      As **8 retidas** estão no próprio script, com o motivo de cada uma: a
      incoerência `regulacao-midia-ia` entre CURY (4) e CAIADO (3) com a mesma
      prova, quatro citações que não tratam diretamente da afirmação
      (EDMILSON e SAMARA em `bolsa-familia`, RENAN em `politica-agricola`,
      ZEMA em `armamento-civil`) e duas que carregam erro do documento
      protocolado (CURY `bolsa-familia`, SAMARA `educacao-de-genero`).
      O script **não escolhe**: a lista é o complemento das 8, e ele se recusa
      a rodar se o conjunto pendente não for o que foi revisado — posição que
      entrar depois não foi revisada. Quem aprova é `PositionService.approve()`,
      o mesmo caminho do /admin, que relê documento e página no banco.
      As 5 "parciais" da auditoria estão dentro das 106 e foram abertas no PDF
      antes: quatro emendam o título da seção no parágrafo e inserem um ponto
      final que o documento não tem; a do MARÇAL era ordem de leitura do
      extrator numa página em colunas — `-layout` mostra o item exatamente onde
      a citação diz. Nenhuma citação inventada.
      Conferido em produção: ficha do MARÇAL com "Proposta de governo — TSE ·
      p. 25" e o trecho do sistema prisional; ficha da CLARIANA com p. 10.
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
- [ ] **5.5** Canal de contato. `contato@emquemvotar.app` está em `/sobre`,
      `/faq`, `/privacidade` e `/metodologia`, e o domínio **não existe**
      (NXDOMAIN, medido em 01/09) — quem escrever recebe bounce silencioso.
      Pesa mais na `/privacidade`, que é onde a LGPD espera um canal real para
      pedido de titular. **Adiado por decisão do Lucas em 01/09**, com o
      terreno já levantado para não redescobrir:
      - A conta do Resend tem **1 domínio verificado**, `contact.kise-app.com`
        (sa-east-1): envio habilitado, **recebimento desabilitado**. Não há
        `emquemvotar.app` lá, e o Resend não dá caixa postal em domínio que
        não se possui — ele entra depois do registro, não no lugar dele.
      - Caminho A, sem comprar nada: formulário na página → `action` envia via
        Resend para uma caixa definida por variável de ambiente. Precisa de
        cota (`checkQuota` já existe) e antiabuso, porque formulário público é
        alvo de spam.
      - Caminho B: registrar o domínio, verificar no Resend, ligar Receiving
        (MX). Aí o `mailto:` das 4 páginas volta a ser verdade **sem tocar em
        código**, e a caixa fica legível pelas ferramentas do Resend.
      - Descartado: usar `contato@contact.kise-app.com` no site. Endereço de
        outro projeto numa plataforma que promete neutralidade e
        rastreabilidade levanta a pergunta errada.

      As outras duas menções ao domínio morto **já foram consertadas** em
      `d707d44` (robots.txt e o texto do "Copiar resumo"), então o que resta
      aqui é só o e-mail.
