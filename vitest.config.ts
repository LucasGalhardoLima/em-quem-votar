import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./app/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      // Todo módulo que tem (ou pode ter) teste precisa entrar na conta. Um
      // relatório que reporta 0% para um módulo bem coberto mente sobre o que
      // está testado — pior que não ter relatório.
      include: [
        'app/lib/**/*.ts',
        'app/services/**/*.ts',
        'app/data/**/*.ts',
        'app/utils/**/*.ts',
        // .ts E .tsx: rotas de recurso (api.cron.tse-status, sitemap.xml) não
        // têm JSX, e o padrão só com .tsx as deixava invisíveis mesmo testadas.
        'app/routes/**/*.{ts,tsx}'
      ],
      // `app/routes.ts` (config de rotas) e `.react-router/` (tipos gerados)
      // ficam de fora por construção: nenhum include acima os alcança.
      exclude: [
        'app/test/**',
        '**/__tests__/**',
        '**/*.test.{ts,tsx}',
        '**/*.spec.{ts,tsx}',
        '**/*.d.ts'
      ]
    }
  }
});
