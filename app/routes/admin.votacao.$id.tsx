import { useEffect, useRef } from "react";
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
import { Container, MAIN_CONTENT_ID } from "~/components/layout";
import { CARD, INPUT, LABEL } from "~/components/admin/styles";
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

        // `missing` diz QUAIS campos faltaram: sem isso a tela só consegue
        // dizer "algo está errado" e deixa o editor procurando qual dos dois
        // selects é o culpado.
        if (!tagSim || !tagNao) {
            return {
                error: "Selecione as tags para SIM e NÃO.",
                missing: [
                    ...(tagSim ? [] : ["tagSim"]),
                    ...(tagNao ? [] : ["tagNao"]),
                ],
            };
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
            return {
                error: "Tags não encontradas.",
                missing: [
                    ...(tagSimObj ? [] : ["tagSim"]),
                    ...(tagNaoObj ? [] : ["tagNao"]),
                ],
            };
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
    // Qual dos dois botões está em voo, não "algum": o spinner acendia no
    // "Aprovar" mesmo quando o clique tinha sido no "Rejeitar".
    const pendingIntent =
        typeof navigation.formData?.get("intent") === "string"
            ? (navigation.formData.get("intent") as string)
            : null;

    const status =
        STATUS_PRESENTATION[bill.status] ?? {
            label: bill.status,
            className: "border-slate-200 bg-white text-slate-500",
        };
    const errorMessage =
        actionData && "error" in actionData ? actionData.error : null;
    const missing =
        actionData && "missing" in actionData ? actionData.missing : [];

    /**
     * O erro nasce dos selects lá embaixo; antes ele era anunciado no topo da
     * página, uns dois rolares acima do formulário, e nada movia o foco. Quem
     * usa teclado ou leitor de tela ficava sabendo que "algo falhou" sem
     * caminho de volta ao campo. Agora o aviso mora dentro do formulário e
     * recebe o foco assim que aparece.
     *
     * A dependência é `actionData` (objeto novo a cada envio) e não a
     * mensagem: dois envios com o mesmo texto precisam reposicionar o foco.
     */
    const errorRef = useRef<HTMLParagraphElement>(null);
    useEffect(() => {
        if (errorMessage) errorRef.current?.focus();
    }, [actionData, errorMessage]);

    return (
        <main id={MAIN_CONTENT_ID} className="flex-1">
            <Container className="pt-9 pb-16">
                <Link
                    to="/admin"
                    className="focus-ring inline-flex items-center gap-1.5 rounded-md text-xs font-medium text-slate-500 transition-colors hover:text-slate-600"
                >
                    <ArrowLeft className="size-3.5" aria-hidden="true" />
                    Voltar ao painel
                </Link>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                    <span
                        className={cn(
                            "rounded-full border px-2.5 py-0.5 text-xs font-semibold",
                            status.className
                        )}
                    >
                        {status.label}
                    </span>
                    {bill.aiConfidence !== null && (
                        <span className="text-xs text-slate-500">
                            Confiança da IA: {Number(bill.aiConfidence).toFixed(0)}%
                        </span>
                    )}
                </div>

                <h1 className="mt-3 font-heading text-3xl font-bold tracking-[-0.02em] text-balance text-slate-800 sm:text-4xl">
                    {bill.simplifiedTitle || bill.title}
                </h1>
                <p className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-base text-slate-500">
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

                <div className="mt-6 space-y-5">
                    <section className={cn(CARD, "space-y-5 p-5 sm:p-6")}>
                        {bill.simplifiedTitle && (
                            <div>
                                <p className={LABEL}>Título original</p>
                                <p className="text-sm leading-relaxed text-slate-600">
                                    {bill.title}
                                </p>
                            </div>
                        )}

                        {bill.description && (
                            <div>
                                <p className={LABEL}>Descrição técnica</p>
                                <p className="text-sm leading-relaxed text-slate-600">
                                    {bill.description}
                                </p>
                            </div>
                        )}

                        {bill.simplifiedDescription && (
                            <div>
                                <p className={LABEL}>Resumo simplificado</p>
                                <p className="text-sm leading-relaxed whitespace-pre-line text-slate-600">
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
                                    className="focus-ring inline-flex items-center gap-1.5 rounded-md text-sm font-semibold text-indigo-600 hover:text-indigo-700 hover:underline"
                                >
                                    Conferir a votação original
                                    <ExternalLink className="size-3.5" aria-hidden="true" />
                                    {/* Ver `SourceCite`: o ícone de nova aba só
                                        comunica a quem enxerga. */}
                                    <span className="sr-only">(abre em nova aba)</span>
                                </a>
                                <p className="mt-1 text-xs text-slate-500">
                                    Confirme os detalhes na fonte antes de aprovar.
                                </p>
                            </div>
                        )}

                        {bill.suggestedTagSim && (
                            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                                <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                                    <Tag className="size-3.5 text-slate-500" aria-hidden="true" />
                                    Sugestão da IA
                                </p>
                                <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-500">
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
                                <h2 className="font-heading text-lg font-bold tracking-[-0.01em] text-slate-800">
                                    Classificar votação
                                </h2>
                                <p className="mt-1 text-xs text-slate-500">
                                    A tag escolhida é atribuída a todos os parlamentares
                                    conforme o voto registrado.
                                </p>
                            </div>

                            {errorMessage && (
                                <p
                                    ref={errorRef}
                                    role="alert"
                                    tabIndex={-1}
                                    id="classificar-erro"
                                    className="focus-ring flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
                                >
                                    <TriangleAlert className="mt-0.5 size-4 flex-none" aria-hidden="true" />
                                    <span>{errorMessage}</span>
                                </p>
                            )}

                            <div className="grid gap-4 sm:grid-cols-2">
                                <div>
                                    <label htmlFor="tagSim" className={LABEL}>
                                        Tag para voto SIM
                                    </label>
                                    {/* `required` para que o navegador barre o
                                        envio e leve o foco ao campo vazio antes
                                        de o servidor precisar responder. O
                                        "Rejeitar" escapa disso com
                                        `formNoValidate`: rejeitar uma votação
                                        não depende de escolher tag nenhuma. */}
                                    <select
                                        id="tagSim"
                                        name="tagSim"
                                        required
                                        aria-invalid={missing.includes("tagSim") || undefined}
                                        aria-describedby={
                                            errorMessage ? "classificar-erro" : undefined
                                        }
                                        defaultValue={bill.suggestedTagSim || ""}
                                        className={cn(
                                            INPUT,
                                            missing.includes("tagSim") && "border-rose-300",
                                        )}
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
                                        required
                                        aria-invalid={missing.includes("tagNao") || undefined}
                                        aria-describedby={
                                            errorMessage ? "classificar-erro" : undefined
                                        }
                                        defaultValue={bill.suggestedTagNao || ""}
                                        className={cn(
                                            INPUT,
                                            missing.includes("tagNao") && "border-rose-300",
                                        )}
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
                                    disabled={pendingIntent !== null}
                                    aria-busy={pendingIntent === "approve"}
                                    className="focus-ring inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
                                >
                                    {pendingIntent === "approve" ? (
                                        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                                    ) : (
                                        <CheckCircle2 className="size-4" aria-hidden="true" />
                                    )}
                                    Aprovar e atribuir tags
                                </button>

                                <button
                                    type="submit"
                                    name="intent"
                                    value="reject"
                                    // Rejeitar não precisa das tags — sem isto o
                                    // `required` dos selects barraria a rejeição.
                                    formNoValidate
                                    disabled={pendingIntent !== null}
                                    aria-busy={pendingIntent === "reject"}
                                    className="focus-ring inline-flex items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-6 py-3 text-sm font-semibold text-rose-700 transition-colors hover:bg-rose-100 disabled:opacity-50"
                                >
                                    {pendingIntent === "reject" ? (
                                        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                                    ) : (
                                        <XCircle className="size-4" aria-hidden="true" />
                                    )}
                                    Rejeitar
                                </button>
                            </div>
                        </Form>
                    )}

                    {bill.voteLogs.length > 0 && (
                        <section className={cn(CARD, "p-5 sm:p-6")}>
                            <h2 className="font-heading text-lg font-bold tracking-[-0.01em] text-slate-800">
                                Amostra de votos
                            </h2>
                            <ul className="mt-3 divide-y divide-slate-100">
                                {bill.voteLogs.map((vote) => (
                                    <li
                                        key={vote.id}
                                        className="flex items-center justify-between gap-3 py-2.5 text-sm"
                                    >
                                        <span className="truncate text-slate-600">
                                            {vote.politician.name}
                                        </span>
                                        <span
                                            className={cn(
                                                "flex-none rounded-full border px-2.5 py-0.5 text-xs font-semibold",
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
