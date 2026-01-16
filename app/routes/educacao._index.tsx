import { useLoaderData, Link } from "react-router";
import { Header } from "~/components/Header";
import { Footer } from "~/components/Footer";
import { BookOpen, Calendar, Clock, ArrowRight } from "lucide-react";

export function meta() {
    return [
        { title: "Educação Política | Em Quem Votar" },
        { name: "description", content: "Entenda o cenário político com nossos guias e artigos educativos." }
    ];
}

import { ArticleService } from "~/services/article.server";

// ...

export async function loader() {
    const articles = await ArticleService.list();
    return { articles };
}

export default function ContentHub() {
    const { articles } = useLoaderData<typeof loader>();

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-gray-900">
            <Header breadcrumbItems={[{ label: "Educação Política", active: true }]} />

            <main className="flex-grow">
                {/* Hero Section */}
                <section className="bg-brand-tertiary text-white py-16 lg:py-24 relative overflow-hidden">
                    <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:20px_20px]"></div>
                    <div className="max-w-4xl mx-auto px-4 relative z-10 text-center space-y-6">
                        <div className="inline-flex items-center justify-center p-3 bg-white/10 rounded-2xl mb-4 backdrop-blur-sm">
                            <BookOpen size={32} className="text-brand-secondary" />
                        </div>
                        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">
                            Educação <span className="text-brand-primary-light">Política</span>
                        </h1>
                        <p className="text-xl text-brand-primary-light/80 max-w-2xl mx-auto leading-relaxed">
                            Informação isenta e didática para você entender o cenário político e votar com consciência.
                        </p>
                    </div>
                </section>

                {/* Articles Grid */}
                <section className="max-w-7xl mx-auto px-4 py-16">
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {articles.map((article) => (
                            <Link
                                key={article.slug}
                                to={`/${article.slug}`}
                                className="group bg-white rounded-2xl p-6 hover:shadow-xl transition-all duration-300 border border-gray-100 hover:border-brand-primary/20 cursor-pointer flex flex-col h-full hover:-translate-y-1"
                            >
                                <div className="flex-grow space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="p-2 rounded-xl bg-brand-primary/5 text-brand-primary group-hover:bg-brand-primary group-hover:text-white transition-colors">
                                            <BookOpen size={24} />
                                        </div>
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-secondary/10 text-brand-secondary uppercase tracking-wider">
                                            {article.category}
                                        </span>
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-brand-primary transition-colors leading-tight">
                                            {article.title}
                                        </h2>
                                        <p className="text-gray-500 text-sm leading-relaxed line-clamp-3">
                                            {article.excerpt}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between mt-8 text-brand-primary font-bold text-sm">
                                    <div className="flex items-center gap-4 text-xs text-gray-400 font-medium">
                                        <span className="flex items-center gap-1.5">
                                            <Calendar size={14} />
                                            {new Date(article.date).toLocaleDateString('pt-BR')}
                                        </span>
                                        <span className="flex items-center gap-1.5">
                                            <Clock size={14} />
                                            {article.readTime}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1.5 group/link">
                                        Ler Artigo
                                        <ArrowRight size={16} className="transition-transform group-hover/link:translate-x-1" />
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                </section>
            </main>

            <Footer />
        </div>
    );
}
