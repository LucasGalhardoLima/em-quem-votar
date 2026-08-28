import { Form, useLoaderData, Link } from "react-router";
import {
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  LogOut,
  TriangleAlert,
  Users,
} from "lucide-react";

import type { Route } from "./+types/admin._index";
import { db } from "~/utils/db.server";
import { requireAdmin } from "~/utils/admin-auth.server";
import { approvalBlocker } from "~/services/position.server";
import { Container } from "~/components/layout";
import { CANDIDATE_STANCE_LABELS, NO_POSITION_LABEL } from "~/lib/stance";
import { cn } from "~/lib/utils";

export function meta() {
  return [
    { title: "Admin · Painel | Em Quem Votar?" },
    { name: "robots", content: "noindex,nofollow" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  requireAdmin(request);
  const [
    totalCandidates,
    positionsApproved,
    positionsPending,
    billsApproved,
    billsPending,
    pendingPositions,
    pendingBills,
  ] = await Promise.all([
    db.candidate.count(),
    db.candidatePosition.count({ where: { approvedAt: { not: null } } }),
    db.candidatePosition.count({ where: { approvedAt: null } }),
    db.bill.count({ where: { status: "approved" } }),
    db.bill.count({ where: { status: "pending" } }),
    db.candidatePosition.findMany({
      where: { approvedAt: null },
      include: {
        candidate: { select: { id: true, displayName: true, party: true } },
        topic: { select: { name: true, category: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    db.bill.findMany({
      where: { status: "pending" },
      select: {
        id: true,
        title: true,
        simplifiedTitle: true,
        voteDate: true,
        sourceType: true,
        aiConfidence: true,
      },
      orderBy: { voteDate: "desc" },
      take: 20,
    }),
  ]);

  return {
    stats: {
      totalCandidates,
      positionsApproved,
      positionsPending,
      billsApproved,
      billsPending,
    },
    pendingPositions: pendingPositions.map((p) => ({
      id: p.id,
      stance: p.stance,
      createdAt: p.createdAt.toISOString(),
      candidate: p.candidate,
      topic: p.topic,
      /** Bloqueio de fonte, mesma regra do aprovar — sinalizado já na fila. */
      approvalBlocker: approvalBlocker(p),
    })),
    pendingBills: pendingBills.map((b) => ({
      ...b,
      voteDate: b.voteDate.toISOString(),
      aiConfidence: b.aiConfidence === null ? null : Number(b.aiConfidence),
    })),
  };
}

const CARD = "rounded-2xl border border-slate-200 bg-white";
const CHIP =
  "rounded-full border px-2 py-0.5 text-[12px] font-medium whitespace-nowrap";
/** Mesmo botão discreto do editor de candidato (`BTN_QUIET`). */
const BTN_QUIET =
  "inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-[12.5px] font-semibold text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-800 focus-visible:border-indigo-300 focus-visible:ring-2 focus-visible:ring-indigo-600/20 focus-visible:outline-none";

export default function AdminIndex() {
  const { stats, pendingPositions, pendingBills } =
    useLoaderData<typeof loader>();

  const blockedPositions = pendingPositions.filter(
    (p) => p.approvalBlocker !== null
  ).length;

  const statCards = [
    { label: "Candidatos", value: stats.totalCandidates, icon: Users },
    {
      label: "Posições aprovadas",
      value: stats.positionsApproved,
      icon: CheckCircle2,
    },
    {
      label: "Posições pendentes",
      value: stats.positionsPending,
      icon: Clock,
    },
    {
      label: "Votações aprovadas",
      value: stats.billsApproved,
      icon: CheckCircle2,
    },
    { label: "Votações pendentes", value: stats.billsPending, icon: Clock },
  ];

  return (
    <main className="flex-1">
      <Container className="pt-9 pb-16">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
          <div className="min-w-0">
            <h1 className="font-heading text-[28px] font-bold tracking-[-0.02em] text-slate-800 sm:text-[34px]">
              Painel editorial
            </h1>
            <p className="mt-1.5 text-[14.5px] text-slate-500">
              Aprovação de posições e votações. Nada vai ao ar sem documento,
              página e trecho citados.
            </p>
          </div>

          {/* POST, nunca GET: sair é escrita, e um GET seria disparável por
              um <img> de outra página. Ver `routes/admin.logout.tsx`. */}
          <Form method="post" action="/admin/logout" className="flex-none">
            <button type="submit" className={BTN_QUIET}>
              <LogOut className="size-3.5" aria-hidden="true" />
              Sair
            </button>
          </Form>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {statCards.map((stat) => (
            <div key={stat.label} className={cn(CARD, "px-4 py-4 text-center")}>
              <stat.icon
                className="mx-auto mb-1.5 size-4 text-slate-500"
                aria-hidden="true"
              />
              <p className="font-heading text-[26px] font-bold tabular-nums text-slate-800">
                {stat.value}
              </p>
              <p className="mt-0.5 text-[12px] tracking-[0.04em] text-slate-500 uppercase">
                {stat.label}
              </p>
            </div>
          ))}
        </div>

        {blockedPositions > 0 && (
          <p
            role="status"
            className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] leading-relaxed text-amber-800"
          >
            <TriangleAlert className="mt-0.5 size-4 flex-none" aria-hidden="true" />
            <span>
              {blockedPositions} de {pendingPositions.length} posições da fila
              não podem ser aprovadas: falta o link do documento ou a página do
              PDF na fonte da proposta de governo.
            </span>
          </p>
        )}

        <section className="mt-8">
          <h2 className="flex items-center gap-2 font-heading text-[17px] font-bold tracking-[-0.01em] text-slate-800">
            <Clock className="size-4 text-slate-500" aria-hidden="true" />
            Posições pendentes ({stats.positionsPending})
          </h2>

          {pendingPositions.length === 0 ? (
            <EmptyState label="Nenhuma posição pendente." />
          ) : (
            <div className="mt-3 space-y-2">
              {pendingPositions.map((pos) => (
                <Link
                  key={pos.id}
                  to={`/admin/candidato/${pos.candidate.id}`}
                  className={cn(
                    CARD,
                    "group flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:border-slate-300"
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[13.5px] font-semibold text-slate-800">
                        {pos.candidate.displayName}
                      </span>
                      <span
                        className={cn(CHIP, "border-slate-200 text-slate-500")}
                      >
                        {pos.candidate.party}
                      </span>
                      {pos.approvalBlocker && (
                        <span
                          className={cn(
                            CHIP,
                            "border-amber-200 bg-amber-50 font-semibold text-amber-800"
                          )}
                          title={pos.approvalBlocker}
                        >
                          Fonte incompleta
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-[12.5px] text-slate-500">
                      {pos.topic.category} · {pos.topic.name} ·{" "}
                      {CANDIDATE_STANCE_LABELS[pos.stance] ?? NO_POSITION_LABEL}
                    </p>
                  </div>
                  <ChevronRight
                    className="size-4 flex-none text-slate-500 transition-colors group-hover:text-slate-700"
                    aria-hidden="true"
                  />
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="mt-8">
          <h2 className="flex items-center gap-2 font-heading text-[17px] font-bold tracking-[-0.01em] text-slate-800">
            <FileText className="size-4 text-slate-500" aria-hidden="true" />
            Votações pendentes ({stats.billsPending})
          </h2>

          {pendingBills.length === 0 ? (
            <EmptyState label="Nenhuma votação pendente." />
          ) : (
            <div className="mt-3 space-y-2">
              {pendingBills.map((bill) => (
                <Link
                  key={bill.id}
                  to={`/admin/votacao/${bill.id}`}
                  className={cn(
                    CARD,
                    "group flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:border-slate-300"
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-semibold text-slate-800">
                      {bill.simplifiedTitle || bill.title}
                    </p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[12.5px] text-slate-500">
                      <span>
                        {new Date(bill.voteDate).toLocaleDateString("pt-BR")}
                      </span>
                      <span
                        className={cn(CHIP, "border-slate-200 text-slate-500")}
                      >
                        {bill.sourceType === "senado" ? "Senado" : "Câmara"}
                      </span>
                      {bill.aiConfidence !== null && (
                        <span>IA: {bill.aiConfidence.toFixed(0)}%</span>
                      )}
                    </div>
                  </div>
                  <ChevronRight
                    className="size-4 flex-none text-slate-500 transition-colors group-hover:text-slate-700"
                    aria-hidden="true"
                  />
                </Link>
              ))}
            </div>
          )}
        </section>
      </Container>
    </main>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="mt-3 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
      <CheckCircle2
        className="mx-auto mb-2 size-6 text-slate-500"
        aria-hidden="true"
      />
      <p className="text-[13.5px] text-slate-500">{label}</p>
    </div>
  );
}
