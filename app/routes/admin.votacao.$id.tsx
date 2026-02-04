import { useLoaderData, Form, useNavigation, redirect } from "react-router";
import type { Route } from "./+types/admin.votacao.$id";
import { db } from "~/utils/db.server";
import { Header } from "~/components/Header";
import { Footer } from "~/components/Footer";
import { ArrowLeft, CheckCircle2, XCircle, Loader2, Users, Calendar, Tag } from "lucide-react";
import { format } from "date-fns";
import { Link } from "react-router";

export function meta() {
    return [{ title: "Editar Votação | Admin" }];
}

export async function loader({ params }: Route.LoaderArgs) {
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

export default function AdminVotacaoDetail() {
    const { bill, voteCount, tagsByCategory } = useLoaderData<typeof loader>();
    const navigation = useNavigation();
    const isSubmitting = navigation.state === "submitting";

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-gray-900">
            <Header
                breadcrumbItems={[
                    { label: "Admin", href: "/admin" },
                    { label: "Votação", active: true },
                ]}
            />

            <main className="flex-grow max-w-4xl mx-auto w-full px-4 py-8">
                {/* Back */}
                <Link
                    to="/admin"
                    className="inline-flex items-center gap-2 text-gray-600 hover:text-brand-primary mb-6"
                >
                    <ArrowLeft size={18} />
                    Voltar para lista
                </Link>

                {/* Bill Info */}
                <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6 shadow-sm">
                    <div className="flex items-start justify-between mb-4">
                        <div>
                            <span
                                className={`px-2 py-1 text-xs font-bold rounded-full ${bill.status === "pending"
                                    ? "bg-amber-100 text-amber-700"
                                    : bill.status === "approved"
                                        ? "bg-green-100 text-green-700"
                                        : "bg-red-100 text-red-700"
                                    }`}
                            >
                                {bill.status === "pending" ? "Pendente" : bill.status === "approved" ? "Aprovada" : "Rejeitada"}
                            </span>
                            {bill.aiConfidence && (
                                <span className="ml-2 text-xs text-gray-500">
                                    Confiança IA: {bill.aiConfidence.toFixed(0)}%
                                </span>
                            )}
                        </div>
                    </div>

                    <h1 className="text-2xl font-bold text-gray-900 mb-4">{bill.title}</h1>

                    <div className="flex flex-wrap gap-4 text-sm text-gray-600 mb-4">
                        <span className="flex items-center gap-1.5">
                            <Calendar size={16} />
                            {format(new Date(bill.voteDate), "dd/MM/yyyy")}
                        </span>
                        <span className="flex items-center gap-1.5">
                            <Users size={16} />
                            {voteCount} votos registrados
                        </span>
                    </div>

                    {bill.description && (
                        <div className="mb-4">
                            <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Descrição Técnica</p>
                            <p className="text-sm text-gray-600 leading-relaxed">{bill.description}</p>
                        </div>
                    )}

                    {/* Descrição Simplificada pela IA */}
                    {bill.simplifiedDescription && (
                        <div className="mt-4 p-5 bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl border border-purple-100">
                            <p className="text-sm font-bold text-purple-700 mb-3 flex items-center gap-2">
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M10 2a8 8 0 100 16 8 8 0 000-16zM9 9a1 1 0 012 0v4a1 1 0 01-2 0V9zm1-4a1 1 0 100 2 1 1 0 000-2z" />
                                </svg>
                                Sobre esta Votação
                            </p>
                            <div className="prose prose-sm max-w-none">
                                <p className="text-gray-700 leading-relaxed whitespace-pre-line">
                                    {bill.simplifiedDescription}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Sugestões da IA */}
                    {bill.suggestedTagSim && (
                        <div className="mt-4 p-4 bg-blue-50 rounded-xl border border-blue-100">
                            <p className="text-sm font-semibold text-blue-700 mb-2 flex items-center gap-2">
                                <Tag size={16} />
                                Sugestão da IA:
                            </p>
                            <div className="flex gap-4 text-sm">
                                <span>
                                    SIM: <code className="bg-white px-2 py-1 rounded border">{bill.suggestedTagSim}</code>
                                </span>
                                <span>
                                    NÃO: <code className="bg-white px-2 py-1 rounded border">{bill.suggestedTagNao}</code>
                                </span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Approval Form */}
                {bill.status === "pending" && (
                    <Form method="post" className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                        <h2 className="text-lg font-bold mb-4">Classificar Votação</h2>

                        <div className="grid md:grid-cols-2 gap-6 mb-6">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Tag para voto SIM
                                </label>
                                <select
                                    name="tagSim"
                                    defaultValue={bill.suggestedTagSim || ""}
                                    className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary"
                                >
                                    <option value="">Selecione...</option>
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
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Tag para voto NÃO
                                </label>
                                <select
                                    name="tagNao"
                                    defaultValue={bill.suggestedTagNao || ""}
                                    className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary"
                                >
                                    <option value="">Selecione...</option>
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

                        <div className="flex gap-3">
                            <button
                                type="submit"
                                name="intent"
                                value="approve"
                                disabled={isSubmitting}
                                className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-xl transition-colors disabled:opacity-50"
                            >
                                {isSubmitting ? (
                                    <Loader2 className="animate-spin" size={18} />
                                ) : (
                                    <CheckCircle2 size={18} />
                                )}
                                Aprovar e Atribuir Tags
                            </button>

                            <button
                                type="submit"
                                name="intent"
                                value="reject"
                                disabled={isSubmitting}
                                className="flex items-center justify-center gap-2 bg-red-100 hover:bg-red-200 text-red-700 font-bold py-3 px-6 rounded-xl transition-colors disabled:opacity-50"
                            >
                                <XCircle size={18} />
                                Rejeitar
                            </button>
                        </div>
                    </Form>
                )}

                {/* Sample Votes */}
                {bill.voteLogs.length > 0 && (
                    <div className="mt-6 bg-white rounded-2xl border border-gray-100 p-6">
                        <h3 className="font-bold mb-4">Amostra de Votos</h3>
                        <div className="space-y-2">
                            {bill.voteLogs.map((vote) => (
                                <div
                                    key={vote.id}
                                    className="flex items-center justify-between text-sm py-2 border-b border-gray-50 last:border-0"
                                >
                                    <span className="text-gray-700">{vote.politician.name}</span>
                                    <span
                                        className={`font-semibold ${vote.voteType === "SIM" ? "text-green-600" : "text-red-600"
                                            }`}
                                    >
                                        {vote.voteType}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </main>

            <Footer />
        </div>
    );
}
