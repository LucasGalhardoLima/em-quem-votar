import mdx from "@mdx-js/rollup";
import remarkFrontmatter from "remark-frontmatter";
import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [mdx({ remarkPlugins: [remarkFrontmatter] }), tailwindcss(), reactRouter(), tsconfigPaths()],
});
