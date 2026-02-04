import { Link } from "react-router";
import { BookOpen, Calendar, Clock, ArrowRight } from "lucide-react";

interface Article {
    slug: string;
    title: string;
    excerpt: string;
    category: string;
    date: string;
    readTime: string;
}

interface EducationSectionProps {
    articles: Article[];
}

export function EducationSection({ articles }: EducationSectionProps) {
    return (
        <section className="py-16 md:py-24 px-4 bg-gradient-to-br from-brand-tertiary to-brand-text">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="text-center mb-12">
                    <p className="text-brand-secondary font-semibold text-sm uppercase tracking-wider mb-4">
                        Aprenda
                    </p>
                    <h2 className="font-heading text-3xl md:text-4xl font-bold text-white mb-4">
                        Educação Política
                    </h2>
                    <p className="text-white/80 text-lg max-w-2xl mx-auto">
                        Informação isenta e didática para você entender o cenário político.
                    </p>
                </div>

                {/* Grid */}
                <div className="grid md:grid-cols-3 gap-6 mb-8">
                    {articles.map((article) => (
                        <Link
                            key={article.slug}
                            to={`/${article.slug}`}
                            className="group bg-white/95 hover:bg-white rounded-2xl p-6 hover:shadow-2xl transition-all hover:-translate-y-1"
                        >
                            <div className="flex flex-col h-full">
                                {/* Header */}
                                <div className="flex items-center justify-between mb-4">
                                    <div className="p-2 rounded-xl bg-brand-primary/10 text-brand-primary group-hover:bg-brand-primary group-hover:text-white transition-colors">
                                        <BookOpen size={24} />
                                    </div>
                                    <span className="text-xs font-bold px-2 py-1 rounded-full bg-brand-secondary/10 text-brand-secondary uppercase tracking-wide">
                                        {article.category}
                                    </span>
                                </div>

                                {/* Content */}
                                <div className="flex-1">
                                    <h3 className="font-bold text-lg text-gray-900 group-hover:text-brand-primary transition-colors mb-2 line-clamp-2 leading-tight">
                                        {article.title}
                                    </h3>
                                    <p className="text-sm text-gray-600 line-clamp-3 leading-relaxed">
                                        {article.excerpt}
                                    </p>
                                </div>

                                {/* Footer */}
                                <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100">
                                    <div className="flex items-center gap-3 text-xs text-gray-400">
                                        <span className="flex items-center gap-1">
                                            <Calendar size={12} />
                                            {new Date(article.date).toLocaleDateString("pt-BR")}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Clock size={12} />
                                            {article.readTime}
                                        </span>
                                    </div>
                                    <span className="text-sm text-brand-primary font-semibold flex items-center gap-1">
                                        Ler
                                        <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                                    </span>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>

                {/* CTA */}
                <div className="text-center">
                    <Link
                        to="/educacao"
                        className="inline-flex items-center gap-2 bg-white hover:bg-gray-50 text-brand-primary font-bold px-8 py-4 rounded-xl transition-colors shadow-lg hover:shadow-xl"
                    >
                        Ver Todos os Artigos
                        <ArrowRight size={18} />
                    </Link>
                </div>
            </div>
        </section>
    );
}
