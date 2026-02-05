import { generateObject } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import { db } from "~/utils/db.server";

// Configuração do Vercel AI Gateway
const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: "https://ai-gateway.vercel.sh/v1",
});

// Schema para resposta da IA
const VoteClassificationSchema = z.object({
  category: z.string().describe("Categoria principal (ex: Economia, Segurança Pública, Tecnologia)"),
  tagSim: z.object({
    slug: z.string().describe("Slug da tag em kebab-case"),
    name: z.string().describe("Nome legível da tag"),
    isNew: z.boolean().describe("Se é uma nova tag não existente"),
  }),
  tagNao: z.object({
    slug: z.string().describe("Slug da tag em kebab-case"),
    name: z.string().describe("Nome legível da tag"),
    isNew: z.boolean().describe("Se é uma nova tag não existente"),
  }),
  relevance: z.number().min(1).max(10).describe("Relevância da votação para perfil político (1-10)"),
  reasoning: z.string().describe("Breve justificativa da classificação"),
});

export type VoteClassification = z.infer<typeof VoteClassificationSchema>;

// Exemplos existentes para few-shot learning
const EXAMPLES = `
## EXEMPLOS DE CLASSIFICAÇÃO:

1. **"Reforma Tributária (1º Turno)"**
   - Categoria: Economia
   - Tag SIM: { slug: "reformista-economico", name: "Reformista Econômico" }
   - Tag NÃO: { slug: "conservador-economico", name: "Conservador Econômico" }

2. **"Marco Temporal"**
   - Categoria: Agro & Meio Ambiente
   - Tag SIM: { slug: "ruralista", name: "Ruralista" }
   - Tag NÃO: { slug: "ambientalista", name: "Ambientalista" }

3. **"PL das Fake News"**
   - Categoria: Tecnologia & Comunicação
   - Tag SIM: { slug: "regulacao-digital", name: "Regulação Digital" }
   - Tag NÃO: { slug: "liberdade-digital", name: "Liberdade Digital" }

4. **"Privatização Eletrobras"**
   - Categoria: Economia
   - Tag SIM: { slug: "liberal", name: "Liberal" }
   - Tag NÃO: { slug: "estatista", name: "Estatista" }

5. **"Prisão Chiquinho Brazão"**
   - Categoria: Segurança Pública
   - Tag SIM: { slug: "rigoroso", name: "Rigoroso" }
   - Tag NÃO: { slug: "garantista", name: "Garantista" }

6. **"PEC da Transição"**
   - Categoria: Economia
   - Tag SIM: { slug: "base-governo", name: "Base do Governo" }
   - Tag NÃO: { slug: "oposicao-governo", name: "Oposição ao Governo" }

7. **"Arcabouço Fiscal"**
   - Categoria: Economia
   - Tag SIM: { slug: "governista-flexivel", name: "Governista" }
   - Tag NÃO: { slug: "oposicao-rigoroso", name: "Oposição Rigorosa" }
`;

// Tags existentes no sistema
const EXISTING_TAGS = `
## TAGS EXISTENTES (prefira usar quando aplicável):

**Economia**: reformista-economico, conservador-economico, liberal, estatista, base-governo, oposicao-governo, governista-flexivel
**Segurança**: rigoroso, garantista
**Agro/Ambiente**: ruralista, ambientalista
**Tecnologia**: regulacao-digital, liberdade-digital
**Costumes**: conservador-costumes, progressista-costumes
**Uso de Verba**: baixo-custo, gastao
**Assiduidade**: assiduo, ausente
**Perfil**: novato, veterano

Se nenhuma tag existente se aplica, você pode criar uma nova (isNew: true).
`;

export const VoteClassifierService = {
  /**
   * Classifica uma votação usando IA
   */
  async classify(title: string, description: string | null): Promise<VoteClassification> {
    const prompt = `Você é um especialista em política brasileira. Analise a votação abaixo e classifique-a para ajudar cidadãos a entenderem o posicionamento político dos deputados.

${EXAMPLES}

${EXISTING_TAGS}

## VOTAÇÃO PARA CLASSIFICAR:

**Título**: ${title}
**Descrição**: ${description || "Não disponível"}

Classifique esta votação considerando:
1. Qual a pauta principal?
2. Que posicionamento político indica votar SIM?
3. Que posicionamento político indica votar NÃO?
4. Qual a relevância para definir o perfil do político?

Retorne tags que sejam opostas e representem bem os dois lados do debate.`;

    const { object } = await generateObject({
      model: openai("gpt-4o-mini"),
      schema: VoteClassificationSchema,
      prompt,
    });

    return object;
  },

  /**
   * Classifica e salva uma votação como pendente
   */
  async classifyAndSave(billId: string, title: string, description: string | null) {
    try {
      const classification = await this.classify(title, description);

      // Criar tags novas se necessário
      if (classification.tagSim.isNew) {
        await db.tag.upsert({
          where: { slug: classification.tagSim.slug },
          update: {},
          create: {
            slug: classification.tagSim.slug,
            name: classification.tagSim.name,
            category: classification.category,
          },
        });
      }

      if (classification.tagNao.isNew) {
        await db.tag.upsert({
          where: { slug: classification.tagNao.slug },
          update: {},
          create: {
            slug: classification.tagNao.slug,
            name: classification.tagNao.name,
            category: classification.category,
          },
        });
      }

      // Atualizar Bill com classificação
      await db.bill.update({
        where: { id: billId },
        data: {
          status: "pending",
          aiConfidence: classification.relevance * 10, // 1-10 → 10-100
          suggestedTagSim: classification.tagSim.slug,
          suggestedTagNao: classification.tagNao.slug,
          suggestedCategory: classification.category,
          lastSyncAt: new Date(),
        },
      });

      return { success: true, classification };
    } catch (error) {
      console.error(`[VoteClassifier] Error classifying bill ${billId}:`, error);
      return { success: false, error };
    }
  },

  /**
   * Gera título e descrição simplificados em linguagem acessível
   */
  async simplifyDescription(title: string, description: string | null): Promise<{ title: string; description: string }> {
    const prompt = `Você é um redator que explica votações para cidadãos leigos.

Transforme o conteúdo abaixo em texto claro, simples e factual:

Título de entrada: ${title}
Fatos disponíveis: ${description || "Não disponível"}

Regras obrigatórias:
- Use APENAS fatos explícitos no texto de entrada
- NÃO invente contexto, intenção política, conflito ideológico ou resultado
- Se faltarem informações, diga claramente "não informado"
- Não afirme o que SIM e NÃO defendem sem evidência textual
- Preserve números e placar exatamente como recebidos
- Escreva em português simples, sem jargão jurídico
- Não use markdown, listas ou emojis

Formato de saída:
- title: até 100 caracteres, direto e específico
- description: 3 a 5 frases curtas, em um único parágrafo`;

    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      try {
        const { object } = await generateObject({
          model: openai("gpt-4o-mini"),
          schema: z.object({
            title: z.string().describe("Título simplificado da votação (máx 100 chars)"),
            description: z.string().describe("Explicação simplificada da votação"),
          }),
          prompt,
        });

        return {
          title: object.title,
          description: object.description,
        };
      } catch (error: any) {
        attempts++;
        console.error(`[VoteClassifier] Attempt ${attempts} failed:`, error.message);
        
        if (attempts >= maxAttempts) {
          console.error("[VoteClassifier] Max attempts reached.");
          return {
            title: title.substring(0, 100), // Fallback: truncar título original
            description: "Não foi possível gerar uma descrição simplificada para esta votação.",
          };
        }
        
        // Wait before retry
        await new Promise(r => setTimeout(r, 2000 * attempts));
      }
    }

    return {
      title: title.substring(0, 100),
      description: "Não foi possível gerar uma descrição simplificada para esta votação.",
    };
  },
};
