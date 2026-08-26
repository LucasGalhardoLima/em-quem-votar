# Reposicionamento: Em Quem Votar na Eleição Real de 2026

**Feature Branch**: `002-eleicao-real-2026`
**Criado**: 2026-08-24
**Status**: Proposta para aprovação
**Contexto**: A eleição saiu do plano teórico. Registros no TSE encerrados, 13 candidaturas presidenciais oficiais, campanha em curso desde 16/08. A plataforma hoje não reflete nada disso: o seed ainda tem candidatos de exemplo e o rebuild 001 parou em fevereiro com US1-US3 prontas e US4-US5 pela metade.

## 1. O momento (por que agora)

| Data | Evento |
|------|--------|
| 15/08/2026 | Fim do registro de candidaturas no TSE (concluído) |
| 16/08/2026 | Início oficial da campanha (em curso) |
| 28/08/2026 | Início do horário eleitoral gratuito |
| 04/10/2026 | **Primeiro turno** |
| 25/10/2026 | Segundo turno (se houver) |

Restam ~6 semanas até o primeiro turno. O pico de busca por "em quem votar" acontece entre o início do horário eleitoral e a véspera da eleição. A corrida em si amplifica o interesse: Bolsonaro preso e inelegível, Flávio Bolsonaro herdando a candidatura pelo PL, Marçal registrado sub judice, Lula buscando o quarto mandato. Eleitor confuso é exatamente o público desta plataforma.

## 2. Objetivo reordenado

Prioridade definida em 24/08:

1. **Impacto cívico**: informação de qualidade, neutra e com fonte citada, acima de tudo. Isso já era o DNA do spec 001 (FR-002, FR-003, SC-003, SC-006) e permanece o critério de desempate em toda decisão de escopo.
2. **Build in public**: o processo de relançamento vira conteúdo (a jornada de reativar um projeto parado a 6 semanas da eleição é uma boa história).
3. **Alcance**: desejável, mas não à custa de neutralidade. Compartilhamento entra como consequência de um resultado de quiz bem feito, não como objetivo de design.
4. **Monetização**: fora de escopo neste ciclo.

Implicação prática: onde o spec 001 dizia "plataforma", o 002 diz "serviço público de decisão de voto". Profundidade e rastreabilidade de fonte ganham de features de engajamento.

## 3. O que muda em relação ao spec 001

### Continua valendo (já construído)

- US1 Browse de candidatos, US2 Quiz (euclidiana + arquétipos + pesos por eixo), US3 Busca/comparação
- Modelo de dados (Candidate, CandidatePosition, SpendingRecord, CandidateLegislativeLink, QuizQuestion)
- Princípios de neutralidade da research.md seção 6 (peso visual igual, ordem randomizada, fonte obrigatória)

### Muda de status

| Item | Spec 001 | Spec 002 |
|------|----------|----------|
| Dados de candidatos | Seed manual de exemplo | **Dados reais dos 13 via TSE (bloqueador nº 1)** |
| Posições políticas | Pipeline genérico de 6 fontes | Foco em 2 fontes: propostas de governo oficiais (PDF no TSE) + votações reais |
| Gastos (US4) | CEAP histórico + campanha | Campanha e bens via TSE primeiro; CEAP só para quem tem mandato recente |
| Votações (US5) | Multi-fonte ampla | Só para candidatos com histórico legislativo real (na prática: Flávio Bolsonaro no Senado, e pouco mais) |
| Countdown/empty states | "Candidatos serão listados após registro" | Obsoleto: registro já aconteceu, tela vazia agora é bug |

### Cortado deste ciclo

- Sync automático contínuo de CEAP histórico profundo
- Tracking de convenções partidárias (já passou)
- Qualquer feature nova de engajamento que não sirva ao fluxo quiz → resultado → perfil

## 4. Pipeline de dados oficiais (decisão: APIs oficiais primeiro)

Verificado em 24/08/2026: o Portal de Dados Abertos do TSE já publica o dataset **candidatos-2026**, atualizado 4x ao dia, com tudo que o modelo precisa:

| Recurso TSE | Alimenta | Observação |
|-------------|----------|------------|
| `consulta_cand` (CSV) | Candidate (nome, nome de urna, partido, coligação, número, situação) | Filtrar cargo = Presidente, UF = BR |
| Fotos (JPEG, conjunto BR) | Candidate.photo | Fotos oficiais de urna |
| Bens de candidatos (CSV) | SpendingRecord (tipo assets) | Declaração oficial |
| Coligações (CSV) | Candidate.coalition | |
| Redes sociais (CSV) | Perfil do candidato | Bônus não previsto no 001 |
| **Propostas de governo (PDF, BR)** | **CandidatePosition (sourceType: platform)** | **A fonte primária de posições: documento oficial por candidato** |
| Certidões criminais (PDF) | Avaliar exibição (neutralidade sensível) | Decidir com cuidado editorial |
| DivulgaCandContas API | Receitas/despesas de campanha durante a corrida | Endpoints mudaram desde a doc de fev; validar contra a doc não oficial (augusto-herrmann/divulgacandcontas-doc) na implementação |

### Fases

**Fase A: os 13 reais no ar (bloqueador de tudo)**
Script `scripts/sync-tse-2026.ts`: baixa consulta_cand + fotos + coligações + bens, faz upsert por SQ_CANDIDATO, marca `registrationStatus` a partir da situação TSE (inclui o caso Marçal sub judice, que precisa de badge próprio com explicação neutra). Rodável via cron/manual, idempotente.

**Fase B: posições com fonte oficial**
Para cada um dos 13, extrair posições por eixo temático a partir da proposta de governo oficial (PDF do TSE), com página citada. Complementar com votações reais para quem tem mandato (Senado API para Flávio Bolsonaro; Câmara para eventuais ex-deputados entre os nanicos). Toda posição entra como pendente e passa pela aprovação no admin (FR-013, já construído). Fallback partidário do research.md continua valendo, com disclosure.

**Fase C: dinheiro da campanha**
Receitas e despesas via DivulgaCandContas com cache agressivo (a API historicamente cai sob carga). Atualização diária basta.

**Fase D: acabamento para o pico**
Home sem countdown de registro (trocar por countdown do 1º turno), OG images com dados reais, sitemap, auditoria de performance do 001 (T060) executada de fato, dado que o pico de tráfego é em outubro.

## 5. Cronograma proposto (6 semanas)

| Semana | Entrega |
|--------|---------|
| 25-31/08 | Fase A completa: 13 candidatos reais navegáveis em produção. Post build in public nº 1 |
| 01-07/09 | Fase B: posições dos 5-6 candidatos principais com fonte, quiz funcionando com dados reais |
| 08-14/09 | Fase B: nanicos cobertos (nem que seja via fallback partidário com disclosure), comparação sólida |
| 15-21/09 | Fase C: gastos de campanha + bens. Post nº 2 (transparência financeira) |
| 22-28/09 | Fase D: performance, OG, metodologia atualizada explicando o pipeline de fontes |
| 29/09-04/10 | Congelamento de features. Só correção de dados e estabilidade. Pico de tráfego |

Se o segundo turno acontecer (25/10), a plataforma se adapta quase de graça: filtro para os 2 finalistas e o quiz vira comparação direta.

## 6. Riscos

- **Situação de candidatura muda no meio do jogo** (Marçal pode ser indeferido, candidatos podem renunciar): o sync 4x/dia do TSE cobre isso, mas a UI precisa comunicar mudanças sem parecer editorial. Badge de situação com texto do próprio TSE.
- **Extração de posições de PDF é trabalho editorial, não só técnico**: é o gargalo da Fase B. Mitigação: começar pelos candidatos com maior intenção de voto, admin de aprovação já existe.
- **Neutralidade sob escrutínio**: em eleição polarizada, a metodologia pública (rota /metodologia) é o escudo. Atualizá-la antes de qualquer divulgação.
- **API do TSE instável em outubro**: tudo que é TSE entra com cache e snapshot local. A plataforma nunca depende de chamada externa em tempo de request.

## 7. Critérios de sucesso deste ciclo

- **SC-101**: Os 13 candidatos oficiais visíveis com foto, partido, coligação, número e situação de registro, sincronizados do TSE (zero dados fictícios em produção).
- **SC-102**: 100% das posições exibidas com fonte oficial citada (proposta de governo com página, ou votação com link).
- **SC-103**: Quiz retorna resultado com os candidatos reais e score de completude de dados honesto ("Baseado em X de 20 perguntas").
- **SC-104**: Situação de candidatura reflete o TSE com no máximo 24h de defasagem.
- **SC-105**: Metodologia pública atualizada descrevendo o pipeline de fontes antes de qualquer divulgação do relançamento.
