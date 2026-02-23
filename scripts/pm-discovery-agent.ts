import * as fs from "node:fs";
import * as path from "node:path";

type DiscoveryArea = "produto" | "dados-ia" | "growth" | "operacoes";
type DiscoveryType = "bug" | "improvement" | "experiment" | "tech-debt";
type RoadmapHorizon = "now" | "next" | "later";

interface Signal {
  id: string;
  category: string;
  severity: "low" | "medium" | "high";
  message: string;
  evidence: string[];
  sources: string[];
  featureHint?: {
    title: string;
    hypothesis: string;
    acceptanceCriteria: string[];
    horizon?: RoadmapHorizon;
  };
}

interface RiceScore {
  reach: number;
  impact: number;
  confidence: number;
  effort: number;
  score: number;
}

interface Opportunity {
  key: string;
  title: string;
  area: DiscoveryArea;
  type: DiscoveryType;
  horizon: RoadmapHorizon;
  confidenceLabel: "confidence:high" | "confidence:medium" | "confidence:low";
  problem: string;
  evidence: string[];
  hypothesis: string;
  acceptanceCriteria: string[];
  risks: string[];
  sources: string[];
  rice: RiceScore;
}

interface ExistingIssue {
  id: string;
  identifier: string;
  title: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  labels: string[];
  priority?: number | null;
  stateType: string;
}

interface SyncDecision {
  create: Opportunity[];
  update: Array<{ issue: ExistingIssue; opportunity: Opportunity; reason: string }>;
  discarded: Array<{ opportunity: Opportunity; reason: string }>;
}

interface SyncResult {
  created: Array<{ id: string; identifier: string; title: string; rice: number }>;
  updated: Array<{ id: string; identifier: string; title: string; reason: string }>;
  discarded: Array<{ title: string; reason: string }>;
  errors: string[];
  limits: {
    dailyUsed: number;
    dailyLimit: number;
    weeklyUsed: number;
    weeklyLimit: number;
  };
}

interface DiscoveryDigest {
  startedAt: string;
  finishedAt: string;
  summary: SyncResult;
  signals: Signal[];
}

interface LinearIssueInput {
  teamId: string;
  projectId: string;
  title: string;
  description: string;
  labelIds?: string[];
  stateId?: string;
  priority?: number;
}

const CONFIG = {
  linearApiKey: process.env.LINEAR_API_KEY || "",
  linearTeamId: process.env.LINEAR_TEAM_ID || "9ff40ef2-8b34-4cd1-b7e2-f9d9c9ba5c7e",
  linearProjectName: process.env.LINEAR_PROJECT_NAME || "Em Quem Votar - Product Discovery",
  linearDigestIssueTitle: process.env.LINEAR_DIGEST_TITLE || "Discovery Daily Digest",
  backlogStateName: process.env.LINEAR_BACKLOG_STATE || "Backlog",
  dailyLimit: Number(process.env.PM_DISCOVERY_DAILY_LIMIT || 5),
  weeklyLimit: Number(process.env.PM_DISCOVERY_WEEKLY_LIMIT || 20),
  featureOverridePerRun: Number(process.env.PM_DISCOVERY_FEATURE_OVERRIDE_PER_RUN || 1),
  weeklyMaintenanceDay: Number(process.env.PM_DISCOVERY_WEEKLY_MAINTENANCE_DAY || 1), // 1=segunda
  staleDays: Number(process.env.PM_DISCOVERY_STALE_DAYS || 21),
  dryRun: process.env.DRY_RUN === "1",
  repoRoot: process.cwd(),
};

const REQUIRED_LABELS = [
  "source:agent-pm",
  "area:produto",
  "area:dados-ia",
  "area:growth",
  "area:operacoes",
  "type:bug",
  "type:improvement",
  "type:experiment",
  "type:tech-debt",
  "horizon:now",
  "horizon:next",
  "horizon:later",
  "status:stale-review",
  "confidence:high",
  "confidence:medium",
  "confidence:low",
];

interface FeatureGapSpec {
  id: string;
  severity: "low" | "medium" | "high";
  anchorAny: string[];
  missingAll: string[];
  message: string;
  evidence: string[];
  hint: Signal["featureHint"];
}

interface AppContext {
  mission: string | null;
  currentCoverage: string | null;
  hasDeputadoCoverage: boolean;
  hasSenadorCoverage: boolean;
  hasCamaraVotes: boolean;
  hasSenadoVotes: boolean;
  hasNewsletter: boolean;
  hasPersonalizedAlerts: boolean;
}

const FEATURE_GAP_CATALOG: FeatureGapSpec[] = [
  {
    id: "senadores",
    severity: "high",
    anchorAny: ["/deputados", "deputado", "513 deputados", "camara dos deputados"],
    missingAll: ["/senadores", "senadores", "senador"],
    message: "Cobertura de parlamentares incompleta: aplicacao usa deputados, mas nao cobre senadores.",
    evidence: [
      "Foram detectados sinais de cobertura de deputados no produto.",
      "Nao foi detectada cobertura equivalente para senadores.",
    ],
    hint: {
      title: "Projeto sobre cobertura de senadores no produto",
      hypothesis:
        "Se adicionarmos senadores com filtros e perfil equivalentes aos deputados, aumentaremos cobertura e valor para o eleitor.",
      acceptanceCriteria: [
        "Ingerir e atualizar base de senadores com identificadores estaveis.",
        "Disponibilizar listagem de senadores com filtros principais (partido, UF e busca).",
        "Exibir perfil de senador com dados basicos e historico de votacoes quando disponivel.",
      ],
      horizon: "next",
    },
  },
  {
    id: "votacoes-senado",
    severity: "medium",
    anchorAny: ["votacoes", "votação", "dadosabertos.camara.leg.br", "camara.leg.br"],
    missingAll: ["dadosabertos.senado.leg.br", "senado.leg.br", "api de votacoes do senado"],
    message: "Cobertura de votacoes focada na Camara; oportunidade de expandir para Senado Federal.",
    evidence: [
      "Fluxo atual de votacoes usa predominantemente fontes da Camara.",
      "Nao foram detectadas integracoes de votacoes equivalentes do Senado.",
    ],
    hint: {
      title: "Projeto sobre cobertura de votacoes do Senado Federal",
      hypothesis:
        "Se agregarmos votacoes do Senado com o mesmo padrao de explicacao leiga, o produto ganha amplitude e comparabilidade institucional.",
      acceptanceCriteria: [
        "Definir fonte oficial de votacoes do Senado e contrato de ingestao.",
        "Classificar e simplificar descricoes de votacoes do Senado no mesmo padrao da Camara.",
        "Permitir filtro por casa legislativa (Camara/Senado) na navegacao de votacoes.",
      ],
      horizon: "next",
    },
  },
];

function nowIso() {
  return new Date().toISOString();
}

function startOfTodayIso() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function daysAgoIso(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function toTokens(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter(token => token.length > 2);
}

function jaccardSimilarity(a: string, b: string) {
  const sa = new Set(toTokens(a));
  const sb = new Set(toTokens(b));
  if (!sa.size || !sb.size) return 0;

  let inter = 0;
  for (const token of sa) {
    if (sb.has(token)) inter += 1;
  }
  const union = sa.size + sb.size - inter;
  return union === 0 ? 0 : inter / union;
}

function toPriorityFromRice(score: number) {
  if (score >= 180) return 1;
  if (score >= 100) return 2;
  if (score >= 50) return 3;
  return 4;
}

class LinearClient {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async request<T = any>(query: string, variables: Record<string, any> = {}): Promise<T> {
    const response = await fetch("https://api.linear.app/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: this.apiKey,
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Linear HTTP ${response.status}: ${body.slice(0, 4000)}`);
    }

    const payload = await response.json();
    if (payload.errors?.length) {
      const message = payload.errors.map((e: any) => e.message).join(" | ");
      throw new Error(`Linear GraphQL: ${message}`);
    }

    return payload.data as T;
  }

  async getTeam(id: string) {
    const data = await this.request<{ team: { id: string; name: string } }>(
      `
      query Team($id: String!) {
        team(id: $id) {
          id
          name
        }
      }
      `,
      { id }
    );
    return data.team;
  }

  async listProjects(teamId: string) {
    const data = await this.request<{ team: { projects: { nodes: Array<{ id: string; name: string }> } } }>(
      `
      query Projects($teamId: String!) {
        team(id: $teamId) {
          projects {
            nodes {
              id
              name
            }
          }
        }
      }
      `,
      { teamId }
    );
    return data.team?.projects?.nodes || [];
  }

  async createProject(teamId: string, name: string) {
    const data = await this.request<{ projectCreate: { success: boolean; project: { id: string; name: string } } }>(
      `
      mutation CreateProject($input: ProjectCreateInput!) {
        projectCreate(input: $input) {
          success
          project {
            id
            name
          }
        }
      }
      `,
      {
        input: {
          teamIds: [teamId],
          name,
          summary: "Backlog continuo de discovery de produto, dados, growth e operacoes",
          description:
            "Projeto operado por agente PM para descobrir oportunidades, priorizar por RICE e manter backlog acionavel com deduplicacao e guardrails.",
          priority: 3,
        },
      }
    );
    return data.projectCreate.project;
  }

  async listLabels(teamId: string) {
    const data = await this.request<{ issueLabels: { nodes: Array<{ id: string; name: string }> } }>(
      `
      query Labels {
        issueLabels(first: 250) {
          nodes {
            id
            name
          }
        }
      }
      `
    );
    return data.issueLabels.nodes;
  }

  async createLabel(teamId: string, name: string) {
    const data = await this.request<{ issueLabelCreate: { success: boolean; issueLabel: { id: string; name: string } } }>(
      `
      mutation CreateLabel($input: IssueLabelCreateInput!) {
        issueLabelCreate(input: $input) {
          success
          issueLabel {
            id
            name
          }
        }
      }
      `,
      {
        input: {
          teamId,
          name,
        },
      }
    );
    return data.issueLabelCreate.issueLabel;
  }

  async listStatuses(teamId: string) {
    const data = await this.request<{ team: { states: { nodes: Array<{ id: string; name: string; type: string }> } } }>(
      `
      query States($teamId: String!) {
        team(id: $teamId) {
          states {
            nodes {
              id
              name
              type
            }
          }
        }
      }
      `,
      { teamId }
    );
    return data.team?.states?.nodes || [];
  }

  async listProjectIssues(projectId: string) {
    const data = await this.request<{
      project: {
        issues: {
        nodes: Array<{
          id: string;
          identifier: string;
          title: string;
          description: string;
          createdAt: string;
          updatedAt: string;
          priority?: number | null;
          state: { type: string };
          labels: { nodes: Array<{ name: string }> };
        }>;
      };
      };
    }>(
      `
      query ProjectIssues($projectId: String!) {
        project(id: $projectId) {
          issues(orderBy: updatedAt, first: 250) {
            nodes {
              id
              identifier
              title
              description
              createdAt
              updatedAt
              priority
              state { type }
              labels { nodes { name } }
            }
          }
        }
      }
      `,
      { projectId }
    );

    const nodes = data.project?.issues?.nodes || [];
    return nodes.map(node => ({
      id: node.id,
      identifier: node.identifier,
      title: node.title || "",
      description: node.description || "",
      createdAt: node.createdAt,
      updatedAt: node.updatedAt,
      labels: node.labels.nodes.map(label => label.name),
      priority: typeof node.priority === "number" ? node.priority : null,
      stateType: node.state?.type || "backlog",
    })) as ExistingIssue[];
  }

  async createIssue(input: LinearIssueInput) {
    const attempts = [
      {
        teamId: input.teamId,
        projectId: input.projectId,
        title: input.title,
        description: input.description,
        labelIds: input.labelIds || [],
        stateId: input.stateId,
        priority: input.priority,
      },
      {
        teamId: input.teamId,
        projectId: input.projectId,
        title: input.title,
        description: input.description,
        stateId: input.stateId,
        priority: input.priority,
      },
      {
        teamId: input.teamId,
        projectId: input.projectId,
        title: input.title,
        description: input.description,
        priority: input.priority,
      },
      {
        teamId: input.teamId,
        title: input.title,
        description: input.description,
        priority: input.priority,
      },
    ];

    let lastError: unknown;
    for (const payload of attempts) {
      try {
        const data = await this.request<{ issueCreate: { success: boolean; issue: { id: string; identifier: string; title: string } } }>(
          `
          mutation CreateIssue($input: IssueCreateInput!) {
            issueCreate(input: $input) {
              success
              issue {
                id
                identifier
                title
              }
            }
          }
          `,
          { input: payload }
        );
        return data.issueCreate.issue;
      } catch (error) {
        lastError = error;
      }
    }

    if (lastError instanceof Error) throw lastError;
    throw new Error("Falha desconhecida ao criar issue");
  }

  async updateIssueLabels(issueId: string, labelIds: string[]) {
    await this.request(
      `
      mutation UpdateIssueLabels($id: String!, $input: IssueUpdateInput!) {
        issueUpdate(id: $id, input: $input) {
          success
        }
      }
      `,
      {
        id: issueId,
        input: {
          labelIds,
        },
      }
    );
  }

  async updateIssue(issueId: string, title: string, description: string, priority: number) {
    const data = await this.request<{ issueUpdate: { success: boolean } }>(
      `
      mutation UpdateIssue($id: String!, $input: IssueUpdateInput!) {
        issueUpdate(id: $id, input: $input) {
          success
        }
      }
      `,
      {
        id: issueId,
        input: {
          title,
          description,
          priority,
        },
      }
    );
    return data.issueUpdate.success;
  }

  async updateIssuePriority(issueId: string, priority: number) {
    await this.request(
      `
      mutation UpdateIssuePriority($id: String!, $input: IssueUpdateInput!) {
        issueUpdate(id: $id, input: $input) {
          success
        }
      }
      `,
      {
        id: issueId,
        input: { priority },
      }
    );
  }

  async createComment(issueId: string, body: string) {
    await this.request(
      `
      mutation Comment($input: CommentCreateInput!) {
        commentCreate(input: $input) {
          success
        }
      }
      `,
      {
        input: {
          issueId,
          body,
        },
      }
    );
  }
}

function scanTextFiles(rootDir: string, maxBytes = 400_000) {
  const files: string[] = [];
  const stack = [rootDir];
  const skip = new Set(["node_modules", ".git", "build", "coverage", ".react-router"]);

  while (stack.length) {
    const current = stack.pop()!;
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (!skip.has(entry.name)) stack.push(full);
        continue;
      }
      if (!entry.isFile()) continue;

      const ext = path.extname(entry.name).toLowerCase();
      if (![".ts", ".tsx", ".js", ".jsx", ".md", ".yml", ".yaml", ".json", ".sql"].includes(ext)) continue;

      const stat = fs.statSync(full);
      if (stat.size > maxBytes) continue;
      files.push(full);
    }
  }
  return files;
}

function buildCorpus(files: string[]) {
  return files
    .map(file => {
      try {
        return fs.readFileSync(file, "utf8").toLowerCase();
      } catch {
        return "";
      }
    })
    .join("\n");
}

function readOptionalFile(filePath: string) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
}

function inferAppContext(files: string[]): AppContext {
  const corpus = buildCorpus(files);
  const aboutFile = readOptionalFile(path.join(CONFIG.repoRoot, "app", "routes", "sobre.mdx")) || "";

  const missionMatch = aboutFile.match(/democratizar o acesso [^.\n]+/i);
  const coverageMatch = aboutFile.match(/cobertura atual:[^\n]+/i);

  const hasDeputadoCoverage =
    corpus.includes("/deputados") || corpus.includes("deputado") || /513 deputados/i.test(aboutFile);
  const hasSenadorCoverage = corpus.includes("/senadores") || /\bsenadores?\b/i.test(corpus);
  const hasCamaraVotes = corpus.includes("dadosabertos.camara.leg.br") || corpus.includes("camara.leg.br");
  const hasSenadoVotes = corpus.includes("dadosabertos.senado.leg.br") || corpus.includes("senado.leg.br/api");
  const hasNewsletter = corpus.includes("api/newsletter") || corpus.includes("newsletter");
  const hasPersonalizedAlerts =
    corpus.includes("alertas personalizados") ||
    corpus.includes("preferencias de alerta") ||
    corpus.includes("seguir politico");

  return {
    mission: missionMatch ? missionMatch[0].trim() : null,
    currentCoverage: coverageMatch ? coverageMatch[0].trim() : null,
    hasDeputadoCoverage,
    hasSenadorCoverage,
    hasCamaraVotes,
    hasSenadoVotes,
    hasNewsletter,
    hasPersonalizedAlerts,
  };
}

function detectFeatureGaps(files: string[]): Signal[] {
  const corpus = buildCorpus(files);
  const context = inferAppContext(files);
  const signals: Signal[] = [];

  for (const spec of FEATURE_GAP_CATALOG) {
    const hasAnchor = spec.anchorAny.some(token => corpus.includes(token.toLowerCase()));
    const missingAll = spec.missingAll.every(token => !corpus.includes(token.toLowerCase()));
    if (!hasAnchor || !missingAll) continue;

    signals.push({
      id: `feature-gap-${spec.id}`,
      category: "feature-gap",
      severity: spec.severity,
      message: spec.message,
      evidence: [
        ...(context.mission ? [`Missao do produto: ${context.mission}`] : []),
        ...(context.currentCoverage ? [context.currentCoverage] : []),
        ...spec.evidence,
      ],
      sources: ["codigo", "linear"],
      featureHint: spec.hint,
    });
  }

  if (context.hasNewsletter && !context.hasPersonalizedAlerts) {
    signals.push({
      id: "feature-gap-alertas-personalizados",
      category: "feature-gap",
      severity: "medium",
      message: "Canal de newsletter existe, mas faltam alertas personalizados por interesse do eleitor.",
      evidence: [
        ...(context.mission ? [`Missao do produto: ${context.mission}`] : []),
        "Foi detectada estrutura de newsletter no app.",
        "Nao foram detectadas preferencias de alerta por tema, politico ou casa legislativa.",
      ],
      sources: ["codigo", "linear"],
      featureHint: {
        title: "Projeto sobre alertas personalizados de votacoes e politicos",
        hypothesis:
          "Se permitirmos alertas por tema, politico e casa legislativa, o engajamento recorrente do usuario tende a aumentar.",
        acceptanceCriteria: [
          "Definir preferencias de alerta por tema, parlamentar e casa legislativa.",
          "Permitir opt-in/out granular para cada tipo de alerta.",
          "Enviar alertas somente para eventos relevantes conforme preferencias salvas.",
        ],
        horizon: "next",
      },
    });
  }

  if (context.hasDeputadoCoverage && !context.hasSenadorCoverage) {
    const already = signals.some(signal => signal.id === "feature-gap-senadores");
    if (!already) {
      signals.push({
        id: "feature-gap-senadores",
        category: "feature-gap",
        severity: "high",
        message: "Cobertura de parlamentares incompleta no horizonte do produto: falta camada de senadores.",
        evidence: [
          ...(context.mission ? [`Missao do produto: ${context.mission}`] : []),
          ...(context.currentCoverage ? [context.currentCoverage] : []),
          "Sinais de cobertura de deputados detectados no app.",
          "Nao foi detectada cobertura equivalente de senadores.",
        ],
        sources: ["codigo", "linear"],
        featureHint: {
          title: "Projeto sobre cobertura de senadores no produto",
          hypothesis:
            "Se adicionarmos senadores com filtros e perfil equivalentes aos deputados, aumentaremos cobertura e utilidade para decisao eleitoral.",
          acceptanceCriteria: [
            "Ingerir e atualizar base de senadores com identificadores estaveis.",
            "Disponibilizar listagem de senadores com filtros principais (partido, UF e busca).",
            "Exibir perfil de senador com dados basicos e historico de votacoes quando disponivel.",
          ],
          horizon: "next",
        },
      });
    }
  }

  if (context.hasCamaraVotes && !context.hasSenadoVotes) {
    const already = signals.some(signal => signal.id === "feature-gap-votacoes-senado");
    if (!already) {
      signals.push({
        id: "feature-gap-votacoes-senado",
        category: "feature-gap",
        severity: "medium",
        message: "Cobertura de votacoes focada na Camara; falta trilha equivalente do Senado no produto.",
        evidence: [
          ...(context.currentCoverage ? [context.currentCoverage] : []),
          "Fontes de votacao da Camara detectadas no pipeline.",
          "Nao foram detectadas fontes equivalentes de votacoes do Senado.",
        ],
        sources: ["codigo", "linear"],
        featureHint: {
          title: "Projeto sobre cobertura de votacoes do Senado Federal",
          hypothesis:
            "Se agregarmos votacoes do Senado com o mesmo padrao de explicacao leiga, o produto aumenta amplitude e valor informativo.",
          acceptanceCriteria: [
            "Definir fonte oficial de votacoes do Senado e contrato de ingestao.",
            "Classificar e simplificar descricoes das votacoes do Senado no mesmo padrao da Camara.",
            "Permitir filtro por casa legislativa (Camara/Senado) na navegacao de votacoes.",
          ],
          horizon: "next",
        },
      });
    }
  }

  return signals;
}

function collectSignals(existingIssues: ExistingIssue[]): Signal[] {
  const signals: Signal[] = [];
  const files = scanTextFiles(CONFIG.repoRoot);
  const filesForFeatureGap = files.filter(file => !file.endsWith(path.join("scripts", "pm-discovery-agent.ts")));

  let todoCount = 0;
  const todoEvidence: string[] = [];
  for (const file of files) {
    const content = fs.readFileSync(file, "utf8");
    const matches = content.match(/TODO|FIXME|HACK|XXX/g);
    if (!matches) continue;
    todoCount += matches.length;
    if (todoEvidence.length < 10) {
      todoEvidence.push(`${path.relative(CONFIG.repoRoot, file)} (${matches.length})`);
    }
  }
  if (todoCount > 0) {
    signals.push({
      id: "repo-todo-density",
      category: "code-health",
      severity: todoCount > 40 ? "high" : todoCount > 15 ? "medium" : "low",
      message: `Backlog tecnico implicito detectado em comentarios de codigo (${todoCount} marcacoes).`,
      evidence: todoEvidence,
      sources: ["codigo"],
    });
  }

  const workflowDir = path.join(CONFIG.repoRoot, ".github", "workflows");
  if (fs.existsSync(workflowDir)) {
    const workflows = fs.readdirSync(workflowDir).filter(file => file.endsWith(".yml") || file.endsWith(".yaml"));
    signals.push({
      id: "ops-workflows",
      category: "operability",
      severity: workflows.length >= 3 ? "medium" : "low",
      message: `Projeto possui ${workflows.length} workflows de automacao, oportunidade para observabilidade e consolidacao.`,
      evidence: workflows.map(file => `.github/workflows/${file}`),
      sources: ["codigo"],
    });
  }

  const coverageFile = path.join(CONFIG.repoRoot, "coverage", "coverage-summary.json");
  if (fs.existsSync(coverageFile)) {
    try {
      const coverage = JSON.parse(fs.readFileSync(coverageFile, "utf8"));
      const linePct = Number(coverage?.total?.lines?.pct || 0);
      signals.push({
        id: "quality-coverage",
        category: "quality",
        severity: linePct < 50 ? "high" : linePct < 70 ? "medium" : "low",
        message: `Cobertura de testes em linhas: ${linePct.toFixed(1)}%.`,
        evidence: [`coverage/coverage-summary.json (lines=${linePct.toFixed(1)}%)`],
        sources: ["metricas"],
      });
    } catch {
      signals.push({
        id: "quality-coverage-missing",
        category: "quality",
        severity: "medium",
        message: "Arquivo de cobertura existente, mas invalido para leitura automatica.",
        evidence: ["coverage/coverage-summary.json"],
        sources: ["metricas"],
      });
    }
  } else {
    signals.push({
      id: "quality-coverage-absent",
      category: "quality",
      severity: "medium",
      message: "Nao ha resumo de cobertura versionado para discovery orientado por qualidade.",
      evidence: ["coverage/coverage-summary.json ausente"],
      sources: ["metricas"],
    });
  }

  const openIssues = existingIssues.filter(issue => issue.stateType !== "completed" && issue.stateType !== "canceled");
  signals.push({
    id: "linear-open-issues",
    category: "backlog-health",
    severity: openIssues.length > 60 ? "high" : openIssues.length > 25 ? "medium" : "low",
    message: `Backlog atual possui ${openIssues.length} issues abertas/ativas.`,
    evidence: openIssues.slice(0, 10).map(issue => `${issue.identifier}: ${issue.title}`),
    sources: ["linear"],
  });

  const staleIssues = openIssues.filter(issue => {
    const created = new Date(issue.createdAt).getTime();
    return Date.now() - created > 1000 * 60 * 60 * 24 * 21;
  });
  if (staleIssues.length > 0) {
    signals.push({
      id: "linear-stale",
      category: "backlog-health",
      severity: staleIssues.length > 20 ? "high" : "medium",
      message: `${staleIssues.length} issues com mais de 21 dias sem fechamento detectadas.`,
      evidence: staleIssues.slice(0, 10).map(issue => `${issue.identifier}: ${issue.title}`),
      sources: ["linear"],
    });
  }

  const metricsGap = fs.existsSync(path.join(CONFIG.repoRoot, ".env"))
    ? "Nao ha conectores explicitos de metricas de funil/uso no pipeline de discovery."
    : "Ambiente sem arquivo local .env para inferir fontes de metricas externas.";
  signals.push({
    id: "metrics-gap",
    category: "growth",
    severity: "medium",
    message: metricsGap,
    evidence: ["Sem coleta automatica de eventos de produto no repositorio."],
    sources: ["metricas"],
  });

  signals.push(...detectFeatureGaps(filesForFeatureGap));

  return signals;
}

function scoreWithRice(signal: Signal): RiceScore {
  if (signal.category === "feature-gap") {
    const reach = 5;
    const impact = 2;
    const confidence = 80;
    const effort = 5;
    const score = (reach * impact * confidence) / effort;
    return { reach, impact, confidence, effort, score };
  }

  const severityFactor = signal.severity === "high" ? 1 : signal.severity === "medium" ? 0.8 : 0.5;
  const reach = signal.category === "growth" ? 4 : signal.category === "quality" ? 3 : 3;
  const impact = signal.severity === "high" ? 2 : signal.severity === "medium" ? 1 : 0.5;
  const confidence = signal.sources.includes("metricas") ? 80 : 70;
  const effortBase = signal.category === "operability" ? 3 : signal.category === "growth" ? 4 : 3;
  const effort = Math.max(1, Math.round(effortBase * (2 - severityFactor)));
  const score = (reach * impact * confidence) / effort;
  return { reach, impact, confidence, effort, score };
}

function inferHorizon(signal: Signal): RoadmapHorizon {
  if (signal.featureHint?.horizon) return signal.featureHint.horizon;
  if (signal.category === "feature-gap") return "next";
  if (signal.severity === "high" && (signal.category === "quality" || signal.category === "code-health")) return "now";
  if (signal.severity === "medium") return "next";
  return "later";
}

function buildOpportunityFromSignal(signal: Signal): Opportunity {
  const rice = scoreWithRice(signal);

  const areaMap: Record<string, DiscoveryArea> = {
    "code-health": "operacoes",
    quality: "dados-ia",
    growth: "growth",
    operability: "operacoes",
    "backlog-health": "produto",
    "feature-gap": "produto",
  };
  const area = areaMap[signal.category] || "produto";

  const typeMap: Record<string, DiscoveryType> = {
    "code-health": "tech-debt",
    quality: "improvement",
    growth: "experiment",
    operability: "improvement",
    "backlog-health": "improvement",
    "feature-gap": "improvement",
  };
  const type = typeMap[signal.category] || "improvement";

  const confidenceLabel =
    rice.confidence >= 90 ? "confidence:high" : rice.confidence >= 70 ? "confidence:medium" : "confidence:low";
  const horizon = inferHorizon(signal);

  const title = signal.featureHint?.title
    ? signal.featureHint.title
    : area === "growth"
      ? "Projeto sobre instrumentacao de metricas de produto"
      : area === "dados-ia"
        ? "Projeto sobre qualidade de dados e confiabilidade"
        : area === "operacoes"
          ? "Projeto sobre confiabilidade operacional e observabilidade"
          : "Projeto sobre priorizacao e fluxo de backlog";

  const hypothesis = signal.featureHint?.hypothesis
    ? signal.featureHint.hypothesis
    : area === "growth"
      ? "Se instrumentarmos sinais de uso e funil, a priorizacao semanal ficara orientada por impacto real."
      : area === "dados-ia"
        ? "Se elevarmos visibilidade de qualidade de dados/testes, reduziremos regressao em features politicas."
        : area === "operacoes"
          ? "Se consolidarmos automacoes com monitoramento, reduziremos falhas silenciosas de pipeline."
          : "Se estruturarmos triagem com regras de stale/duplicidade, aumentaremos throughput de backlog.";

  const acceptanceCriteria = signal.featureHint?.acceptanceCriteria
    ? signal.featureHint.acceptanceCriteria
    : [
        "Definir indicador de sucesso objetivo para o problema identificado.",
        "Entregar implementacao inicial com monitoramento e dono claro.",
        "Atualizar backlog com proxima iteracao baseada nos resultados obtidos.",
      ];

  return {
    key: signal.id,
    title,
    area,
    type,
    horizon,
    confidenceLabel,
    problem: signal.message,
    evidence: signal.evidence,
    hypothesis,
    acceptanceCriteria,
    risks: [
      "Capacidade limitada do time para absorver novas frentes simultaneas.",
      "Dependencia de dados externos ou configuracoes de ambiente nao disponiveis.",
    ],
    sources: signal.sources,
    rice,
  };
}

function generateOpportunities(signals: Signal[]): Opportunity[] {
  const opportunities = signals.map(buildOpportunityFromSignal);
  opportunities.sort((a, b) => b.rice.score - a.rice.score);
  return opportunities;
}

function hasMinimumQuality(opportunity: Opportunity) {
  return (
    opportunity.problem.trim().length > 15 &&
    opportunity.evidence.length > 0 &&
    opportunity.acceptanceCriteria.length >= 2 &&
    opportunity.rice.reach > 0 &&
    opportunity.rice.effort > 0
  );
}

function renderIssueDescription(opportunity: Opportunity) {
  return [
    "## Problema",
    opportunity.problem,
    "",
    "## Evidencia",
    ...opportunity.evidence.map(item => `- ${item}`),
    "",
    "## Hipotese de solucao",
    opportunity.hypothesis,
    "",
    "## Criterios de aceite",
    ...opportunity.acceptanceCriteria.map(item => `- ${item}`),
    "",
    "## Definition of Ready",
    "- [ ] Problema validado com impacto claro para usuario e negocio.",
    "- [ ] Metrica alvo definida (baseline, meta e janela de avaliacao).",
    "- [ ] Escopo v1 delimitado (o que entra e o que fica fora).",
    "- [ ] Dependencias e riscos mapeados com responsavel.",
    "",
    "## Horizonte",
    `- ${opportunity.horizon.toUpperCase()}`,
    "",
    "## RICE",
    `- Reach: ${opportunity.rice.reach}`,
    `- Impact: ${opportunity.rice.impact}`,
    `- Confidence: ${opportunity.rice.confidence}`,
    `- Effort: ${opportunity.rice.effort}`,
    `- Score: ${opportunity.rice.score.toFixed(2)}`,
    "",
    "## Risco/Dependencias",
    ...opportunity.risks.map(item => `- ${item}`),
    "",
    "## Fonte",
    ...opportunity.sources.map(item => `- ${item}`),
  ].join("\n");
}

function renderPmValidationComment(opportunity: Opportunity) {
  return [
    "Checklist de validacao PM (discovery):",
    "- Qual dor do usuario esta sendo resolvida e como mediremos isso?",
    "- Qual o menor escopo v1 para validar a hipotese em producao?",
    "- Quais dependencias bloqueiam entrega e qual plano de mitigacao?",
    "- Quais sinais invalidariam a hipotese rapidamente?",
    "",
    `RICE atual: ${opportunity.rice.score.toFixed(2)} (Reach ${opportunity.rice.reach}, Impact ${opportunity.rice.impact}, Confidence ${opportunity.rice.confidence}, Effort ${opportunity.rice.effort}).`,
  ].join("\n");
}

function extractRiceScoreFromDescription(description: string) {
  const match = description.match(/- Score:\s*([0-9]+(?:\.[0-9]+)?)/i);
  if (!match) return null;
  const score = Number(match[1]);
  return Number.isFinite(score) ? score : null;
}

function shouldRunWeeklyMaintenance() {
  const day = new Date().getDay();
  return day === CONFIG.weeklyMaintenanceDay;
}

async function runWeeklyMaintenance(params: {
  client: LinearClient;
  projectId: string;
  labelIdByName: Record<string, string>;
  issues: ExistingIssue[];
}) {
  const { client, projectId, labelIdByName, issues } = params;
  if (!shouldRunWeeklyMaintenance()) {
    return {
      executed: false,
      reprioritized: 0,
      staleTagged: 0,
    };
  }

  const staleLabelName = "status:stale-review";
  const staleLabelId = labelIdByName[staleLabelName];
  const openIssues = issues.filter(issue => issue.stateType !== "completed" && issue.stateType !== "canceled");
  const agentIssues = openIssues.filter(
    issue => issue.labels.includes("source:agent-pm") && issue.title.trim().toLowerCase() !== CONFIG.linearDigestIssueTitle.toLowerCase()
  );

  let reprioritized = 0;
  let staleTagged = 0;
  const staleLimitTs = Date.now() - CONFIG.staleDays * 24 * 60 * 60 * 1000;

  for (const issue of agentIssues) {
    const score = extractRiceScoreFromDescription(issue.description || "");
    if (score !== null) {
      const targetPriority = toPriorityFromRice(score);
      if (issue.priority !== targetPriority) {
        if (!CONFIG.dryRun) {
          await client.updateIssuePriority(issue.id, targetPriority);
        }
        reprioritized += 1;
      }
    }

    const updatedTs = new Date(issue.updatedAt).getTime();
    const isStale = Number.isFinite(updatedTs) && updatedTs < staleLimitTs;
    const alreadyTagged = issue.labels.includes(staleLabelName);
    if (isStale && staleLabelId && !alreadyTagged) {
      const mergedLabelIds = Array.from(
        new Set(
          issue.labels
            .map(name => labelIdByName[name])
            .filter((id): id is string => Boolean(id))
            .concat(staleLabelId)
        )
      );
      if (!CONFIG.dryRun) {
        await client.updateIssueLabels(issue.id, mergedLabelIds);
      }
      staleTagged += 1;
    }
  }

  if (!CONFIG.dryRun) {
    const maintenanceIssue = issues.find(
      issue => issue.title.trim().toLowerCase() === CONFIG.linearDigestIssueTitle.toLowerCase()
    );
    if (maintenanceIssue) {
      await client.createComment(
        maintenanceIssue.id,
        [
          "Resumo de manutencao semanal do backlog:",
          `- Repriorizadas por RICE: ${reprioritized}`,
          `- Marcadas como stale review: ${staleTagged}`,
          `- Regra stale: sem atualizacao ha mais de ${CONFIG.staleDays} dias`,
        ].join("\n")
      );
    }
  }

  return {
    executed: true,
    reprioritized,
    staleTagged,
  };
}

function resolveDuplicates(opportunities: Opportunity[], existingIssues: ExistingIssue[]): SyncDecision {
  const decision: SyncDecision = { create: [], update: [], discarded: [] };

  const openIssues = existingIssues.filter(issue => issue.stateType !== "completed" && issue.stateType !== "canceled");
  for (const opportunity of opportunities) {
    if (!hasMinimumQuality(opportunity)) {
      decision.discarded.push({ opportunity, reason: "Nao atende criterio minimo de qualidade." });
      continue;
    }

    let duplicate: ExistingIssue | null = null;
    let bestScore = 0;
    for (const issue of openIssues) {
      const similarity = jaccardSimilarity(opportunity.title, issue.title);
      if (similarity > bestScore) {
        bestScore = similarity;
        duplicate = issue;
      }
    }

    if (duplicate && bestScore >= 0.7) {
      decision.update.push({
        issue: duplicate,
        opportunity,
        reason: `Similaridade alta de titulo (${bestScore.toFixed(2)}).`,
      });
      continue;
    }

    decision.create.push(opportunity);
  }

  return decision;
}

function countRecentCreated(issues: ExistingIssue[], fromIso: string) {
  return issues.filter(issue => issue.labels.includes("source:agent-pm") && issue.createdAt >= fromIso).length;
}

async function syncBacklog(params: {
  client: LinearClient;
  teamId: string;
  projectId: string;
  labelIdByName: Record<string, string>;
  backlogStateId?: string;
  decision: SyncDecision;
  existingIssues: ExistingIssue[];
}): Promise<SyncResult> {
  const { client, teamId, projectId, labelIdByName, backlogStateId, decision, existingIssues } = params;
  const result: SyncResult = {
    created: [],
    updated: [],
    discarded: decision.discarded.map(item => ({ title: item.opportunity.title, reason: item.reason })),
    errors: [],
    limits: {
      dailyUsed: countRecentCreated(existingIssues, startOfTodayIso()),
      dailyLimit: CONFIG.dailyLimit,
      weeklyUsed: countRecentCreated(existingIssues, daysAgoIso(7)),
      weeklyLimit: CONFIG.weeklyLimit,
    },
  };
  let featureOverridesUsed = 0;

  for (const item of decision.update) {
    const note = [
      "Atualizacao automatica do agente PM de discovery:",
      `- Razao: ${item.reason}`,
      `- Novo score RICE: ${item.opportunity.rice.score.toFixed(2)}`,
      "",
      "Evidencias novas:",
      ...item.opportunity.evidence.map(e => `- ${e}`),
    ].join("\n");

    if (!CONFIG.dryRun) {
      try {
        await client.createComment(item.issue.id, note);
        await client.updateIssue(
          item.issue.id,
          item.opportunity.title,
          renderIssueDescription(item.opportunity),
          toPriorityFromRice(item.opportunity.rice.score)
        );
      } catch (error: any) {
        result.errors.push(`Falha ao atualizar ${item.issue.identifier}: ${error.message}`);
        continue;
      }
    }

    result.updated.push({
      id: item.issue.id,
      identifier: item.issue.identifier,
      title: item.opportunity.title,
      reason: item.reason,
    });
  }

  for (const opportunity of decision.create) {
    const isFeatureGap = opportunity.key.startsWith("feature-gap");
    const canUseFeatureOverride = isFeatureGap && featureOverridesUsed < CONFIG.featureOverridePerRun;

    if (result.limits.dailyUsed >= CONFIG.dailyLimit && !canUseFeatureOverride) {
      result.discarded.push({
        title: opportunity.title,
        reason: "Limite diario atingido.",
      });
      continue;
    }
    if (result.limits.weeklyUsed >= CONFIG.weeklyLimit && !canUseFeatureOverride) {
      result.discarded.push({
        title: opportunity.title,
        reason: "Limite semanal atingido.",
      });
      continue;
    }

    const labels = [
      "source:agent-pm",
      `area:${opportunity.area}`,
      `type:${opportunity.type}`,
      `horizon:${opportunity.horizon}`,
      opportunity.confidenceLabel,
    ];
    const labelIds = labels.map(name => labelIdByName[name]).filter(Boolean);
    const issuePayload: LinearIssueInput = {
      teamId,
      projectId,
      title: opportunity.title,
      description: renderIssueDescription(opportunity),
      labelIds,
      stateId: backlogStateId,
      priority: toPriorityFromRice(opportunity.rice.score),
    };

    if (!CONFIG.dryRun) {
      try {
        const issue = await client.createIssue(issuePayload);
        if (issuePayload.labelIds?.length) {
          await client.updateIssueLabels(issue.id, issuePayload.labelIds);
        }
        await client.createComment(issue.id, renderPmValidationComment(opportunity));
        result.created.push({
          id: issue.id,
          identifier: issue.identifier,
          title: issue.title,
          rice: opportunity.rice.score,
        });
      } catch (error: any) {
        result.errors.push(`Falha ao criar issue "${opportunity.title}": ${error.message}`);
        continue;
      }
    } else {
      result.created.push({
        id: "dry-run",
        identifier: "DRY",
        title: opportunity.title,
        rice: opportunity.rice.score,
      });
    }

    if (
      canUseFeatureOverride &&
      (result.limits.dailyUsed >= CONFIG.dailyLimit || result.limits.weeklyUsed >= CONFIG.weeklyLimit)
    ) {
      featureOverridesUsed += 1;
      continue;
    }

    result.limits.dailyUsed += 1;
    result.limits.weeklyUsed += 1;
  }

  return result;
}

function renderDigestMarkdown(digest: DiscoveryDigest) {
  const lines: string[] = [];
  lines.push(`## Discovery Daily Digest - ${digest.finishedAt}`);
  lines.push("");
  lines.push("### Resumo");
  lines.push(`- Criadas: ${digest.summary.created.length}`);
  lines.push(`- Atualizadas: ${digest.summary.updated.length}`);
  lines.push(`- Descartadas: ${digest.summary.discarded.length}`);
  lines.push(`- Erros: ${digest.summary.errors.length}`);
  lines.push(
    `- Capacidade restante: diario ${
      Math.max(0, digest.summary.limits.dailyLimit - digest.summary.limits.dailyUsed)
    }/${digest.summary.limits.dailyLimit} | semanal ${
      Math.max(0, digest.summary.limits.weeklyLimit - digest.summary.limits.weeklyUsed)
    }/${digest.summary.limits.weeklyLimit}`
  );
  lines.push("");

  if (digest.summary.created.length) {
    lines.push("### Issues criadas");
    for (const item of digest.summary.created) {
      lines.push(`- ${item.identifier} - ${item.title} (RICE ${item.rice.toFixed(2)})`);
    }
    lines.push("");
  }

  if (digest.summary.updated.length) {
    lines.push("### Issues atualizadas");
    for (const item of digest.summary.updated) {
      lines.push(`- ${item.identifier} - ${item.title} | ${item.reason}`);
    }
    lines.push("");
  }

  if (digest.summary.discarded.length) {
    lines.push("### Itens descartados");
    for (const item of digest.summary.discarded) {
      lines.push(`- ${item.title} | ${item.reason}`);
    }
    lines.push("");
  }

  if (digest.summary.errors.length) {
    lines.push("### Erros");
    for (const error of digest.summary.errors) {
      lines.push(`- ${error}`);
    }
    lines.push("");
  }

  lines.push("### Sinais analisados");
  for (const signal of digest.signals) {
    lines.push(`- [${signal.severity}] ${signal.message}`);
  }

  return lines.join("\n");
}

async function ensureProject(client: LinearClient, teamId: string, projectName: string) {
  const projects = await client.listProjects(teamId);
  const existing = projects.find(project => project.name.toLowerCase() === projectName.toLowerCase());
  if (existing) return existing;
  return client.createProject(teamId, projectName);
}

async function ensureLabels(client: LinearClient, teamId: string) {
  const labels = await client.listLabels(teamId);
  const names = new Set(labels.map(label => label.name));
  for (const labelName of REQUIRED_LABELS) {
    if (!names.has(labelName)) {
      await client.createLabel(teamId, labelName);
    }
  }
  const refreshed = await client.listLabels(teamId);
  const idByName: Record<string, string> = {};
  for (const label of refreshed) {
    idByName[label.name] = label.id;
  }
  return idByName;
}

async function ensureDigestIssue(
  client: LinearClient,
  teamId: string,
  projectId: string,
  labelIdByName: Record<string, string>,
  backlogStateId?: string
) {
  const issues = await client.listProjectIssues(projectId);
  const existing = issues.find(issue => issue.title.trim().toLowerCase() === CONFIG.linearDigestIssueTitle.toLowerCase());
  if (existing) return existing.id;

  const created = await client.createIssue({
    teamId,
    projectId,
    stateId: backlogStateId,
    title: CONFIG.linearDigestIssueTitle,
    description:
      "Issue fixa para consolidar os relatorios diarios do agente PM de discovery.\n\nFormato:\n- Data/hora\n- Criadas\n- Atualizadas\n- Descartadas + motivo\n- Capacidade restante\n- Erros/riscos",
    labelIds: ["source:agent-pm", "area:operacoes", "type:improvement"]
      .map(name => labelIdByName[name])
      .filter(Boolean),
    priority: 3,
  });
  if (["source:agent-pm", "area:operacoes", "type:improvement"].every(name => labelIdByName[name])) {
    await client.updateIssueLabels(created.id, [
      labelIdByName["source:agent-pm"],
      labelIdByName["area:operacoes"],
      labelIdByName["type:improvement"],
    ]);
  }
  return created.id;
}

async function publishDigest(client: LinearClient, digestIssueId: string, digest: DiscoveryDigest) {
  const body = renderDigestMarkdown(digest);
  if (CONFIG.dryRun) {
    console.log(body);
    return;
  }
  await client.createComment(digestIssueId, body);
}

async function main() {
  const startedAt = nowIso();
  if (!CONFIG.linearApiKey) {
    throw new Error("LINEAR_API_KEY nao configurada.");
  }

  const client = new LinearClient(CONFIG.linearApiKey);
  const team = await client.getTeam(CONFIG.linearTeamId);
  console.log(`Team Linear: ${team.name}`);

  const project = await ensureProject(client, CONFIG.linearTeamId, CONFIG.linearProjectName);
  console.log(`Projeto alvo: ${project.name} (${project.id})`);

  const labelIdByName = await ensureLabels(client, CONFIG.linearTeamId);
  const states = await client.listStatuses(CONFIG.linearTeamId);
  const backlogState = states.find(state => state.name.toLowerCase() === CONFIG.backlogStateName.toLowerCase());
  const backlogStateId = backlogState?.id;

  const digestIssueId = await ensureDigestIssue(client, CONFIG.linearTeamId, project.id, labelIdByName, backlogStateId);
  const existingIssues = await client.listProjectIssues(project.id);

  const signals = collectSignals(existingIssues);
  console.log(`Sinais detectados: ${signals.map(signal => signal.id).join(", ")}`);
  const opportunities = generateOpportunities(signals);
  const decision = resolveDuplicates(opportunities, existingIssues);
  const summary = await syncBacklog({
    client,
    teamId: CONFIG.linearTeamId,
    projectId: project.id,
    labelIdByName,
    backlogStateId,
    decision,
    existingIssues,
  });

  const refreshedIssues = await client.listProjectIssues(project.id);
  const maintenance = await runWeeklyMaintenance({
    client,
    projectId: project.id,
    labelIdByName,
    issues: refreshedIssues,
  });
  if (maintenance.executed) {
    console.log(
      `Manutencao semanal: repriorizadas=${maintenance.reprioritized} | stale-review=${maintenance.staleTagged}`
    );
  }

  const digest: DiscoveryDigest = {
    startedAt,
    finishedAt: nowIso(),
    summary,
    signals,
  };
  await publishDigest(client, digestIssueId, digest);

  console.log("Discovery PM concluido.");
  console.log(`Criadas: ${summary.created.length} | Atualizadas: ${summary.updated.length} | Descartadas: ${summary.discarded.length}`);
  if (summary.errors.length) {
    console.log("Erros:");
    for (const error of summary.errors) {
      console.log(`- ${error}`);
    }
    process.exitCode = 1;
  }
}

main().catch(error => {
  console.error("Falha no agente PM de discovery:", error);
  process.exit(1);
});
