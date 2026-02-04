import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router";
import { Header } from "~/components/Header";
import { Footer } from "~/components/Footer";
import { QUIZ_QUESTIONS, type QuizOption } from "~/data/quiz-questions";
import { ArrowRight, Check, X, Undo2, ThumbsUp, ThumbsDown, Scale, Shield, DollarSign, Lock, Unlock, Zap, TreePine, Tractor, Sparkles, Award, Heart, Briefcase, Loader2 } from "lucide-react";

export function meta() {
    return [{ title: "Quiz Político: Descubra seu perfil | Em Quem Votar" }];
}

export default function Quiz() {
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [scores, setScores] = useState<Record<string, number>>({});
    const [isFinishing, setIsFinishing] = useState(false);
    const navigate = useNavigate();

    const currentQuestion = QUIZ_QUESTIONS[currentQuestionIndex];
    const progress = ((currentQuestionIndex) / QUIZ_QUESTIONS.length) * 100;

    const handleAnswer = (option: QuizOption) => {
        const effects = option.affects;

        const newScores = { ...scores };
        effects.forEach(effect => {
            newScores[effect.tagSlug] = (newScores[effect.tagSlug] || 0) + effect.weight;
        });
        setScores(newScores);

        if (currentQuestionIndex < QUIZ_QUESTIONS.length - 1) {
            setCurrentQuestionIndex(prev => prev + 1);
        } else {
            finishQuiz(newScores);
        }
    };

    const finishQuiz = (finalScores: Record<string, number>) => {
        setIsFinishing(true);

        const queryParams = new URLSearchParams();

        // Serialize scores: tag1:5,tag2:3
        const scoreString = Object.entries(finalScores)
            .map(([tag, score]) => `${tag}:${score}`)
            .join(",");

        if (scoreString) {
            queryParams.set("s", scoreString);
        }

        // Small delay to show loading state
        setTimeout(() => {
            navigate(`/resultado?${queryParams.toString()}`);
        }, 300);
    };

    const renderIcon = (iconName?: string) => {
        switch (iconName) {
            case "check": return <Check size={24} strokeWidth={3} />;
            case "x": return <X size={24} strokeWidth={3} />;
            case "thumbs-up": return <ThumbsUp size={24} />;
            case "thumbs-down": return <ThumbsDown size={24} />;
            case "scale": return <Scale size={24} />;
            case "shield": return <Shield size={24} />;
            case "dollar": return <DollarSign size={24} />;
            case "lock": return <Lock size={24} />;
            case "unlock": return <Unlock size={24} />;
            case "tree": return <TreePine size={24} />;
            case "tractor": return <Tractor size={24} />;
            case "sparkles": return <Sparkles size={24} />;
            case "award": return <Award size={24} />;
            case "heart": return <Heart size={24} />;
            case "briefcase": return <Briefcase size={24} />;
            default: return <Check size={24} />;
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-900 flex flex-col">
            <Header breadcrumbItems={[{ label: "Quiz de Afinidade", active: true }]} />

            <main className="flex-1 flex flex-col items-center justify-center p-6 max-w-2xl mx-auto w-full">
                {/* Progress Bar */}
                <div className="w-full flex items-center justify-between text-xs font-bold text-slate-500 mb-2 px-1">
                    <span>{Math.round(progress)}% Concluído</span>
                    <span className="md:hidden">{currentQuestionIndex + 1}/{QUIZ_QUESTIONS.length}</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-3 mb-8 md:mb-12">
                    <div className="bg-brand-primary h-3 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
                </div>

                <div className="bg-white p-6 md:p-12 rounded-3xl shadow-xl border border-slate-100 w-full text-center relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-brand-primary to-brand-secondary"></div>

                    <span className="hidden md:inline-block px-3 py-1 bg-slate-100 text-slate-500 rounded-full text-xs font-bold tracking-wider mb-6">
                        PERGUNTA {currentQuestionIndex + 1} DE {QUIZ_QUESTIONS.length}
                    </span>

                    <h2 className="text-xl md:text-3xl font-bold mb-8 md:mb-12 leading-tight min-h-[60px] flex items-center justify-center">
                        {currentQuestion.text}
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {currentQuestion.options.map((option, idx) => (
                            <button
                                key={idx}
                                onClick={() => handleAnswer(option)}
                                className={`flex flex-col items-center justify-center gap-3 p-6 min-h-[160px] md:min-h-0 rounded-2xl border-2 transition-all active:scale-95 group relative overflow-hidden
                                    ${option.color === 'green' ? 'border-brand-success/20 bg-brand-success/10 text-brand-success hover:bg-brand-success/20 hover:border-brand-success/30' :
                                        option.color === 'red' ? 'border-brand-alert/20 bg-brand-alert/10 text-brand-alert hover:bg-brand-alert/20 hover:border-brand-alert/30' :
                                            option.color === 'blue' ? 'border-brand-primary/20 bg-brand-primary/10 text-brand-primary hover:bg-brand-primary/20 hover:border-brand-primary/30' :
                                                'border-slate-100 bg-slate-50 text-slate-800 hover:bg-slate-100 hover:border-slate-200'
                                    }`}
                            >
                                <div className={`w-14 h-14 rounded-full bg-white flex items-center justify-center shadow-sm mb-1 transition-transform group-hover:scale-110
                                    ${option.color === 'green' ? 'text-brand-success' :
                                        option.color === 'red' ? 'text-brand-alert' :
                                            option.color === 'blue' ? 'text-brand-primary' :
                                                'text-slate-500'
                                    }`}>
                                    {renderIcon(option.icon)}
                                </div>
                                <div>
                                    <span className="font-bold text-lg block mb-1">{option.label}</span>
                                    {option.description && (
                                        <span className={`text-sm opacity-80 font-medium ${option.color === 'green' ? 'text-brand-success' :
                                            option.color === 'red' ? 'text-brand-alert' :
                                                option.color === 'blue' ? 'text-brand-primary' :
                                                    'text-slate-600'
                                            }`}>{option.description}</span>
                                    )}
                                </div>
                            </button>
                        ))}
                    </div>

                    {currentQuestionIndex > 0 && (
                        <button
                            onClick={() => setCurrentQuestionIndex(prev => prev - 1)}
                            className="mt-6 md:mt-8 w-full md:w-auto py-4 md:py-2 text-slate-400 hover:text-slate-600 flex items-center justify-center gap-2 text-sm font-medium transition-colors touch-manipulation"
                        >
                            <Undo2 size={18} />
                            Voltar a pergunta anterior
                        </button>
                    )}
                </div>
            </main>

            {/* Loading Overlay */}
            {isFinishing && (
                <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center">
                    <div className="bg-white rounded-3xl p-8 md:p-12 max-w-md mx-4 text-center shadow-2xl">
                        <div className="w-16 h-16 mx-auto mb-6 relative">
                            <Loader2 className="w-16 h-16 text-brand-primary animate-spin" />
                        </div>
                        <h3 className="text-2xl font-bold text-slate-900 mb-3">
                            Calculando seu match...
                        </h3>
                        <p className="text-slate-600 leading-relaxed">
                            Estamos analisando suas respostas e comparando com o histórico de votações de todos os deputados federais.
                        </p>
                    </div>
                </div>
            )}

            <Footer />
        </div>
    );
}
