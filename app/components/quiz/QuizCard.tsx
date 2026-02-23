import { QuizOption } from "./QuizOption";
import { Undo2 } from "lucide-react";

interface QuizQuestion {
  id: string;
  text: string;
  topicSlug: string;
  topicName: string;
  options: {
    id: string;
    label: string;
    description: string | null;
    stanceValue: number;
    icon: string | null;
  }[];
}

interface QuizCardProps {
  question: QuizQuestion;
  questionNumber: number;
  totalQuestions: number;
  selectedValue: number | null;
  onAnswer: (topicSlug: string, stanceValue: number) => void;
  onBack?: () => void;
}

export function QuizCard({
  question,
  questionNumber,
  totalQuestions,
  selectedValue,
  onAnswer,
  onBack,
}: QuizCardProps) {
  return (
    <div className="bg-card p-6 md:p-10 rounded-2xl shadow-lg border border-border w-full relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-brand-primary to-brand-secondary" />

      <span className="hidden md:inline-block px-3 py-1 bg-muted text-muted-foreground rounded-full text-xs font-bold tracking-wider mb-6">
        {question.topicName.toUpperCase()}
      </span>

      <h2 className="text-xl md:text-2xl font-bold mb-8 leading-tight text-foreground">
        {question.text}
      </h2>

      <div className="space-y-3">
        {question.options.map((option) => (
          <QuizOption
            key={option.id}
            label={option.label}
            description={option.description}
            stanceValue={option.stanceValue}
            icon={option.icon}
            isSelected={selectedValue === option.stanceValue}
            onSelect={() => onAnswer(question.topicSlug, option.stanceValue)}
          />
        ))}
      </div>

      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="mt-6 w-full md:w-auto py-3 md:py-2 text-muted-foreground hover:text-foreground flex items-center justify-center gap-2 text-sm font-medium transition-colors"
        >
          <Undo2 size={16} />
          Voltar
        </button>
      )}
    </div>
  );
}
