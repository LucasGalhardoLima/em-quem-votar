import {
  useLoaderData,
  useActionData,
  Form,
  useNavigation,
  Link,
} from "react-router";
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Plus,
  Trash2,
  TriangleAlert,
  Undo2,
  User,
} from "lucide-react";

import type { PositionSourceType } from "@prisma/client";
import type { Route } from "./+types/admin.candidato.$id";
import { CandidateService } from "~/services/candidate.server";
import {
  approvalBlocker,
  PositionService,
} from "~/services/position.server";
import { db } from "~/utils/db.server";
import { requireAdmin } from "~/utils/admin-auth.server";
import { SourceCite, SOURCE_TYPE_LABELS } from "~/components/candidate/SourceCite";
import {
  REGISTRATION_STATUSES,
  STATUS_PRESENTATION,
} from "~/lib/candidate-status";
import {
  CANDIDATE_STANCE_LABELS,
  NO_POSITION_LABEL,
  STANCE_UNKNOWN,
} from "~/lib/stance";
import { Container } from "~/components/layout";
import { cn } from "~/lib/utils";

export function meta() {
  return [
    { title: "Admin · Candidato | Em Quem Votar?" },
    { name: "robots", content: "noindex,nofollow" },
  ];
}

// ------------------------------------------------------------------
// Loader
// ------------------------------------------------------------------

export async function loader({ params, request }: Route.LoaderArgs) {
  requireAdmin(request);
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
      sourceType: p.sourceType as string,
      sourceUrl: p.sourceUrl,
      sourceDocument: p.sourceDocument,
      sourcePage: p.sourcePage,
      sourceQuote: p.sourceQuote,
      sourceDate: p.sourceDate?.toISOString() ?? null,
      isApproved: p.approvedAt !== null,
      approvedAt: p.approvedAt?.toISOString() ?? null,
      createdAt: p.createdAt.toISOString(),
      /**
       * Mesma regra usada no `approve` do serviço, avaliada aqui para que o
       * editor veja o bloqueio antes de tentar aprovar.
       */
      approvalBlocker: approvalBlocker(p),
    })),
    topics: topics.map((t) => ({
      id: t.id,
      name: t.name,
      category: t.category,
      slug: t.slug,
    })),
    allTags: allTags.map((t) => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      category: t.category,
    })),
  };
}

// ------------------------------------------------------------------
// Action
// ------------------------------------------------------------------

/** Resultado uniforme para que a UI trate sucesso e erro do mesmo jeito. */
interface ActionResult {
  ok: boolean;
  message: string;
  /** Quando o retorno diz respeito a uma posição específica. */
  positionId?: string;
}

function text(formData: FormData, key: string): string {
  return ((formData.get(key) as string) ?? "").trim();
}

function nullableText(formData: FormData, key: string): string | null {
  const value = text(formData, key);
  return value.length > 0 ? value : null;
}

function nullableInt(formData: FormData, key: string): number | null {
  const value = text(formData, key);
  if (value.length === 0) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

/** `<input type="date">` chega como YYYY-MM-DD; guardamos em UTC puro. */
function nullableDate(formData: FormData, key: string): Date | null {
  const value = text(formData, key);
  if (value.length === 0) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

export async function action({
  request,
  params,
}: Route.ActionArgs): Promise<ActionResult | null> {
  requireAdmin(request);

  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  switch (intent) {
    case "update-candidate": {
      await CandidateService.update(params.id!, {
        displayName: text(formData, "displayName"),
        party: text(formData, "party"),
        coalition: nullableText(formData, "coalition"),
        photoUrl: nullableText(formData, "photoUrl"),
        number: nullableInt(formData, "number"),
        registrationStatus: text(
          formData,
          "registrationStatus"
        ) as (typeof REGISTRATION_STATUSES)[number],
        // Curadoria editorial: o sync do TSE nunca sobrescreve estes campos
        // (ver "preservação de curadoria" em scripts/sync-tse-2026.ts), então
        // o admin é o único dono deles.
        biography: nullableText(formData, "biography"),
        governmentPlanUrl: nullableText(formData, "governmentPlanUrl"),
        officialSiteUrl: nullableText(formData, "officialSiteUrl"),
        // Chapa: o sync só escreve quando o CSV traz o vice; fora disso é
        // curadoria manual.
        viceName: nullableText(formData, "viceName"),
        viceParty: nullableText(formData, "viceParty"),
      });

      return { ok: true, message: "Dados do candidato salvos." };
    }

    case "add-position": {
      const topicId = text(formData, "topicId");
      if (!topicId) {
        return { ok: false, message: "Selecione o tema da posição." };
      }

      try {
        await PositionService.create({
          candidateId: params.id!,
          topicId,
          stance: nullableInt(formData, "stance") ?? STANCE_UNKNOWN,
          description: nullableText(formData, "description"),
          sourceType: text(formData, "sourceType") as PositionSourceType,
          sourceUrl: nullableText(formData, "sourceUrl"),
          sourceDocument: nullableText(formData, "sourceDocument"),
          sourcePage: nullableInt(formData, "sourcePage"),
          sourceQuote: nullableText(formData, "sourceQuote"),
          sourceDate: nullableDate(formData, "sourceDate"),
        });
      } catch (error) {
        if (isUniqueViolation(error)) {
          return {
            ok: false,
            message:
              "Já existe uma posição deste candidato neste tema. Edite a posição existente em vez de criar outra.",
          };
        }
        throw error;
      }

      return {
        ok: true,
        message: "Posição adicionada como pendente. Revise a fonte e aprove.",
      };
    }

    case "update-position": {
      const positionId = text(formData, "positionId");
      const result = await PositionService.update(positionId, {
        stance: nullableInt(formData, "stance") ?? STANCE_UNKNOWN,
        description: nullableText(formData, "description"),
        sourceType: text(formData, "sourceType") as PositionSourceType,
        sourceUrl: nullableText(formData, "sourceUrl"),
        sourceDocument: nullableText(formData, "sourceDocument"),
        sourcePage: nullableInt(formData, "sourcePage"),
        sourceQuote: nullableText(formData, "sourceQuote"),
        sourceDate: nullableDate(formData, "sourceDate"),
      });

      if (!result.ok) {
        return { ok: false, message: result.error, positionId };
      }
      return {
        ok: true,
        positionId,
        message: result.unapproved
          ? "Posição salva e devolvida para pendente: a edição deixou a citação incompleta."
          : "Posição salva.",
      };
    }

    case "approve-position": {
      const positionId = text(formData, "positionId");
      const result = await PositionService.approve(positionId);
      if (!result.ok) {
        return {
          ok: false,
          positionId,
          message: `Aprovação recusada. ${result.error}`,
        };
      }
      return { ok: true, positionId, message: "Posição aprovada e publicada." };
    }

    case "unapprove-position": {
      const positionId = text(formData, "positionId");
      await PositionService.unapprove(positionId);
      return {
        ok: true,
        positionId,
        message: "Aprovação revertida. A posição saiu do ar.",
      };
    }

    case "delete-position": {
      await PositionService.delete(text(formData, "positionId"));
      return { ok: true, message: "Posição removida." };
    }

    case "add-tag": {
      const tagId = text(formData, "tagId");
      if (!tagId) return { ok: false, message: "Selecione uma tag." };
      try {
        await db.candidateTag.create({
          data: { candidateId: params.id!, tagId },
        });
      } catch (error) {
        if (isUniqueViolation(error)) {
          return { ok: false, message: "Este candidato já tem essa tag." };
        }
        throw error;
      }
      return { ok: true, message: "Tag adicionada." };
    }

    case "remove-tag": {
      await db.candidateTag.deleteMany({
        where: { candidateId: params.id!, tagId: text(formData, "tagId") },
      });
      return { ok: true, message: "Tag removida." };
    }

    default:
      return null;
  }
}

// ------------------------------------------------------------------
// Vocabulário e estilos
// ------------------------------------------------------------------

const STANCE_OPTIONS = [
  { value: STANCE_UNKNOWN, label: NO_POSITION_LABEL },
  ...[1, 2, 3, 4, 5].map((v) => ({
    value: v,
    label: `${v} — ${CANDIDATE_STANCE_LABELS[v]}`,
  })),
];

const SOURCE_OPTIONS = (
  ["PLATFORM", "VOTE_RECORD", "PUBLIC_STATEMENT", "INTERVIEW", "MANUAL"] as const
).map((value) => ({ value, label: SOURCE_TYPE_LABELS[value] }));

const STATUS_OPTIONS = REGISTRATION_STATUSES.map((value) => ({
  value,
  label: STATUS_PRESENTATION[value].label,
}));

const CARD = "rounded-2xl border border-slate-200 bg-white";
const LABEL =
  "mb-1.5 block text-[10.5px] font-semibold tracking-[0.06em] text-slate-400 uppercase";
const INPUT =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-[13.5px] text-slate-800 outline-none placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-600/10";
const BTN_PRIMARY =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-slate-800 px-6 py-3 text-[13.5px] font-semibold text-white transition-colors hover:bg-slate-900 disabled:opacity-50";
const BTN_QUIET =
  "inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-[12.5px] font-semibold text-slate-600 transition-colors hover:border-slate-300 disabled:opacity-50";

// ------------------------------------------------------------------
// Página
// ------------------------------------------------------------------

export default function AdminCandidatoPage() {
  const { candidate, positions, topics, allTags } =
    useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const approvedCount = positions.filter((p) => p.isApproved).length;
  const blockedCount = positions.filter(
    (p) => !p.isApproved && p.approvalBlocker !== null
  ).length;

  // Avisos que não pertencem a uma posição específica ficam no topo.
  const globalNotice =
    actionData && !actionData.positionId ? actionData : null;

  return (
    <main className="flex-1">
      <Container className="pt-9 pb-16">
        <Link
          to="/admin"
          className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-slate-400 transition-colors hover:text-slate-600"
        >
          <ArrowLeft className="size-3.5" />
          Voltar ao painel
        </Link>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-heading text-[28px] font-bold tracking-[-0.02em] text-slate-800 sm:text-[34px]">
              {candidate.displayName}
            </h1>
            <p className="mt-1.5 text-[14.5px] text-slate-500">
              {positions.length} posições cadastradas · {approvedCount}{" "}
              aprovadas
              {blockedCount > 0
                ? ` · ${blockedCount} bloqueadas por fonte incompleta`
                : ""}
            </p>
          </div>
          <Link
            to={`/candidato/${candidate.id}`}
            className={BTN_QUIET}
            target="_blank"
            rel="noopener noreferrer"
          >
            Ver página pública
            <ExternalLink className="size-3.5" />
          </Link>
        </div>

        {globalNotice && (
          <Notice ok={globalNotice.ok} className="mt-5">
            {globalNotice.message}
          </Notice>
        )}

        <div className="mt-6 space-y-5">
          <CandidateForm candidate={candidate} isSubmitting={isSubmitting} />

          <TagsSection candidate={candidate} allTags={allTags} />

          <section className={cn(CARD, "p-5 sm:p-6")}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-heading text-[17px] font-bold tracking-[-0.01em] text-slate-800">
                Posições políticas
              </h2>
              <p className="text-[12.5px] text-slate-400">
                Toda posição publicada cita documento, página e trecho literal.
              </p>
            </div>

            {positions.length === 0 ? (
              <p className="mt-4 rounded-xl border border-dashed border-slate-300 px-5 py-8 text-center text-[13.5px] text-slate-400">
                Nenhuma posição cadastrada. Extraia da proposta de governo
                protocolada no TSE e registre abaixo.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {positions.map((position) => (
                  <PositionCard
                    key={position.id}
                    position={position}
                    isSubmitting={isSubmitting}
                    notice={
                      actionData && actionData.positionId === position.id
                        ? actionData
                        : null
                    }
                  />
                ))}
              </div>
            )}

            <AddPositionForm
              topics={topics}
              governmentPlanUrl={candidate.governmentPlanUrl}
              isSubmitting={isSubmitting}
            />
          </section>
        </div>
      </Container>
    </main>
  );
}

// ------------------------------------------------------------------
// Blocos
// ------------------------------------------------------------------

function Notice({
  ok,
  className,
  children,
}: {
  ok: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <p
      role="status"
      className={cn(
        "flex items-start gap-2 rounded-xl border px-4 py-3 text-[13px] leading-relaxed",
        ok
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-rose-200 bg-rose-50 text-rose-800",
        className
      )}
    >
      {ok ? (
        <CheckCircle2 className="mt-0.5 size-4 flex-none" aria-hidden="true" />
      ) : (
        <TriangleAlert className="mt-0.5 size-4 flex-none" aria-hidden="true" />
      )}
      <span>{children}</span>
    </p>
  );
}

function CandidateForm({
  candidate,
  isSubmitting,
}: {
  candidate: CandidateView;
  isSubmitting: boolean;
}) {
  return (
    <Form method="post" className={cn(CARD, "space-y-5 p-5 sm:p-6")}>
      <input type="hidden" name="intent" value="update-candidate" />

      <div className="flex items-center gap-3.5">
        {candidate.photoUrl ? (
          <img
            src={candidate.photoUrl}
            alt=""
            className="size-12 flex-none rounded-xl bg-slate-100 object-cover"
          />
        ) : (
          <div className="flex size-12 flex-none items-center justify-center rounded-xl bg-slate-100">
            <User className="size-5 text-slate-400" aria-hidden="true" />
          </div>
        )}
        <div className="min-w-0">
          <h2 className="font-heading text-[17px] font-bold tracking-[-0.01em] text-slate-800">
            Dados do candidato
          </h2>
          <p className="truncate text-[12px] text-slate-400">
            {candidate.dataSource === "tse"
              ? "Origem TSE"
              : `Origem ${candidate.dataSource}`}
            {candidate.lastSyncedAt
              ? ` · último sync ${new Date(candidate.lastSyncedAt).toLocaleString("pt-BR")}`
              : " · nunca sincronizado"}
          </p>
        </div>
      </div>

      <fieldset className="space-y-3">
        <legend className="text-[11px] font-semibold tracking-[0.06em] text-slate-400 uppercase">
          Campos do TSE
        </legend>
        <p className="text-[12.5px] leading-relaxed text-slate-500">
          O sync sobrescreve estes campos na próxima execução. Edite aqui só
          para corrigir algo urgente antes do próximo <code>npm run sync:tse</code>.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Nome de exibição"
            name="displayName"
            defaultValue={candidate.displayName}
          />
          <Field label="Partido" name="party" defaultValue={candidate.party} />
          <Field
            label="Coligação"
            name="coalition"
            defaultValue={candidate.coalition ?? ""}
          />
          <Field
            label="Número"
            name="number"
            type="number"
            defaultValue={String(candidate.number ?? "")}
          />
          <Field
            label="Foto (URL)"
            name="photoUrl"
            defaultValue={candidate.photoUrl ?? ""}
          />
          <div>
            <label htmlFor="registrationStatus" className={LABEL}>
              Situação de registro
            </label>
            <select
              id="registrationStatus"
              name="registrationStatus"
              defaultValue={candidate.registrationStatus}
              className={INPUT}
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </fieldset>

      <fieldset className="space-y-3 border-t border-slate-100 pt-5">
        <legend className="text-[11px] font-semibold tracking-[0.06em] text-slate-400 uppercase">
          Curadoria editorial
        </legend>
        <p className="text-[12.5px] leading-relaxed text-slate-500">
          O sync do TSE nunca sobrescreve estes campos — o admin é o dono
          deles. O plano de governo é a fonte primária das posições: preencha o
          link antes de começar a extração.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Plano de governo (URL do PDF)"
            name="governmentPlanUrl"
            type="url"
            placeholder="https://divulgacandcontas.tse.jus.br/..."
            defaultValue={candidate.governmentPlanUrl ?? ""}
          />
          <Field
            label="Site oficial"
            name="officialSiteUrl"
            type="url"
            placeholder="https://"
            defaultValue={candidate.officialSiteUrl ?? ""}
          />
          <Field
            label="Nome do vice"
            name="viceName"
            defaultValue={candidate.viceName ?? ""}
          />
          <Field
            label="Partido do vice"
            name="viceParty"
            defaultValue={candidate.viceParty ?? ""}
          />
        </div>
        <div>
          <label htmlFor="biography" className={LABEL}>
            Biografia
          </label>
          <textarea
            id="biography"
            name="biography"
            rows={4}
            defaultValue={candidate.biography ?? ""}
            placeholder="Trajetória verificável, sem adjetivos."
            className={cn(INPUT, "resize-y leading-relaxed")}
          />
        </div>
      </fieldset>

      <button type="submit" disabled={isSubmitting} className={BTN_PRIMARY}>
        {isSubmitting && <Loader2 className="size-3.5 animate-spin" />}
        Salvar dados do candidato
      </button>
    </Form>
  );
}

function TagsSection({
  candidate,
  allTags,
}: {
  candidate: CandidateView;
  allTags: Array<{ id: string; name: string; slug: string; category: string }>;
}) {
  return (
    <section className={cn(CARD, "space-y-4 p-5 sm:p-6")}>
      <h2 className="font-heading text-[17px] font-bold tracking-[-0.01em] text-slate-800">
        Tags
      </h2>

      {candidate.tags.length === 0 ? (
        <p className="text-[13px] text-slate-400">Nenhuma tag atribuída.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {candidate.tags.map((tag) => (
            <Form method="post" key={tag.slug} className="inline">
              <input type="hidden" name="intent" value="remove-tag" />
              <input
                type="hidden"
                name="tagId"
                value={allTags.find((t) => t.slug === tag.slug)?.id ?? ""}
              />
              <button
                type="submit"
                title={`Remover ${tag.name}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-medium text-slate-600 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
              >
                {tag.name}
                <Trash2 className="size-3" aria-hidden="true" />
              </button>
            </Form>
          ))}
        </div>
      )}

      <Form method="post" className="flex flex-col gap-2 sm:flex-row">
        <input type="hidden" name="intent" value="add-tag" />
        <select
          name="tagId"
          aria-label="Tag a adicionar"
          className={cn(INPUT, "sm:flex-1")}
        >
          <option value="">Selecionar tag…</option>
          {allTags.map((tag) => (
            <option key={tag.id} value={tag.id}>
              [{tag.category}] {tag.name}
            </option>
          ))}
        </select>
        <button type="submit" className={cn(BTN_QUIET, "sm:flex-none")}>
          <Plus className="size-3.5" />
          Adicionar
        </button>
      </Form>
    </section>
  );
}

type LoaderData = Awaited<ReturnType<typeof loader>>;
type CandidateView = LoaderData["candidate"];
type PositionView = LoaderData["positions"][number];

function PositionCard({
  position,
  isSubmitting,
  notice,
}: {
  position: PositionView;
  isSubmitting: boolean;
  notice: ActionResult | null;
}) {
  const canApprove = position.approvalBlocker === null;

  return (
    <article className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[11px] font-bold tracking-[0.06em] text-indigo-600 uppercase">
              {position.topicName}
            </h3>
            <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10.5px] font-medium text-slate-500">
              {position.topicCategory}
            </span>
            {position.isApproved ? (
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-700">
                Aprovada
                {position.approvedAt
                  ? ` · ${new Date(position.approvedAt).toLocaleDateString("pt-BR")}`
                  : ""}
              </span>
            ) : (
              <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10.5px] font-semibold text-amber-800">
                Pendente
              </span>
            )}
          </div>

          <p className="mt-1.5 text-[13.5px] font-semibold text-slate-800">
            {position.stance === STANCE_UNKNOWN
              ? NO_POSITION_LABEL
              : (CANDIDATE_STANCE_LABELS[position.stance] ?? NO_POSITION_LABEL)}
          </p>
          {position.description && (
            <p className="mt-1 text-[12.5px] leading-relaxed text-slate-500">
              {position.description}
            </p>
          )}

          {/* Prévia exata do que o leitor vê na página pública. */}
          <div className="mt-2">
            <p className="mb-1 text-[10.5px] tracking-[0.06em] text-slate-400 uppercase">
              Como o leitor vê
            </p>
            <SourceCite source={position} />
          </div>
        </div>

        <div className="flex flex-none items-center gap-2">
          {position.isApproved ? (
            <Form method="post">
              <input type="hidden" name="intent" value="unapprove-position" />
              <input type="hidden" name="positionId" value={position.id} />
              <button
                type="submit"
                disabled={isSubmitting}
                className={BTN_QUIET}
                title="Tirar do ar e devolver para pendente"
              >
                <Undo2 className="size-3.5" />
                Reverter
              </button>
            </Form>
          ) : (
            <Form method="post">
              <input type="hidden" name="intent" value="approve-position" />
              <input type="hidden" name="positionId" value={position.id} />
              <button
                type="submit"
                disabled={isSubmitting || !canApprove}
                title={position.approvalBlocker ?? "Aprovar e publicar"}
                className={cn(
                  "inline-flex items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 text-[12.5px] font-semibold transition-colors",
                  canApprove
                    ? "bg-emerald-600 text-white hover:bg-emerald-700"
                    : "cursor-not-allowed border border-slate-200 bg-white text-slate-300"
                )}
              >
                <CheckCircle2 className="size-3.5" />
                Aprovar
              </button>
            </Form>
          )}

          <Form method="post">
            <input type="hidden" name="intent" value="delete-position" />
            <input type="hidden" name="positionId" value={position.id} />
            <button
              type="submit"
              disabled={isSubmitting}
              title="Remover posição"
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white p-2 text-slate-400 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
            >
              <Trash2 className="size-3.5" />
            </button>
          </Form>
        </div>
      </div>

      {position.approvalBlocker && !position.isApproved && (
        <Notice ok={false} className="mt-3">
          Não aprovável ainda. {position.approvalBlocker}
        </Notice>
      )}

      {notice && (
        <Notice ok={notice.ok} className="mt-3">
          {notice.message}
        </Notice>
      )}

      <details className="group mt-3">
        <summary className="w-fit cursor-pointer list-none text-[12.5px] font-semibold text-indigo-600 hover:text-indigo-700">
          <span className="group-open:hidden">Editar posição e fonte</span>
          <span className="hidden group-open:inline">Fechar edição</span>
        </summary>

        <Form
          method="post"
          className="mt-3 space-y-3 rounded-xl border border-slate-200 bg-white p-4"
        >
          <input type="hidden" name="intent" value="update-position" />
          <input type="hidden" name="positionId" value={position.id} />
          <SourceFields
            idPrefix={position.id}
            stance={position.stance}
            description={position.description}
            sourceType={position.sourceType}
            sourceUrl={position.sourceUrl}
            sourceDocument={position.sourceDocument}
            sourcePage={position.sourcePage}
            sourceQuote={position.sourceQuote}
            sourceDate={position.sourceDate}
          />
          <button
            type="submit"
            disabled={isSubmitting}
            className={cn(BTN_PRIMARY, "px-5 py-2.5 text-[13px]")}
          >
            {isSubmitting && <Loader2 className="size-3.5 animate-spin" />}
            Salvar posição
          </button>
        </Form>
      </details>
    </article>
  );
}

function AddPositionForm({
  topics,
  governmentPlanUrl,
  isSubmitting,
}: {
  topics: Array<{ id: string; name: string; category: string }>;
  governmentPlanUrl: string | null;
  isSubmitting: boolean;
}) {
  return (
    <Form
      method="post"
      className="mt-5 space-y-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 p-4 sm:p-5"
    >
      <input type="hidden" name="intent" value="add-position" />
      <h3 className="font-heading text-[14.5px] font-bold text-slate-800">
        Adicionar posição
      </h3>

      <div>
        <label htmlFor="new-topicId" className={LABEL}>
          Tema
        </label>
        <select id="new-topicId" name="topicId" required className={INPUT}>
          <option value="">Selecionar tema…</option>
          {topics.map((t) => (
            <option key={t.id} value={t.id}>
              [{t.category}] {t.name}
            </option>
          ))}
        </select>
      </div>

      <SourceFields
        idPrefix="new"
        stance={STANCE_UNKNOWN}
        description={null}
        sourceType="PLATFORM"
        sourceUrl={governmentPlanUrl}
        sourceDocument="Proposta de governo — TSE"
        sourcePage={null}
        sourceQuote={null}
        sourceDate={null}
      />

      <button type="submit" disabled={isSubmitting} className={BTN_PRIMARY}>
        {isSubmitting ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Plus className="size-3.5" />
        )}
        Adicionar posição
      </button>
    </Form>
  );
}

/**
 * Campos de posição + procedência. Mesmo conjunto na criação e na edição,
 * para que nada capturado num fluxo falte no outro.
 */
function SourceFields({
  idPrefix,
  stance,
  description,
  sourceType,
  sourceUrl,
  sourceDocument,
  sourcePage,
  sourceQuote,
  sourceDate,
}: {
  idPrefix: string;
  stance: number;
  description: string | null;
  sourceType: string;
  sourceUrl: string | null;
  sourceDocument: string | null;
  sourcePage: number | null;
  sourceQuote: string | null;
  sourceDate: string | null;
}) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`${idPrefix}-stance`} className={LABEL}>
            Posição na escala
          </label>
          <select
            id={`${idPrefix}-stance`}
            name="stance"
            defaultValue={String(stance)}
            className={INPUT}
          >
            {STANCE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor={`${idPrefix}-sourceType`} className={LABEL}>
            Tipo de fonte
          </label>
          <select
            id={`${idPrefix}-sourceType`}
            name="sourceType"
            required
            defaultValue={sourceType}
            className={INPUT}
          >
            {SOURCE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <Field
          label="Documento citado"
          name="sourceDocument"
          idPrefix={idPrefix}
          placeholder="Proposta de governo — TSE"
          defaultValue={sourceDocument ?? ""}
        />

        <Field
          label="Página do PDF"
          name="sourcePage"
          idPrefix={idPrefix}
          type="number"
          min={1}
          placeholder="Obrigatória para proposta de governo"
          defaultValue={sourcePage === null ? "" : String(sourcePage)}
        />

        <Field
          label="URL da fonte"
          name="sourceUrl"
          idPrefix={idPrefix}
          type="url"
          placeholder="https://"
          defaultValue={sourceUrl ?? ""}
        />

        <Field
          label="Data do documento"
          name="sourceDate"
          idPrefix={idPrefix}
          type="date"
          defaultValue={sourceDate ? sourceDate.slice(0, 10) : ""}
        />
      </div>

      <div>
        <label htmlFor={`${idPrefix}-sourceQuote`} className={LABEL}>
          Trecho literal
        </label>
        <textarea
          id={`${idPrefix}-sourceQuote`}
          name="sourceQuote"
          rows={3}
          defaultValue={sourceQuote ?? ""}
          placeholder="Copie e cole a frase do documento. Nunca parafraseie."
          className={cn(INPUT, "resize-y leading-relaxed")}
        />
        <p className="mt-1 text-[11.5px] text-slate-400">
          O trecho aparece entre aspas na página do candidato, exatamente como
          digitado aqui.
        </p>
      </div>

      <div>
        <label htmlFor={`${idPrefix}-description`} className={LABEL}>
          Descrição editorial (opcional)
        </label>
        <textarea
          id={`${idPrefix}-description`}
          name="description"
          rows={2}
          defaultValue={description ?? ""}
          placeholder="Resumo neutro do que o documento diz sobre o tema."
          className={cn(INPUT, "resize-y leading-relaxed")}
        />
      </div>
    </>
  );
}

function Field({
  label,
  name,
  idPrefix,
  defaultValue = "",
  type = "text",
  placeholder,
  min,
}: {
  label: string;
  name: string;
  idPrefix?: string;
  defaultValue?: string;
  type?: string;
  placeholder?: string;
  min?: number;
}) {
  const id = idPrefix ? `${idPrefix}-${name}` : name;
  return (
    <div>
      <label htmlFor={id} className={LABEL}>
        {label}
      </label>
      <input
        id={id}
        type={type}
        name={name}
        min={min}
        placeholder={placeholder}
        defaultValue={defaultValue}
        className={INPUT}
      />
    </div>
  );
}
