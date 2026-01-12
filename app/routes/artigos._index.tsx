import { useLoaderData, Link } from "react-router";
import { Header } from "~/components/Header";
import { Footer } from "~/components/Footer";
import { BookOpen, Calendar, Clock, ArrowRight } from "lucide-react";

export function meta() {
    return [
        { title: "Hub de Conteúdo | Em Quem Votar" },
        { name: "description", content: "Artigos, análises e guias educativos sobre política brasileira." }
    ];
}

interface Article {
    slug: string;
    title: string;
    excerpt: string;
    date: string;
    category: string;
    image?: string;
    readTime?: string;
}

export async function loader() {
    // 1. Glob all MDX files from 'educacao' and 'artigos' prefixes
    const modules = import.meta.glob("./*.mdx", { eager: true });

    // 2. Parse them
    const articles: Article[] = [];

    for (const path in modules) {
        const mod = modules[path] as any;
        const frontmatter = mod.attributes || mod.frontmatter || {};

        // Filter out non-article MDX (e.g. privacy policy, terms, faq)
        // Only include files starting with 'educacao.' or 'artigos.'
        if (!path.includes("/educacao.") && !path.includes("/artigos.")) {
            continue;
        }

        // Check for 'title' at minimum
        if (frontmatter.title) {
            // Extract slug from filename (e.g., "./educacao.importancia-voto.mdx" -> "educacao/importancia-voto")
            // Wait, route is flat: /educacao.importancia-voto
            // React Router flat routes style.
            // The slug for the link should be just the filename without extension, relative to routes root.
            // e.g. path is "./educacao.importancia-voto.mdx" -> slug "educacao.importancia-voto"
            const filename = path.replace("./", "").replace(".mdx", "");

            // Create a cleaner display slug if needed, but for linking we use the route path
            articles.push({
                slug: filename,
                title: frontmatter.title,
                excerpt: frontmatter.excerpt || "",
                date: frontmatter.date || new Date().toISOString(),
                category: frontmatter.category || "Geral",
                image: frontmatter.image,
                readTime: frontmatter.readTime || "5 min"
            });
        }
    }

    // 3. Sort by date desc
    articles.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return { articles };
}

export default function ContentHub() {
    const { articles } = useLoaderData<typeof loader>();

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-gray-900">
            <Header />

            <main className="flex-grow">
                {/* Hero Section */}
                <section className="bg-brand-tertiary text-white py-16 lg:py-24 relative overflow-hidden">
                    <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:20px_20px]"></div>
                    <div className="max-w-4xl mx-auto px-4 relative z-10 text-center space-y-6">
                        <div className="inline-flex items-center justify-center p-3 bg-white/10 rounded-2xl mb-4 backdrop-blur-sm">
                            <BookOpen size={32} className="text-brand-secondary" />
                        </div>
                        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">
                            Hub de <span className="text-brand-primary-light">Conteúdo</span>
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
                                className="group bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-100 flex flex-col h-full hover:-translate-y-1"
                            >
                                {/* Image / Placeholder */}
                                <div className="h-48 bg-gray-200 relative overflow-hidden">
                                    {article.image ? (
                                        <img src={article.image} alt={article.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-brand-primary/5">
                                            <BookOpen className="text-brand-primary/20 w-16 h-16" />
                                        </div>
                                    )}
                                    <div className="absolute top-4 left-4">
                                        <span className="bg-brand-secondary text-brand-text-alt text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow-sm">
                                            {article.category}
                                        </span>
                                    </div>
                                </div>

                                {/* Content */}
                                <div className="p-6 flex flex-col flex-grow">
                                    <div className="flex items-center gap-4 text-xs text-gray-400 mb-3 font-medium">
                                        <span className="flex items-center gap-1">
                                            <Calendar size={14} />
                                            {new Date(article.date).toLocaleDateString('pt-BR')}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Clock size={14} />
                                            {article.readTime}
                                        </span>
                                    </div>

                                    <h2 className="text-xl font-bold text-gray-900 mb-3 line-clamp-2 group-hover:text-brand-primary transition-colors">
                                        {article.title}
                                    </h2>

                                    <p className="text-gray-600 text-sm leading-relaxed mb-6 line-clamp-3">
                                        {article.excerpt}
                                    </p>

                                    <div className="mt-auto flex items-center text-brand-primary font-bold text-sm">
                                        Ler Artigo <ArrowRight size={16} className="ml-2 transition-transform group-hover:translate-x-1" />
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
