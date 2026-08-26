import { Link } from "react-router";
import { Container } from "./Container";

export function SiteFooter() {
  return (
    <footer className="mt-auto bg-slate-800 text-slate-400">
      <Container className="flex flex-col gap-3 py-4 text-[12.5px] sm:flex-row sm:items-center sm:justify-between">
        <span>
          Fontes oficiais: TSE · Câmara · Senado — cada dado exibe a data da
          última atualização
        </span>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <Link to="/metodologia" className="transition-colors hover:text-slate-200">
            Metodologia pública em{" "}
            <span className="text-indigo-300">/metodologia</span>
          </Link>
          <Link to="/sobre" className="transition-colors hover:text-slate-200">
            Sobre
          </Link>
          <Link to="/faq" className="transition-colors hover:text-slate-200">
            Dúvidas
          </Link>
        </div>
      </Container>
    </footer>
  );
}
