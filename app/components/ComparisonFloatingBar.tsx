import { Link } from "react-router";
import { useComparisonStore } from "~/stores/comparisonStore";
import { X, ArrowRight } from "lucide-react";

import posthog from "posthog-js";

export function ComparisonFloatingBar() {
  const { selectedIds, clear } = useComparisonStore();

  if (selectedIds.length === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-5 fade-in duration-300">
      <div className="bg-gray-900 text-white rounded-full shadow-2xl px-6 py-3 flex items-center gap-6 border border-gray-700">
        <div className="flex items-center gap-3">
          <span className="bg-blue-600 text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
            {selectedIds.length}
          </span>
          <span className="font-medium text-sm">
            {selectedIds.length === 1 ? "Político selecionado" : "Políticos selecionados"}
            <span className="text-gray-400 ml-1 text-xs">(máx 3)</span>
          </span>
        </div>

        <div className="h-4 w-px bg-gray-700"></div>

        <div className="flex items-center gap-3">
          <button 
            onClick={clear}
            className="text-xs text-gray-400 hover:text-white transition-colors"
          >
            Limpar
          </button>
          
          <Link
            to={`/comparar?ids=${selectedIds.join(",")}`}
            className={`flex items-center gap-2 px-4 py-2 rounded-full font-bold text-sm transition-all ${
              selectedIds.length >= 2 
                ? "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/50" 
                : "bg-gray-800 text-gray-400 cursor-not-allowed"
            }`}
            onClick={(e) => {
              if (selectedIds.length < 2) {
                e.preventDefault();
                alert("Selecione pelo menos 2 políticos para comparar.");
              } else {
                posthog.capture('comparison_started', { 
                    quantity: selectedIds.length,
                    ids: selectedIds
                });
              }
            }}
          >
            Comparar
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </div>
  );
}
