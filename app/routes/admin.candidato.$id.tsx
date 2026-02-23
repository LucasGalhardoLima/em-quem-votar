import {
  useLoaderData,
  Form,
  useNavigation,
  redirect,
  Link,
} from "react-router";
import type { Route } from "./+types/admin.candidato.$id";
import { CandidateService } from "~/services/candidate.server";
import { PositionService } from "~/services/position.server";
import { db } from "~/utils/db.server";
import { Header } from "~/components/Header";
import { Footer } from "~/components/Footer";
import { Badge } from "~/components/ui/badge";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Loader2,
  User,
  Plus,
} from "lucide-react";

export function meta() {
  return [{ title: "Admin - Candidato | Em Quem Votar?" }];
}

export async function loader({ params }: Route.LoaderArgs) {
  const candidate = await CandidateService.getById(params.id!);
  if (!candidate) {
    throw new Response("Candidato não encontrado", { status: 404 });
  }

  const [positions, topics, allTags] = await Promise.all([
    PositionService.listByCandidate(params.id!),
    db.politicalTopic.findMany({ orderBy: { order: "asc" } }),
    db.tag.findMany({ orderBy: [{ category: "asc" }, { name: "asc" }] }),
  ]);

  return {
    candidate,
    positions: positions.map((p) => ({
      id: p.id,
      topicName: p.topic.name,
      topicCategory: p.topic.category,
      topicId: p.topicId,
      stance: p.stance,
      description: p.description,
      sourceType: p.sourceType,
      sourceUrl: p.sourceUrl,
      isApproved: p.approvedAt !== null,
      approvedAt: p.approvedAt?.toISOString() ?? null,
      createdAt: p.createdAt.toISOString(),
    })),
    topics: topics.map((t) => ({
      id: t.id,
      name: t.name,
      category: t.category,
      slug: t.slug,
    })),
    allTags,
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  switch (intent) {
    case "update-candidate": {
      const displayName = formData.get("displayName") as string;
      const party = formData.get("party") as string;
      const coalition = (formData.get("coalition") as string) || null;
      const biography = (formData.get("biography") as string) || null;
      const photoUrl = (formData.get("photoUrl") as string) || null;
      const numberStr = formData.get("number") as string;
      const registrationStatus = formData.get("registrationStatus") as string;

      await CandidateService.update(params.id!, {
        displayName,
        party,
        coalition,
        biography,
        photoUrl,
        number: numberStr ? parseInt(numberStr, 10) : null,
        registrationStatus: registrationStatus as any,
      });

      return { success: "Candidato atualizado." };
    }

    case "add-position": {
      const topicId = formData.get("topicId") as string;
      const stance = parseInt(formData.get("stance") as string, 10);
      const description = (formData.get("description") as string) || undefined;
      const sourceType = formData.get("sourceType") as any;
      const sourceUrl = (formData.get("sourceUrl") as string) || undefined;

      await PositionService.create({
        candidateId: params.id!,
        topicId,
        stance,
        description,
        sourceType,
        sourceUrl,
      });

      return { success: "Posição adicionada." };
    }

    case "approve-position": {
      const positionId = formData.get("positionId") as string;
      await PositionService.approve(positionId);
      return { success: "Posição aprovada." };
    }

    case "delete-position": {
      const positionId = formData.get("positionId") as string;
      await db.candidatePosition.delete({ where: { id: positionId } });
      return { success: "Posição removida." };
    }

    case "add-tag": {
      const tagId = formData.get("tagId") as string;
      await db.candidateTag.create({
        data: { candidateId: params.id!, tagId },
      });
      return { success: "Tag adicionada." };
    }

    case "remove-tag": {
      const tagId = formData.get("tagId") as string;
      await db.candidateTag.deleteMany({
        where: { candidateId: params.id!, tagId },
      });
      return { success: "Tag removida." };
    }

    default:
      return null;
  }
}

const STANCE_LABELS: Record<number, string> = {
  1: "Discorda Totalmente",
  2: "Discorda",
  3: "Neutro",
  4: "Concorda",
  5: "Concorda Totalmente",
};

const STATUS_OPTIONS = [
  { value: "PRE_CANDIDATE", label: "Pré-candidato" },
  { value: "REGISTERED", label: "Registrado no TSE" },
  { value: "APPROVED", label: "Candidatura aprovada" },
  { value: "REJECTED", label: "Candidatura indeferida" },
  { value: "WITHDRAWN", label: "Candidatura retirada" },
];

const SOURCE_OPTIONS = [
  { value: "VOTING_RECORD", label: "Registro de Votação" },
  { value: "PARTY_PLATFORM", label: "Programa do Partido" },
  { value: "PUBLIC_STATEMENT", label: "Declaração Pública" },
  { value: "INTERVIEW", label: "Entrevista" },
  { value: "MANUAL", label: "Classificação Manual" },
];

export default function AdminCandidatoPage() {
  const { candidate, positions, topics, allTags } =
    useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header
        breadcrumbItems={[
          { label: "Admin", href: "/admin" },
          { label: candidate.displayName, active: true },
        ]}
      />

      <main className="flex-grow max-w-4xl mx-auto w-full px-4 py-8 space-y-8">
        <Link
          to="/admin"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-3 h-3" />
          Voltar
        </Link>

        {/* Candidate Info Form */}
        <Form method="post" className="rounded-lg border bg-card p-5 space-y-4">
          <div className="flex items-center gap-3 mb-2">
            {candidate.photoUrl ? (
              <img
                src={candidate.photoUrl}
                alt={candidate.displayName}
                className="w-12 h-12 rounded-lg object-cover bg-muted"
              />
            ) : (
              <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                <User className="w-6 h-6 text-muted-foreground" />
              </div>
            )}
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                Dados do Candidato
              </h2>
              <p className="text-[10px] text-muted-foreground">
                ID: {candidate.id}
              </p>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Nome de exibição" name="displayName" defaultValue={candidate.displayName} />
            <Field label="Partido" name="party" defaultValue={candidate.party} />
            <Field label="Coligação" name="coalition" defaultValue={candidate.coalition ?? ""} />
            <Field label="Foto URL" name="photoUrl" defaultValue={candidate.photoUrl ?? ""} />
            <Field label="Número" name="number" type="number" defaultValue={String(candidate.number ?? "")} />
            <div>
              <label className="block text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">
                Status
              </label>
              <select
                name="registrationStatus"
                defaultValue={candidate.registrationStatus}
                className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">
              Biografia
            </label>
            <textarea
              name="biography"
              rows={3}
              defaultValue={candidate.biography ?? ""}
              className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm text-foreground resize-y focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <button
            type="submit"
            name="intent"
            value="update-candidate"
            disabled={isSubmitting}
            className="px-4 py-2 rounded-md bg-foreground text-background text-xs font-medium hover:bg-foreground/90 disabled:opacity-50 transition-colors"
          >
            {isSubmitting ? (
              <Loader2 className="w-3 h-3 animate-spin inline mr-1" />
            ) : null}
            Salvar Alterações
          </button>
        </Form>

        {/* Tags */}
        <section className="rounded-lg border bg-card p-5 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Tags</h3>
          <div className="flex flex-wrap gap-1.5">
            {candidate.tags.map((tag: any) => (
              <Form method="post" key={tag.slug} className="inline">
                <input type="hidden" name="intent" value="remove-tag" />
                <input type="hidden" name="tagId" value={allTags.find((t) => t.slug === tag.slug)?.id ?? ""} />
                <button
                  type="submit"
                  className="inline-flex items-center gap-1 rounded-md border bg-muted/50 px-2 py-1 text-[10px] text-foreground hover:bg-destructive/10 hover:border-destructive/30 transition-colors"
                >
                  {tag.name}
                  <XCircle className="w-2.5 h-2.5 text-muted-foreground" />
                </button>
              </Form>
            ))}
          </div>
          <Form method="post" className="flex items-center gap-2">
            <input type="hidden" name="intent" value="add-tag" />
            <select
              name="tagId"
              className="flex-1 px-3 py-1.5 rounded-md border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Selecionar tag...</option>
              {allTags.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  [{tag.category}] {tag.name}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="px-3 py-1.5 rounded-md bg-foreground text-background text-xs font-medium hover:bg-foreground/90 transition-colors"
            >
              <Plus className="w-3 h-3" />
            </button>
          </Form>
        </section>

        {/* Positions */}
        <section className="rounded-lg border bg-card p-5 space-y-4">
          <h3 className="text-sm font-semibold text-foreground">
            Posições Políticas ({positions.length})
          </h3>

          {positions.length > 0 && (
            <div className="space-y-2">
              {positions.map((pos) => (
                <div
                  key={pos.id}
                  className="flex items-center justify-between rounded-md border bg-muted/30 p-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-foreground">
                        {pos.topicName}
                      </span>
                      <Badge
                        variant="secondary"
                        className="text-[9px] font-normal"
                      >
                        {pos.stance} — {STANCE_LABELS[pos.stance] ?? "?"}
                      </Badge>
                      {pos.isApproved ? (
                        <Badge
                          variant="outline"
                          className="text-[9px] font-normal"
                        >
                          Aprovada
                        </Badge>
                      ) : (
                        <Badge
                          variant="secondary"
                          className="text-[9px] font-normal"
                        >
                          Pendente
                        </Badge>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                      {pos.sourceType} &middot; {pos.topicCategory}
                      {pos.description && ` — ${pos.description}`}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    {!pos.isApproved && (
                      <Form method="post">
                        <input
                          type="hidden"
                          name="intent"
                          value="approve-position"
                        />
                        <input
                          type="hidden"
                          name="positionId"
                          value={pos.id}
                        />
                        <button
                          type="submit"
                          className="p-1.5 rounded-md hover:bg-muted transition-colors"
                          title="Aprovar"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
                        </button>
                      </Form>
                    )}
                    <Form method="post">
                      <input
                        type="hidden"
                        name="intent"
                        value="delete-position"
                      />
                      <input
                        type="hidden"
                        name="positionId"
                        value={pos.id}
                      />
                      <button
                        type="submit"
                        className="p-1.5 rounded-md hover:bg-destructive/10 transition-colors"
                        title="Remover"
                      >
                        <XCircle className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
                      </button>
                    </Form>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add Position Form */}
          <Form
            method="post"
            className="rounded-md border bg-background p-4 space-y-3"
          >
            <input type="hidden" name="intent" value="add-position" />
            <h4 className="text-xs font-semibold text-foreground">
              Adicionar Posição
            </h4>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">
                  Tema
                </label>
                <select
                  name="topicId"
                  required
                  className="w-full px-3 py-2 rounded-md border border-border bg-card text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Selecionar...</option>
                  {topics.map((t) => (
                    <option key={t.id} value={t.id}>
                      [{t.category}] {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">
                  Posição (1-5)
                </label>
                <select
                  name="stance"
                  required
                  className="w-full px-3 py-2 rounded-md border border-border bg-card text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {[1, 2, 3, 4, 5].map((v) => (
                    <option key={v} value={v}>
                      {v} — {STANCE_LABELS[v]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">
                  Tipo de Fonte
                </label>
                <select
                  name="sourceType"
                  required
                  className="w-full px-3 py-2 rounded-md border border-border bg-card text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {SOURCE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <Field label="URL da Fonte" name="sourceUrl" />
            </div>

            <div>
              <label className="block text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">
                Descrição (opcional)
              </label>
              <textarea
                name="description"
                rows={2}
                className="w-full px-3 py-2 rounded-md border border-border bg-card text-xs text-foreground resize-y focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Breve descrição da posição..."
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-md bg-foreground text-background text-xs font-medium hover:bg-foreground/90 disabled:opacity-50 transition-colors inline-flex items-center gap-1.5"
            >
              {isSubmitting && (
                <Loader2 className="w-3 h-3 animate-spin" />
              )}
              <Plus className="w-3 h-3" />
              Adicionar Posição
            </button>
          </Form>
        </section>
      </main>

      <Footer />
    </div>
  );
}

function Field({
  label,
  name,
  defaultValue = "",
  type = "text",
}: {
  label: string;
  name: string;
  defaultValue?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">
        {label}
      </label>
      <input
        type={type}
        name={name}
        defaultValue={defaultValue}
        className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      />
    </div>
  );
}
