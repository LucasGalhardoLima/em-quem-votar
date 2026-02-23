import { useLoaderData, Link } from "react-router";
import type { Route } from "./+types/admin._index";
import { db } from "~/utils/db.server";
import { Header } from "~/components/Header";
import { Footer } from "~/components/Footer";
import { Badge } from "~/components/ui/badge";
import {
  Shield,
  Users,
  FileText,
  ChevronRight,
  Clock,
  CheckCircle2,
} from "lucide-react";

export function meta() {
  return [{ title: "Admin Dashboard | Em Quem Votar?" }];
}

export async function loader() {
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
    })),
    pendingBills: pendingBills.map((b) => ({
      ...b,
      voteDate: b.voteDate.toISOString(),
    })),
  };
}

export default function AdminIndex() {
  const { stats, pendingPositions, pendingBills } =
    useLoaderData<typeof loader>();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header
        breadcrumbItems={[{ label: "Admin Dashboard", active: true }]}
      />

      <main className="flex-grow max-w-5xl mx-auto w-full px-4 py-8 space-y-8">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-md bg-muted">
            <Shield className="w-5 h-5 text-muted-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">
              Dashboard Admin
            </h1>
            <p className="text-xs text-muted-foreground">
              Gerencie candidatos, posições e votações
            </p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            {
              label: "Candidatos",
              value: stats.totalCandidates,
              icon: Users,
            },
            {
              label: "Posições Aprovadas",
              value: stats.positionsApproved,
              icon: CheckCircle2,
            },
            {
              label: "Posições Pendentes",
              value: stats.positionsPending,
              icon: Clock,
            },
            {
              label: "Votações Aprovadas",
              value: stats.billsApproved,
              icon: CheckCircle2,
            },
            {
              label: "Votações Pendentes",
              value: stats.billsPending,
              icon: Clock,
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-lg border bg-card p-4 text-center"
            >
              <stat.icon className="w-4 h-4 text-muted-foreground mx-auto mb-1" />
              <p className="text-2xl font-bold text-foreground tabular-nums">
                {stat.value}
              </p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                {stat.label}
              </p>
            </div>
          ))}
        </div>

        {/* Pending Positions */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            Posições Pendentes de Aprovação ({stats.positionsPending})
          </h2>

          {pendingPositions.length === 0 ? (
            <div className="rounded-lg border bg-card p-6 text-center">
              <CheckCircle2 className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">
                Nenhuma posição pendente!
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {pendingPositions.map((pos) => (
                <Link
                  key={pos.id}
                  to={`/admin/candidato/${pos.candidate.id}`}
                  className="group flex items-center justify-between rounded-lg border bg-card p-3 hover:border-foreground/20 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-medium text-foreground truncate">
                        {pos.candidate.displayName}
                      </span>
                      <Badge
                        variant="outline"
                        className="text-[10px] font-normal"
                      >
                        {pos.candidate.party}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground">
                        {pos.topic.category} &middot; {pos.topic.name}
                      </span>
                      <Badge
                        variant="secondary"
                        className="text-[10px] font-normal"
                      >
                        Stance: {pos.stance}
                      </Badge>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground shrink-0" />
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Pending Bills */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <FileText className="w-4 h-4 text-muted-foreground" />
            Votações Pendentes ({stats.billsPending})
          </h2>

          {pendingBills.length === 0 ? (
            <div className="rounded-lg border bg-card p-6 text-center">
              <CheckCircle2 className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">
                Nenhuma votação pendente!
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {pendingBills.map((bill) => (
                <Link
                  key={bill.id}
                  to={`/admin/votacao/${bill.id}`}
                  className="group flex items-center justify-between rounded-lg border bg-card p-3 hover:border-foreground/20 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">
                      {bill.simplifiedTitle || bill.title}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(bill.voteDate).toLocaleDateString("pt-BR")}
                      </span>
                      <Badge
                        variant="outline"
                        className="text-[10px] font-normal"
                      >
                        {bill.sourceType === "senado" ? "Senado" : "Câmara"}
                      </Badge>
                      {bill.aiConfidence && (
                        <span className="text-[10px] text-muted-foreground">
                          IA: {Number(bill.aiConfidence).toFixed(0)}%
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground shrink-0" />
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
}
