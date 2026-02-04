# EM QUEM VOTAR
## A Bússola Política do Brasil

---

# ANÁLISE ESTRATÉGICA
### Produto, Mercado, Design & Futuro

**Fevereiro 2026**

---

## Sumário

1. [Sumário Executivo](#1-sumário-executivo)
2. [Estado Atual do Projeto](#2-estado-atual-do-projeto)
3. [Análise de Mercado](#3-análise-de-mercado)
4. [Posicionamento Estratégico](#4-posicionamento-estratégico)
5. [Recomendações de Design](#5-recomendações-de-design)
6. [Landing Page](#6-landing-page)
7. [Visão de Futuro](#7-visão-de-futuro)
8. [Roadmap Sugerido](#8-roadmap-sugerido)
9. [Conclusão](#9-conclusão)

---

## 1. Sumário Executivo

O **Em Quem Votar** é uma plataforma de inteligência política apartidária, desenhada para transformar dados legislativos complexos em decisões de voto conscientes. Este documento consolida a transição de um MVP técnico para um produto de mercado robusto, focado nas eleições de 2026.

### Principais Descobertas

- **O Problema:** O eleitor brasileiro sofre de "culpa cívica" — quer votar bem, mas não tem tempo para analisar 513 deputados e 81 senadores.
- **A Lacuna:** O mercado é polarizado. As soluções existentes ou são enviesadas (rankings ideológicos) ou focam apenas no negativo (processos/corrupção).
- **A Solução:** Um "Assistente Pessoal de Voto" neutro, baseado em dados frios (votações reais) e compatibilidade ideológica (Quiz).
- **Tecnologia:** A infraestrutura atual (React Router 7 + Prisma) é "State of the Art", permitindo escala rápida e custos baixos.

### Recomendação Central

> **Pivotar de "Banco de Dados de Políticos" para "Bússola Política Pessoal".** O valor não está em mostrar a lista de todos os políticos, mas em filtrar o ruído e dizer: *"Baseado no que você acredita, estes são os seus representantes ideais."*

---

## 2. Estado Atual do Projeto

### Stack Tecnológico

| Categoria | Tecnologia |
|-----------|------------|
| **Frontend/SSR** | React Router v7 (v7.10.1) + Remix Loader Pattern |
| **Estilização** | TailwindCSS + Lucide Icons + Framer Motion |
| **Backend/ORM** | Node.js + Prisma ORM 6.2 + PostgreSQL (Supabase) |
| **Dados** | Ingestão automática via API da Câmara dos Deputados |
| **Infraestrutura** | Vercel (Edge Functions) + GitHub Actions (Cron Jobs) |

### Features Implementadas (O Core)

O produto já opera com um conjunto funcional robusto:

1.  **Busca Avançada:** Filtros facetados por Estado, Partido e Tags Temáticas.
2.  **Perfis Ricos:** Métricas de assiduidade, gastos (CEAP) e histórico auditável de votos.
3.  **Quiz de Afinidade:** Algoritmo de match que cruza respostas do usuário com votações reais.
4.  **Comparador:** Ferramenta *side-by-side* para análise direta entre candidatos.
5.  **Educação Cívica:** Biblioteca MDX com artigos sobre funcionamento do Estado.
6.  **Social:** Geração automática de OG Images (cards de compartilhamento).

---

## 3. Análise de Mercado

### 3.1 Panorama Político 2026

O cenário para 2026 projeta uma polarização contínua e um aumento na busca por fontes "neutras" devido à saturação de Fake News.
- **Demanda:** O eleitor médio busca "curadoria", não "matéria bruta".
- **Mobile:** 80%+ do tráfego político ocorre via smartphones (WhatsApp/Instagram).

### 3.2 Cenário Competitivo

#### Ranking dos Políticos
O maior player atual. Atribui notas aos parlamentares.
| Forças | Fraquezas |
|--------|-----------|
| Marca consolidada, dados organizados | **Viés ideológico claro** (critérios liberais/pró-mercado alienam a esquerda/centro) |

#### Vigie Aqui (Reclame Aqui)
Plugin famoso que destaca processos judiciais.
| Forças | Fraquezas |
|--------|-----------|
| Focadíssimo em "Ficha Limpa" | **Foco negativo**. Serve para excluir candidatos, não para escolher em quem votar. |

#### iSideWith (Global)
A referência internacional em Quizzes.
| Forças | Fraquezas |
|--------|-----------|
| Mecânica de quiz excelente | **Localização pobre**. Tradução automática, dados desatualizados do Brasil. |

#### Portais de Notícias (G1, UOL)
| Forças | Fraquezas |
|--------|-----------|
| Tráfego massivo | **Efêmeros**. Criam ferramentas apenas na semana da eleição e as abandonam. |

---

## 4. Posicionamento Estratégico

### 4.1 A Oportunidade: "Neutralidade Radical"

Enquanto os concorrentes tentam dizer quem é "Bom" ou "Ruim", o **Em Quem Votar** deve dizer **"Quem combina com VOCÊ"**.

- **Não somos juízes.** Somos o algoritmo de match.
- **Não temos viés.** A classificação vem do voto do político, não da nossa opinião.
- **Transparência:** Todo "rótulo" (ex: Ruralista) tem um *audit trail* (tooltip explicando a votação que gerou o rótulo).

### 4.2 Persona Principal

**Carlos, 29 anos**, trabalha em TI/Admin. Não acompanha o noticiário político diário. Sente-se perdido em época de eleição. Tem medo de votar "errado" ou anular. Quer uma ferramenta rápida, confiável e visual para decidir em 15 minutos.

---

## 5. Recomendações de Design

### 5.1 Nova Identidade: "Tech Neutrality"

Abandonar o visual padrão de "site governamental" e adotar uma estética de **SaaS Premium**.

| Elemento | Especificação | Função Psicológica |
|----------|---------------|-------------------|
| **Primária** | `Royal Indigo` (#4f46e5) | Sabedoria, Tecnologia, Neutralidade (foge da polarização PT x PL) |
| **Fundo** | `Slate 50` (#f8fafc) | Limpeza, clareza, reduz fadiga visual (diferente do branco puro) |
| **Positivo** | `Teal` (#0d9488) | Aprovação sem a agressividade do verde "bandeira" |
| **Negativo** | `Rose` (#e11d48) | Alerta claro, mas sofisticado |

### 5.2 Tipografia

- **Headings:** *Outfit* ou *Clash Display*. Geométricas, modernas, passam autoridade.
- **Dados/Body:** *Inter*. A fonte padrão de interfaces de alta densidade de informação.
- **Números:** *Inter (Tabular Nums)*. Essencial para tabelas de gastos e porcentagens.

### 5.3 Estilo Visual (Bento UI)

Evolução do Glassmorphism atual para **Bento Grids**:
- Cards sólidos com hierarquia clara.
- Bordas sutis (`border-slate-200`) em vez de sombras pesadas.
- **Data Visualization:** Substituir tabelas longas por gráficos de radar e barras de progresso.

---

## 6. Landing Page

### 6.1 Estrutura de Copywriting

**Hero:**
> "Descubra quem realmente representa você."

**Subheadline:**
> "Sem viés ideológico. Sem fake news. Apenas dados. O único assistente eleitoral que cruza seus valores com as votações reais do Congresso."

**CTA Principal:**
> "Fazer o Quiz de Afinidade"

### 6.2 Seções Obrigatórias

1.  **O Quiz (Hook):** "Responda 10 perguntas e veja seu Match."
2.  **Como Funciona:** "Nós rastreamos as leis, você descobre a verdade."
3.  **Transparência:** "Código aberto e dados oficiais da Câmara."
4.  **Social Proof:** "Mais de X mil comparações feitas hoje."

---

## 7. Visão de Futuro

### 7.1 Jornada de Evolução

| Fase | Foco | Entregáveis Chave |
|------|------|-------------------|
| **1** | **Engajamento (Agora)** | Quiz viral (compartilhável), Design System 2.0, Comparador Visual. |
| **2** | **Contexto Local** | Integração com API de Emendas: *"Quem mandou dinheiro para minha cidade?"* |
| **3** | **Utilidade Eleitoral** | Integração TSE (Candidatos novos), Cola Digital (App para o dia da votação). |

### 7.2 Monetização e Sustentabilidade

O foco inicial é crescimento, mas caminhos éticos existem:
1.  **Doações/Apoio:** "Mantenha a democracia transparente".
2.  **Dados Agregados (B2B):** Venda de relatórios de tendências anonimizados (ex: "O que o eleitor de SP mais valoriza: Segurança ou Saúde?").
3.  **Versão Pro (B2C):** Acompanhamento ilimitado de políticos via WhatsApp.

---

## 8. Roadmap Sugerido

### Q1 2026 (Refinamento & Identidade)

- [ ] **Redesign Completo:** Implementar paleta Indigo/Slate e remover Glassmorphism excessivo.
- [ ] **Página de Resultado do Match:** Transformar o fim do quiz em uma experiência visual ("Spotify Wrapped" da política).
- [ ] **OG Images 2.0:** Cards de compartilhamento dinâmicos com a foto e match do político.

### Q2 2026 (Dados & Contexto)

- [ ] **Geolocalização de Verbas:** Cruzar dados de emendas com CEP do usuário.
- [ ] **IA Resumidora:** Implementar LLM para traduzir "juridiquês" das ementas de leis.
- [ ] **Feature "Watchlist":** Permitir seguir políticos e criar um feed personalizado.

### Q3 2026 (Pré-Campanha)

- [ ] **Integração TSE:** Ingerir dados de todos os candidatos registrados (não só quem tem mandato).
- [ ] **Raio-X Patrimonial:** Gráficos de evolução de bens dos candidatos.
- [ ] **Gamification:** "Bingo dos Debates" para viralização em tempo real.

### Q4 2026 (Reta Final - Eleições)

- [ ] **Cola Digital:** Feature para montar a lista de candidatos e levar para a urna (Offline).
- [ ] **Modo "Lite":** Otimização extrema para 4G no dia da eleição.
- [ ] **Auditoria Pós-Urna:** Comparar resultado das urnas com a base de usuários do app.

---

## 9. Conclusão

O **Em Quem Votar** tem o potencial de se tornar a ferramenta cívica mais importante de 2026. A base técnica é sólida e escalável. O diferencial competitivo — a **Neutralidade Radical baseada em Dados** — preenche uma lacuna gigantesca deixada pela polarização.

Com o polimento visual sugerido e o foco em funcionalidades de utilidade real (como a Cola Digital e o Match Local), o projeto deixará de ser um "app de portfólio" para se tornar um serviço essencial para a democracia brasileira.

---

*Documento gerado em Fevereiro de 2026*