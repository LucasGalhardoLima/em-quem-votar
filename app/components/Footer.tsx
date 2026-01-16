import { Link } from "react-router";

export function Footer() {
  return (
    <footer className="bg-brand-tertiary text-white py-8 md:py-12 mt-20 font-sans border-t border-brand-tertiary">
      <div className="max-w-7xl mx-auto px-4">
        {/* Mobile: Stack columns, Desktop: 4 columns */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 md:gap-8 mb-12">
          {/* Brand & Mission */}
          <div className="space-y-4">
            <div className="text-xl font-bold text-white">
              Em Quem <span className="text-brand-secondary">Votar?</span>
            </div>
            <p className="text-sm text-white/70 leading-relaxed max-w-sm">
              Plataforma independente para decisões eleitorais informadas, baseada em dados reais e auditáveis.
            </p>
            <div className="text-xs text-white/50 font-medium tracking-wide uppercase">
              Apartidário • Open Data
            </div>
          </div>

          {/* Navigation */}
          <div>
            <h4 className="font-semibold text-white mb-4">Navegação</h4>
            <ul className="space-y-3 md:space-y-2 text-sm text-white/70">
              <li><Link to="/" className="hover:text-brand-secondary transition-colors block py-1 md:py-0">Início</Link></li>
              <li><Link to="/busca" className="hover:text-brand-secondary transition-colors block py-1 md:py-0">Buscar Políticos</Link></li>
              <li><Link to="/comparar" className="hover:text-brand-secondary transition-colors block py-1 md:py-0">Comparar</Link></li>
              <li><Link to="/quiz" className="hover:text-brand-secondary transition-colors block py-1 md:py-0">Quiz Político</Link></li>
            </ul>
          </div>

          {/* Transparency */}
          <div>
            <h4 className="font-semibold text-white mb-4">Transparência</h4>
            <ul className="space-y-3 md:space-y-2 text-sm text-white/70">
              <li><Link to="/sobre" className="hover:text-brand-secondary transition-colors block py-1 md:py-0">Sobre o Projeto</Link></li>
              <li><Link to="/faq" className="hover:text-brand-secondary transition-colors block py-1 md:py-0">Perguntas Frequentes</Link></li>
              <li><Link to="/metodologia" className="hover:text-brand-secondary transition-colors block py-1 md:py-0">Metodologia</Link></li>
              <li><a href="https://github.com/LucasGalhardoLima/em-quem-votar" target="_blank" rel="noopener noreferrer" className="hover:text-brand-secondary transition-colors block py-1 md:py-0">Código Aberto (GitHub)</a></li>
            </ul>
          </div>

          {/* Data Sources - Visible on Mobile too, but styled consistently */}
          <div>
            <h4 className="font-semibold text-white mb-4">Legal</h4>
            <ul className="space-y-3 md:space-y-2 text-sm text-white/70">
              <li><Link to="/privacidade" className="hover:text-brand-secondary transition-colors block py-1 md:py-0">Política de Privacidade</Link></li>
              <li><Link to="/termos" className="hover:text-brand-secondary transition-colors block py-1 md:py-0">Termos de Uso</Link></li>
            </ul>

            <h4 className="font-semibold text-white mt-8 mb-4">Fontes de Dados</h4>
            <ul className="space-y-2 text-xs text-white/50">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-success shrink-0"></span>
                API Câmara dos Deputados
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-success shrink-0"></span>
                Portal Dados Abertos
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-success shrink-0"></span>
                CEAP (Portal da Transparência)
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/20 pt-8 flex flex-col md:flex-row justify-between items-center text-xs text-white/50 gap-4 text-center md:text-left">
          <p>
            &copy; {new Date().getFullYear()} Em Quem Votar? Todos os direitos reservados.
          </p>
          <div className="flex gap-4">
            <span>Feito com ❤️ por Lucas Galhardo</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
