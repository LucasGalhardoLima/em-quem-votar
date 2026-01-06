
import { Check, X } from "lucide-react";

interface QuizCardProps {
  question: string;
  description: string;
  onAnswer: (answer: "SIM" | "NÃO") => void;
  currentStep: number;
  totalSteps: number;
}

export function QuizCard({ question, description, onAnswer, currentStep, totalSteps }: QuizCardProps) {
  return (
    <div className="bg-white rounded-3xl shadow-xl p-8 md:p-12 w-full max-w-lg mx-auto text-center animate-fade-in-up">
      <div className="mb-8">
        <div className="flex justify-center gap-2 mb-6">
            {Array.from({ length: totalSteps }).map((_, i) => (
                <div 
                    key={i} 
                    className={`h-2 rounded-full transition-all duration-500 ${
                        i < currentStep ? 'w-8 bg-blue-600' : 
                        i === currentStep ? 'w-8 bg-blue-600' : 'w-2 bg-gray-200'
                    }`}
                />
            ))}
        </div>
        <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4 leading-tight">
          {question}
        </h2>
        <p className="text-gray-600">
          {description}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => onAnswer("NÃO")}
          className="group relative flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border-2 border-red-100 bg-red-50 hover:bg-red-100 hover:border-red-200 transition-all active:scale-95"
        >
          <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center text-red-500 shadow-sm group-hover:scale-110 transition-transform">
            <X size={24} strokeWidth={3} />
          </div>
          <span className="font-bold text-red-700 text-lg">Não</span>
        </button>

        <button
          onClick={() => onAnswer("SIM")}
          className="group relative flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border-2 border-green-100 bg-green-50 hover:bg-green-100 hover:border-green-200 transition-all active:scale-95"
        >
          <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center text-green-500 shadow-sm group-hover:scale-110 transition-transform">
            <Check size={24} strokeWidth={3} />
          </div>
          <span className="font-bold text-green-700 text-lg">Sim</span>
        </button>
      </div>
    </div>
  );
}
