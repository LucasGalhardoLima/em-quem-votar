import type { Route } from "./+types/votacao.$id";
import { useLoaderData, Link, Await } from "react-router";
import { BillService } from "~/services/bill.server";
import { Header } from "~/components/Header";
import { Footer } from "~/components/Footer";
import { Badge } from "~/components/ui/badge";
import {
  ExternalLink,
  Search,
  Calendar,
  ThumbsUp,
  ThumbsDown,
  User,
} from "lucide-react";
import { useState, Suspense } from "react";
import { VoteDetailsSkeleton } from "~/components/SkeletonLoader";

export function meta({ data }: Route.MetaArgs) {
  return [
    { title: "Votação | Em Quem Votar?" },
    {
      name: "description",
      content:
        "Veja quem votou a favor e contra nesta votação importante.",
    },
  ];
}

export async function loader({ params }: Route.LoaderArgs) {
  if (!params.id) {
    throw new Response("ID inválido", { status: 400 });
  }
  const billPromise = BillService.getById(params.id);
  return { bill: billPromise };
}

type BillData = NonNullable<Awaited<ReturnType<typeof BillService.getById>>>;

export default function VotacaoRoute() {
  const { bill } = useLoaderData<typeof loader>();

  return (
    <Suspense fallback={<VoteDetailsSkeleton />}>
      <Await resolve={bill}>
        {(resolvedBill) => {
          if (!resolvedBill)
            return (
              <div className="min-h-screen bg-background">
                <Header
                  breadcrumbItems={[
                    { label: "Votações", href: "/votacoes" },
                    { label: "Não encontrada", active: true },
                  ]}
                />
                <div className="max-w-4xl mx-auto px-4 py-16 text-center">
                  <p className="text-muted-foreground">
                    Votação não encontrada.
                  </p>
                  <Link
                    to="/votacoes"
                    className="text-sm text-brand-primary hover:underline mt-2 inline-block"
                  >
                    Voltar para votações
                  </Link>
                </div>
                <Footer />
              </div>
            );
          return <VoteDetailsContent bill={resolvedBill} />;
        }}
      </Await>
    </Suspense>
  );
}

function VoteDetailsContent({ bill }: { bill: BillData }) {
  const [filter, setFilter] = useState("");

  const filterText = filter.toLowerCase();

  // Candidate votes (new system)
  const candidateSim = bill.candidateVotes.filter(
    (v) =>
      v.voteType === "SIM" &&
      (!filterText ||
        v.candidateName.toLowerCase().includes(filterText) ||
        v.candidateParty.toLowerCase().includes(filterText))
  );
  const candidateNao = bill.candidateVotes.filter(
    (v) =>
      v.voteType === "NÃO" &&
      (!filterText ||
        v.candidateName.toLowerCase().includes(filterText) ||
        v.candidateParty.toLowerCase().includes(filterText))
  );
  const candidateOther = bill.candidateVotes.filter(
    (v) =>
      v.voteType !== "SIM" &&
      v.voteType !== "NÃO" &&
      (!filterText ||
        v.candidateName.toLowerCase().includes(filterText) ||
        v.candidateParty.toLowerCase().includes(filterText))
  );

  // Legacy votes (old politician system)
  const legacySim = bill.legacyVotes.filter(
    (v) =>
      v.voteType === "SIM" &&
      (!filterText ||
        v.politician.name.toLowerCase().includes(filterText) ||
        v.politician.party.toLowerCase().includes(filterText))
  );
  const legacyNao = bill.legacyVotes.filter(
    (v) =>
      v.voteType === "NÃO" &&
      (!filterText ||
        v.politician.name.toLowerCase().includes(filterText) ||
        v.politician.party.toLowerCase().includes(filterText))
  );

  return (
    <div className="min-h-screen bg-background">
      <Header
        breadcrumbItems={[
          { label: "Votações", href: "/votacoes" },
          { label: "Detalhes", active: true },
        ]}
      />

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Title */}
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
            {bill.simplifiedTitle || bill.title}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {new Date(bill.voteDate).toLocaleDateString("pt-BR")}
            </span>
            <Badge variant="outline" className="text-[10px] font-normal">
              {bill.sourceType === "senado" ? "Senado" : "Câmara"}
            </Badge>
            {bill.sourceUrl && (
              <a
                href={bill.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-brand-primary hover:underline inline-flex items-center gap-0.5"
              >
                Fonte oficial <ExternalLink className="w-2.5 h-2.5" />
              </a>
            )}
          </div>
        </div>

        {/* Description */}
        {(bill.simplifiedDescription || bill.description) && (
          <section className="rounded-lg border bg-card p-4">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Sobre a Votação
            </h2>
            <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-line">
              {bill.simplifiedDescription || bill.description}
            </p>
          </section>
        )}

        {/* Sim / Não explanation */}
        {(bill.voteSimDetails || bill.voteNaoDetails) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {bill.voteSimDetails && (
              <div className="rounded-lg border bg-card p-4">
                <div className="flex items-center gap-1.5 mb-2">
                  <ThumbsUp className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Votar Sim significa
                  </span>
                </div>
                <p className="text-xs text-foreground/80 leading-relaxed">
                  {bill.voteSimDetails}
                </p>
              </div>
            )}
            {bill.voteNaoDetails && (
              <div className="rounded-lg border bg-card p-4">
                <div className="flex items-center gap-1.5 mb-2">
                  <ThumbsDown className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Votar Não significa
                  </span>
                </div>
                <p className="text-xs text-foreground/80 leading-relaxed">
                  {bill.voteNaoDetails}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Summary counters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: "Sim", count: bill.summary.sim },
            { label: "Não", count: bill.summary.nao },
            { label: "Abstenção", count: bill.summary.abstencao },
            { label: "Obstrução", count: bill.summary.obstrucao },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-lg border bg-card p-3 text-center"
            >
              <p className="text-xl font-bold text-foreground tabular-nums">
                {item.count}
              </p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                {item.label}
              </p>
            </div>
          ))}
        </div>

        {/* Filter */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="w-4 h-4 text-muted-foreground" />
          </div>
          <input
            type="text"
            placeholder="Filtrar por nome ou partido..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full pl-10 pr-3 py-2.5 border border-border rounded-lg bg-card text-sm placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring transition-all"
          />
        </div>

        {/* Candidate votes (new system) */}
        {bill.candidateVotes.length > 0 && (
          <>
            <h3 className="text-sm font-semibold text-foreground">
              Votos dos Candidatos
            </h3>
            <div className="grid md:grid-cols-2 gap-6">
              <VoteColumn
                title="Sim"
                entries={candidateSim.map((v) => ({
                  id: v.candidateId,
                  name: v.candidateName,
                  subtitle: v.candidateParty,
                  photoUrl: v.candidatePhotoUrl,
                  linkTo: `/candidato/${v.candidateId}`,
                }))}
              />
              <VoteColumn
                title="Não"
                entries={candidateNao.map((v) => ({
                  id: v.candidateId,
                  name: v.candidateName,
                  subtitle: v.candidateParty,
                  photoUrl: v.candidatePhotoUrl,
                  linkTo: `/candidato/${v.candidateId}`,
                }))}
              />
            </div>
            {candidateOther.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Abstenção / Obstrução
                </h4>
                <div className="flex flex-wrap gap-2">
                  {candidateOther.map((v) => (
                    <Link
                      key={v.candidateId}
                      to={`/candidato/${v.candidateId}`}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {v.candidateName} ({v.voteType})
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Legacy votes (old politician system) */}
        {bill.legacyVotes.length > 0 && (
          <>
            <h3 className="text-sm font-semibold text-foreground">
              Votos dos Deputados
            </h3>
            <div className="grid md:grid-cols-2 gap-6">
              <VoteColumn
                title="Sim"
                entries={legacySim.map((v) => ({
                  id: v.id,
                  name: v.politician.name,
                  subtitle: `${v.politician.party} · ${v.politician.state}`,
                  photoUrl: v.politician.photoUrl,
                  linkTo: `/politico/${v.politician.id}`,
                }))}
              />
              <VoteColumn
                title="Não"
                entries={legacyNao.map((v) => ({
                  id: v.id,
                  name: v.politician.name,
                  subtitle: `${v.politician.party} · ${v.politician.state}`,
                  photoUrl: v.politician.photoUrl,
                  linkTo: `/politico/${v.politician.id}`,
                }))}
              />
            </div>
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}

interface VoteColumnEntry {
  id: string;
  name: string;
  subtitle: string;
  photoUrl: string | null;
  linkTo: string;
}

function VoteColumn({
  title,
  entries,
}: {
  title: string;
  entries: VoteColumnEntry[];
}) {
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pb-1 border-b border-border">
        {title} ({entries.length})
      </h4>
      {entries.length === 0 ? (
        <p className="text-xs text-muted-foreground italic py-2">
          Nenhum voto encontrado.
        </p>
      ) : (
        <div className="space-y-1">
          {entries.map((entry) => (
            <Link
              key={entry.id}
              to={entry.linkTo}
              className="flex items-center gap-2.5 p-2 rounded-md hover:bg-muted/50 transition-colors group"
            >
              <div className="w-8 h-8 rounded-full bg-muted overflow-hidden shrink-0 flex items-center justify-center">
                {entry.photoUrl ? (
                  <img
                    src={entry.photoUrl}
                    alt={entry.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-4 h-4 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-foreground group-hover:text-foreground/80 truncate">
                  {entry.name}
                </p>
                <p className="text-[10px] text-muted-foreground truncate">
                  {entry.subtitle}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
