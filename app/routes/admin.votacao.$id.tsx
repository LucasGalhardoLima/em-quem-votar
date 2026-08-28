import {
  useLoaderData,
  useActionData,
  Form,
  useNavigation,
  redirect,
  Link,
} from "react-router";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Tag,
  TriangleAlert,
  Users,
  XCircle,
} from "lucide-react";

import type { Route } from "./+types/admin.votacao.$id";
import { db } from "~/utils/db.server";
import { requireAdmin } from "~/utils/admin-auth.server";
import { Container } from "~/components/layout";
import { cn } from "~/lib/utils";

export function meta() {
  return [
    { title: "Admin · Votação | Em Quem Votar?" },
    { name: "robots", content: "noindex,nofollow" },
  ];
}

/**
 * Esta tela ainda opera sobre os modelos legados `Politician`/`VoteLog`
 * (fluxo de tags por voto nominal). O fluxo de dados fica como está — aqui
 * só o visual acompanha o sistema novo.
 */
export async function loader({ params, request }: Route.LoaderArgs) {
  requireAdmin(request);
    const bill = await db.bill.findUnique({
        where: { id: params.id },
        include: {
            voteLogs: {
                take: 10,
                include: {
                    politician: true,
                },
            },
        },
    });

    if (!bill) {
        throw new Response("Votação não encontrada", { status: 404 });
    }

    const voteCount = await db.voteLog.count({
        where: { billId: params.id },
    });

    const allTags = await db.tag.findMany({
        orderBy: [{ category: "asc" }, { name: "asc" }],
    });

    // Agrupar tags por categoria
    const tagsByCategory: Record<string, typeof allTags> = {};
    allTags.forEach((tag) => {
        if (!tagsByCategory[tag.category]) {
            tagsByCategory[tag.category] = [];
        }
        tagsByCategory[tag.category].push(tag);
    });

    return { bill, voteCount, allTags, tagsByCategory };
}

export async function action({ request, params }: Route.ActionArgs) {
  requireAdmin(request);
    const formData = await request.formData();
    const intent = formData.get("intent");

    if (intent === "approve") {
        const tagSim = formData.get("tagSim") as string;
        const tagNao = formData.get("tagNao") as string;

        if (!tagSim || !tagNao) {
            return { error: "Selecione as tags para SIM e NÃO" };
        }

        // 1. Atualizar status da Bill
        await db.bill.update({
            where: { id: params.id },
            data: {
                status: "approved",
                suggestedTagSim: tagSim,
                suggestedTagNao: tagNao,
                approvedAt: new Date(),
            },
        });

        // 2. Buscar tags
        const [tagSimObj, tagNaoObj] = await Promise.all([
            db.tag.findUnique({ where: { slug: tagSim } }),
            db.tag.findUnique({ where: { slug: tagNao } }),
        ]);

        if (!tagSimObj || !tagNaoObj) {
            return { error: "Tags não encontradas" };
        }

        // 3. Buscar todos os votos dessa votação
        const votes = await db.voteLog.findMany({
            where: { billId: params.id },
        });

        // 4. Atribuir tags aos políticos baseado no voto
        const politicianTagsToCreate: { politicianId: string; tagId: string }[] = [];

        for (const vote of votes) {
            if (vote.voteType === "SIM") {
                politicianTagsToCreate.push({
                    politicianId: vote.politicianId,
                    tagId: tagSimObj.id,
                });
            } else if (vote.voteType === "NÃO" || vote.voteType === "NAO") {
                politicianTagsToCreate.push({
                    politicianId: vote.politicianId,
                    tagId: tagNaoObj.id,
                });
            }
        }

        if (politicianTagsToCreate.length > 0) {
            await db.politicianTag.createMany({
                data: politicianTagsToCreate,
                skipDuplicates: true,
            });
        }

        return redirect("/admin");
    }

    if (intent === "reject") {
        await db.bill.update({
            where: { id: params.id },
            data: {
                status: "rejected",
            },
        });

        return redirect("/admin");
    }

    return null;
}

const CARD = "rounded-2xl border border-slate-200 bg-white";
const LABEL =
    "mb-1.5 block text-[10.5px] font-semibold tracking-[0.06em] text-slate-500 uppercase";
const INPUT =
    "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-[13.5px] text-slate-800 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-600/10";

const STATUS_PRESENTATION: Record<string, { label: string; className: string }> = {
    pending: {
        label: "Pendente",
        className: "border-amber-200 bg-amber-50 text-amber-800",
    },
    approved: {
        label: "Aprovada",
        className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    },
    rejected: {
        label: "Rejeitada",
        className: "border-rose-200 bg-rose-50 text-rose-700",
    },
};

export default function AdminVotacaoDetail() {
    const { bill, voteCount, tagsByCategory } = useLoaderData<typeof loader>();
    const actionData = useActionData<typeof action>();
    const navigation = useNavigation();
    const isSubmitting = navigation.state === "submitting";

    const status =
        STATUS_PRESENTATION[bill.status] ?? {
            label: bill.status,
            className: "border-slate-200 bg-white text-slate-500",
        };
    const errorMessage =
        actionData && "error" in actionData ? actionData.error : null;

    return (
        <main className="flex-1">
            <Container className="pt-9 pb-16">
                <Link
                    to="/admin"
                    className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-slate-500 transition-colors hover:text-slate-600"
                >
                    <ArrowLeft className="size-3.5" />
                    Voltar ao painel
                </Link>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                    <span
                        className={cn(
                            "rounded-full border px-2.5 py-0.5 text-[11px] font-semibold",
                            status.className
                        )}
                    >
                        {status.label}
                    </span>
                    {bill.aiConfidence !== null && (
                        <span className="text-[12px] text-slate-500">
                            Confiança da IA: {Number(bill.aiConfidence).toFixed(0)}%
                        </span>
                    )}
                </div>

                <h1 className="mt-3 font-heading text-[28px] font-bold tracking-[-0.02em] text-balance text-slate-800 sm:text-[34px]">
                    {bill.simplifiedTitle || bill.title}
                </h1>
                <p className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[14.5px] text-slate-500">
                    <span className="inline-flex items-center gap-1.5">
                        <Calendar className="size-4 text-slate-500" aria-hidden="true" />
                        {new Date(bill.voteDate).toLocaleDateString("pt-BR")}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                        <Users className="size-4 text-slate-500" aria-hidden="true" />
                        {voteCount} votos registrados
                    </span>
                    <span>
                        {bill.sourceType === "senado" ? "Senado" : "Câmara dos Deputados"}
                    </span>
                </p>

                {errorMessage && (
                    <p
                        role="alert"
                        className="mt-5 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-800"
                    >
                        <TriangleAlert className="mt-0.5 size-4 flex-none" aria-hidden="true" />
                        <span>{errorMessage}</span>
                    </p>
                )}

                <div className="mt-6 space-y-5">
                    <section className={cn(CARD, "space-y-5 p-5 sm:p-6")}>
                        {bill.simplifiedTitle && (
                            <div>
                                <p className={LABEL}>Título original</p>
                                <p className="text-[13.5px] leading-relaxed text-slate-600">
                                    {bill.title}
                                </p>
                            </div>
                        )}

                        {bill.description && (
                            <div>
                                <p className={LABEL}>Descrição técnica</p>
                                <p className="text-[13.5px] leading-relaxed text-slate-600">
                                    {bill.description}
                                </p>
                            </div>
                        )}

                        {bill.simplifiedDescription && (
                            <div>
                                <p className={LABEL}>Resumo simplificado</p>
                                <p className="text-[13.5px] leading-relaxed whitespace-pre-line text-slate-600">
                                    {bill.simplifiedDescription}
                                </p>
                            </div>
                        )}

                        {bill.sourceUrl && (
                            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                                <a
                                    href={bill.sourceUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-indigo-600 hover:text-indigo-700 hover:underline"
                                >
                                    Conferir a votação original
                                    <ExternalLink className="size-3.5" aria-hidden="true" />
                                </a>
                                <p className="mt-1 text-[12px] text-slate-500">
                                    Confirme os detalhes na fonte antes de aprovar.
                                </p>
                            </div>
                        )}

                        {bill.suggestedTagSim && (
                            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                                <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-slate-600">
                                    <Tag className="size-3.5 text-slate-500" aria-hidden="true" />
                                    Sugestão da IA
                                </p>
                                <div className="mt-2 flex flex-wrap gap-4 text-[12.5px] text-slate-500">
                                    <span>
                                        SIM:{" "}
                                        <code className="rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-slate-700">
                                            {bill.suggestedTagSim}
                                        </code>
                                    </span>
                                    <span>
                                        NÃO:{" "}
                                        <code className="rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-slate-700">
                                            {bill.suggestedTagNao}
                                        </code>
                                    </span>
                                </div>
                            </div>
                        )}
                    </section>

                    {bill.status === "pending" && (
                        <Form method="post" className={cn(CARD, "space-y-4 p-5 sm:p-6")}>
                            <div>
                                <h2 className="font-heading text-[17px] font-bold tracking-[-0.01em] text-slate-800">
                                    Classificar votação
                                </h2>
                                <p className="mt-1 text-[12.5px] text-slate-500">
                                    A tag escolhida é atribuída a todos os parlamentares
                                    conforme o voto registrado.
                                </p>
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2">
                                <div>
                                    <label htmlFor="tagSim" className={LABEL}>
                                        Tag para voto SIM
                                    </label>
                                    <select
                                        id="tagSim"
                                        name="tagSim"
                                        defaultValue={bill.suggestedTagSim || ""}
                                        className={INPUT}
                                    >
                                        <option value="">Selecione…</option>
                                        {Object.entries(tagsByCategory).map(([category, tags]) => (
                                            <optgroup key={category} label={category}>
                                                {tags.map((tag) => (
                                                    <option key={tag.slug} value={tag.slug}>
                                                        {tag.name}
                                                    </option>
                                                ))}
                                            </optgroup>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label htmlFor="tagNao" className={LABEL}>
                                        Tag para voto NÃO
                                    </label>
                                    <select
                                        id="tagNao"
                                        name="tagNao"
                                        defaultValue={bill.suggestedTagNao || ""}
                                        className={INPUT}
                                    >
                                        <option value="">Selecione…</option>
                                        {Object.entries(tagsByCategory).map(([category, tags]) => (
                                            <optgroup key={category} label={category}>
                                                {tags.map((tag) => (
                                                    <option key={tag.slug} value={tag.slug}>
                                                        {tag.name}
                                                    </option>
                                                ))}
                                            </optgroup>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-3">
                                <button
                                    type="submit"
                                    name="intent"
                                    value="approve"
                                    disabled={isSubmitting}
                                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-[13.5px] font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
                                >
                                    {isSubmitting ? (
                                        <Loader2 className="size-4 animate-spin" />
                                    ) : (
                                        <CheckCircle2 className="size-4" />
                                    )}
                                    Aprovar e atribuir tags
                                </button>

                                <button
                                    type="submit"
                                    name="intent"
                                    value="reject"
                                    disabled={isSubmitting}
                                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-6 py-3 text-[13.5px] font-semibold text-rose-700 transition-colors hover:bg-rose-100 disabled:opacity-50"
                                >
                                    <XCircle className="size-4" />
                                    Rejeitar
                                </button>
                            </div>
                        </Form>
                    )}

                    {bill.voteLogs.length > 0 && (
                        <section className={cn(CARD, "p-5 sm:p-6")}>
                            <h2 className="font-heading text-[17px] font-bold tracking-[-0.01em] text-slate-800">
                                Amostra de votos
                            </h2>
                            <ul className="mt-3 divide-y divide-slate-100">
                                {bill.voteLogs.map((vote) => (
                                    <li
                                        key={vote.id}
                                        className="flex items-center justify-between gap-3 py-2.5 text-[13.5px]"
                                    >
                                        <span className="truncate text-slate-600">
                                            {vote.politician.name}
                                        </span>
                                        <span
                                            className={cn(
                                                "flex-none rounded-full border px-2.5 py-0.5 text-[11px] font-semibold",
                                                vote.voteType === "SIM"
                                                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                                    : vote.voteType === "NÃO" || vote.voteType === "NAO"
                                                        ? "border-rose-200 bg-rose-50 text-rose-700"
                                                        : "border-slate-200 bg-white text-slate-500"
                                            )}
                                        >
                                            {vote.voteType}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}
                </div>
            </Container>
        </main>
    );
}
