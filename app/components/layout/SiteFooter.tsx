import { Link } from "react-router";
import type { countdownCopy } from "~/lib/election";
import { Container } from "./Container";
import { countdownSentence } from "./CountdownBanner";

/**
 * A única navegação institucional persistente do site.
 *
 * `/privacidade` e `/termos` existiam como rota e não eram linkadas de lugar
 * nenhum — só do `sitemap.xml`. Uma plataforma que promete em `/metodologia`
 * que "as respostas ficam no seu aparelho" e carrega o Vercel Analytics precisa
 * da política alcançável a um clique, de qualquer página. `/educacao` aparece
 * aqui além do menu porque é conteúdo de leitura, não uma etapa do fluxo.
 *
 * Quem adicionar uma rota institucional acrescenta o destino AQUI; o menu do
 * `SiteHeader` é só para as seções do fluxo principal.
 */
const FOOTER_LINKS = [
  { label: "Metodologia", to: "/metodologia" },
  { label: "Educação", to: "/educacao" },
  { label: "Sobre", to: "/sobre" },
  { label: "Dúvidas", to: "/faq" },
  { label: "Privacidade", to: "/privacidade" },
  { label: "Termos", to: "/termos" },
] as const;

export function SiteFooter({
  countdown,
}: {
  /**
   * Vem do loader da raiz, calculado no servidor — a mesma razão descrita no
   * `CountdownBanner`. Opcional porque a `ErrorBoundary` renderiza o rodapé
   * sem dados de loader (o loader pode ter sido justamente o que falhou);
   * nesse caso a linha some, em vez de a página de erro quebrar.
   */
  countdown?: ReturnType<typeof countdownCopy>;
}) {
  return (
    <footer className="mt-auto bg-slate-800 text-slate-400">
      <Container className="flex flex-col gap-4 py-6 text-xs sm:flex-row sm:items-start sm:justify-between sm:gap-8">
        <div className="flex flex-col gap-1">
          <p>
            Fontes oficiais: TSE · Câmara · Senado — cada dado exibe a data da
            última atualização
          </p>
          {countdown ? (
            <p className="text-slate-300">{countdownSentence(countdown)}</p>
          ) : null}
        </div>

        <nav aria-label="Institucional" className="sm:flex-none">
          {/*
            `min-h-8` em cada link, e não só `text-xs`: em texto de 12px o alvo
            media 16px de altura, abaixo dos 24×24 CSS px do SC 2.5.8 (Target
            Size, Minimum). Estes links não estão dentro de um bloco de texto
            corrido, então não caem na exceção de "inline" — a altura precisa
            ser do alvo mesmo. 32px, e não os 24px do mínimo, porque a folga
            extra custa 8px por linha e é o que separa um alvo que o polegar
            acerta de um que ele quase acerta.

            Os 44px do SC 2.5.5 (AAA) ficam de fora aqui, de propósito: com
            seis destinos quebrando em duas linhas no telefone, o rodapé
            passaria de ~100px para quase 200px de altura em toda página. O
            projeto mira AA; onde o alvo é o único caminho — o botão do menu no
            cabeçalho — ele tem os 44px.
          */}
          <ul className="flex flex-wrap gap-x-5 gap-y-1 sm:justify-end">
            {FOOTER_LINKS.map((item) => (
              <li key={item.to}>
                <Link
                  to={item.to}
                  className="focus-ring inline-flex min-h-8 items-center rounded-sm transition-colors hover:text-slate-200"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </Container>
    </footer>
  );
}
