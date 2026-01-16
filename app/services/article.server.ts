
export interface Article {
  slug: string;
  title: string;
  excerpt: string;
  date: string;
  category: string;
  image?: string;
  readTime?: string;
}

export const ArticleService = {
  async list(limit?: number): Promise<Article[]> {
    // Use an explicit glob for education files
    const modules = import.meta.glob("../routes/educacao.*.mdx", { eager: true });
    const articles: Article[] = [];

    for (const path in modules) {
      const mod = modules[path] as any;
      
      // metadata: remark-mdx-frontmatter
      // frontmatter: common convention
      // attributes: some older setups
      const fm = mod.metadata || mod.frontmatter || mod.attributes || mod || {};
      
      const filename = path.split("/").pop()?.replace(".mdx", "");
      const title = fm.title || mod.title;

      if (filename && title) {
        const slug = filename.replace(/\./g, "/");

        articles.push({
          slug: slug,
          title: title,
          excerpt: fm.excerpt || mod.excerpt || "",
          date: fm.date || mod.date || new Date().toISOString(),
          category: fm.category || mod.category || "Educação Política",
          image: fm.image || mod.image,
          readTime: fm.readTime || mod.readTime || "5 min"
        });
      }
    }

    // Sort by date desc
    articles.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    if (limit) {
      return articles.slice(0, limit);
    }

    return articles;
  }
};
