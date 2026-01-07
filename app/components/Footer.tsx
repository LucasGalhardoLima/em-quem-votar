import { Link } from "react-router";

export function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-300 py-12 mt-20 font-sans border-t border-gray-800">
      <div className="max-w-7xl mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          {/* Brand & Mission */}
          <div>
            <div className="text-xl font-bold text-white mb-4">
              Em Quem <span className="text-blue-500">Votar?</span>
            </div>
            <p className="text-sm text-gray-400 mb-4 leading-relaxed">
              Plataforma independente para decisões eleitorais informadas, baseada em dados reais e auditáveis.
            </p>
            <div className="text-xs text-gray-500 font-medium tracking-wide uppercase">
              Apartidário • Open Data
            </div>
          </div>

          {/* Navigation */}
          <div>
            <h4 className="font-semibold text-white mb-4">Navegação</h4>
            <ul className="space-y-2 text-sm text-gray-400">
              <li><Link to="/" className="hover:text-blue-400 transition-colors">Início</Link></li>
              <li><Link to="/busca" className="hover:text-blue-400 transition-colors">Buscar Políticos</Link></li>
              <li><Link to="/comparar" className="hover:text-blue-400 transition-colors">Comparar</Link></li>
              <li><Link to="/quiz" className="hover:text-blue-400 transition-colors">Quiz Político</Link></li>
            </ul>
          </div>

          {/* Transparency */}
          <div>
            <h4 className="font-semibold text-white mb-4">Transparência</h4>
            <ul className="space-y-2 text-sm text-gray-400">
              <li><Link to="/sobre" className="hover:text-blue-400 transition-colors">Sobre o Projeto</Link></li>
              <li><Link to="/faq" className="hover:text-blue-400 transition-colors">Perguntas Frequentes</Link></li>
              <li><Link to="/metodologia" className="hover:text-blue-400 transition-colors">Metodologia</Link></li>
              <li><a href="https://github.com/LucasGalhardoLima/em-quem-votar" target="_blank" rel="noopener noreferrer" className="hover:text-blue-400 transition-colors">Código Aberto (GitHub)</a></li>
            </ul>
          </div>

          {/* Data Sources */}
          <div>
            <h4 className="font-semibold text-white mb-4">Legal</h4>
            <ul className="space-y-2 text-sm text-gray-400">
              <li><Link to="/privacidade" className="hover:text-blue-400 transition-colors">Política de Privacidade</Link></li>
              <li><Link to="/termos" className="hover:text-blue-400 transition-colors">Termos de Uso</Link></li>
            </ul>

            <h4 className="font-semibold text-white mt-8 mb-4">Fontes de Dados</h4>
            <ul className="space-y-2 text-xs text-gray-500">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                API Câmara dos Deputados
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                Portal Dados Abertos
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                CEAP (Portal da Transparência)
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row justify-between items-center text-xs text-gray-500">
          <p>
            &copy; {new Date().getFullYear()} Em Quem Votar? Todos os direitos reservados.
          </p>
          <div className="flex gap-4 mt-4 md:mt-0">
            <span>Feito com ❤️ por Lucas Galhardo e contribuidores</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
