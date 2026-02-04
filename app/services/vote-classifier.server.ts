import { generateObject } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import { db } from "~/utils/db.server";

// Configuração do Vercel AI Gateway
const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: "https://gateway.ai.vercel.com/v1",
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
};
