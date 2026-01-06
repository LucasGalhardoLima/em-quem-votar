import { Link } from "react-router";

export function Footer() {
  return (
    <footer className="bg-white border-t border-gray-100 py-12 mt-auto">
      <div className="max-w-7xl mx-auto px-4">
        <div className="grid md:grid-cols-2 gap-8 mb-8">
          <div>
            <div className="text-xl font-bold text-gray-900 mb-4">
              Em Quem <span className="text-blue-600">Votar?</span>
            </div>
            <p className="text-gray-500 leading-relaxed max-w-md">
              Uma iniciativa independente para trazer transparência e clareza ao processo eleitoral. 
              Ajudamos você a conectar seus valores aos votos dos seus representantes.
            </p>
          </div>
          
          <div className="flex flex-col md:items-end justify-center space-y-2 text-sm text-gray-500">
             <Link to="/educacao/importancia-do-voto" className="hover:text-blue-600 transition-colors">A Importância do Voto</Link>
             <Link to="/educacao/como-escolher" className="hover:text-blue-600 transition-colors">Como Escolher Candidatos</Link>
             <Link to="/educacao/mito-voto-nulo" className="hover:text-blue-600 transition-colors">Mito do Voto Nulo</Link>
             <Link to="/metodologia" className="hover:text-blue-600 transition-colors font-semibold pt-2">Metodologia e Transparência</Link>
          </div>
        </div>

        <div className="border-t border-gray-100 pt-8 text-xs text-gray-400 leading-relaxed text-justify md:text-center">
            <p className="mb-2">
                <strong>Aviso Legal:</strong> Este site é uma iniciativa cívica independente e <strong>não possui vínculo com nenhum partido político, candidato ou órgão governamental</strong>.
            </p>
            <p className="mb-2">
                Todos os dados brutos sobre votações, presença e despesas são obtidos automaticamente através da <a href="https://dadosabertos.camara.leg.br/" target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-600">API de Dados Abertos da Câmara dos Deputados</a>.
            </p>
            <p>
                As classificações (tags) atribuídas aos parlamentares são geradas <strong>algoritmicamente</strong> com base puramente no histórico de votos públicos em projetos de lei selecionados. 
                Elas representam padrões comportamentais objetivos e <strong>não constituem opinião editorial</strong> ou juízo de valor pessoal dos criadores da plataforma.
            </p>
        </div>
        
        <div className="text-center mt-8 text-gray-300 text-xs">
           &copy; {new Date().getFullYear()} Em Quem Votar. Código aberto e auditável.
        </div>
      </div>
    </footer>
  );
}
