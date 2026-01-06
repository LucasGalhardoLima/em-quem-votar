import { useState, useEffect } from "react";
import posthog from "posthog-js";
import { Link, useNavigate } from "react-router";
import { Header } from "~/components/Header";
import { QUIZ_QUESTIONS } from "~/data/quiz-questions";
import { ArrowRight, Check, X, Undo2 } from "lucide-react";

export function meta() {
    return [{ title: "Quiz Político: Descubra seu perfil | Em Quem Votar" }];
}

export default function Quiz() {
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [scores, setScores] = useState<Record<string, number>>({});
    const navigate = useNavigate();

    useEffect(() => {
        posthog.capture('quiz_started');
    }, []);

    const currentQuestion = QUIZ_QUESTIONS[currentQuestionIndex];
    const progress = ((currentQuestionIndex) / QUIZ_QUESTIONS.length) * 100;

    const handleAnswer = (answer: "YES" | "NO") => {
        const effects = answer === "YES" ? currentQuestion.yesAffects : currentQuestion.noAffects;
        
        const newScores = { ...scores };
        effects.forEach(effect => {
            newScores[effect.tagSlug] = (newScores[effect.tagSlug] || 0) + effect.weight;
        });
        setScores(newScores);

        posthog.capture('quiz_question_answered', {
            question_index: currentQuestionIndex,
            answer
        });

        if (currentQuestionIndex < QUIZ_QUESTIONS.length - 1) {
            setCurrentQuestionIndex(prev => prev + 1);
        } else {
            finishQuiz(newScores);
        }
    };

    const finishQuiz = (finalScores: Record<string, number>) => {
        // Find top 2 tags
        const sortedTags = Object.entries(finalScores)
            .sort(([, a], [, b]) => b - a)
            .map(([tag]) => tag)
            .slice(0, 2); // Get top 2
        
        posthog.capture('quiz_completed', {
            top_tags: sortedTags
        });
        
        const queryParams = new URLSearchParams();
        if (sortedTags.length > 0) {
            queryParams.set("tags", sortedTags.join(","));
        }
        
        navigate(`/busca?${queryParams.toString()}`);
    };

    return (
        <div className="min-h-screen bg-gray-50 font-sans text-gray-900 flex flex-col">
            <Header />

            <main className="flex-1 flex flex-col items-center justify-center p-6 max-w-2xl mx-auto w-full">
                {/* Progress Bar */}
                <div className="w-full bg-gray-200 rounded-full h-2 mb-12">
                    <div className="bg-blue-600 h-2 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
                </div>

                <div className="bg-white p-8 md:p-12 rounded-3xl shadow-xl border border-gray-100 w-full text-center relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 to-purple-500"></div>
                    
                    <span className="inline-block px-3 py-1 bg-gray-100 text-gray-500 rounded-full text-xs font-bold tracking-wider mb-6">
                        PERGUNTA {currentQuestionIndex + 1} DE {QUIZ_QUESTIONS.length}
                    </span>

                    <h2 className="text-2xl md:text-3xl font-bold mb-12 leading-tight">
                        {currentQuestion.text}
                    </h2>

                    <div className="grid grid-cols-2 gap-4">
                        <button 
                            onClick={() => handleAnswer("NO")}
                            className="flex flex-col items-center justify-center gap-2 p-6 rounded-2xl border-2 border-red-100 bg-red-50 text-red-700 hover:bg-red-100 hover:border-red-200 transition-all active:scale-95"
                        >
                            <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-sm text-red-500 mb-2">
                                <X size={24} strokeWidth={3} />
                            </div>
                            <span className="font-bold text-lg">Não</span>
                        </button>

                        <button 
                            onClick={() => handleAnswer("YES")}
                            className="flex flex-col items-center justify-center gap-2 p-6 rounded-2xl border-2 border-green-100 bg-green-50 text-green-700 hover:bg-green-100 hover:border-green-200 transition-all active:scale-95"
                        >
                            <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-sm text-green-500 mb-2">
                                <Check size={24} strokeWidth={3} />
                            </div>
                            <span className="font-bold text-lg">Sim</span>
                        </button>
                    </div>

                    {currentQuestionIndex > 0 && (
                        <button 
                            onClick={() => setCurrentQuestionIndex(prev => prev - 1)}
                            className="mt-8 text-gray-400 hover:text-gray-600 flex items-center justify-center gap-2 text-sm font-medium transition-colors"
                        >
                            <Undo2 size={16} />
                            Voltar
                        </button>
                    )}
                </div>
            </main>
        </div>
    );
}
