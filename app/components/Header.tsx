
import { Link } from "react-router";
import { ArrowLeft } from "lucide-react";

export function Header() {
  return (
    <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
      <div className="max-w-4xl mx-auto px-4 h-16 flex items-center">
        <Link to="/" className="text-gray-500 hover:text-blue-600 transition-colors flex items-center gap-2 font-medium">
          <ArrowLeft size={20} />
          Voltar para o início
        </Link>
      </div>
    </header>
  );
}
