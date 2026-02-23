import { cn } from "~/lib/utils";

interface QuizProgressProps {
  currentQuestion: number;
  totalQuestions: number;
  axisLabel?: string;
}

export function QuizProgress({
  currentQuestion,
  totalQuestions,
  axisLabel,
}: QuizProgressProps) {
  const progress = ((currentQuestion) / totalQuestions) * 100;

  return (
    <div className="w-full space-y-2">
      <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
        <span>
          {axisLabel && (
            <span className="text-foreground font-semibold">{axisLabel} — </span>
          )}
          {Math.round(progress)}% concluído
        </span>
        <span>
          {currentQuestion + 1}/{totalQuestions}
        </span>
      </div>
      <div className="w-full bg-muted rounded-full h-2.5">
        <div
          className="bg-brand-primary h-2.5 rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
