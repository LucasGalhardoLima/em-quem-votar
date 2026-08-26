import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

/**
 * O acesso ao banco é sempre mockado nos testes — nenhuma suíte deve abrir
 * conexão. Os módulos de domínio puro (app/lib/*) não tocam neste mock; ele
 * existe para quando um teste importar, direta ou indiretamente, um
 * `*.server.ts`.
 *
 * O mock é gerado por Proxy para não precisar ser atualizado a cada modelo
 * novo do schema: qualquer `db.<modelo>.<metodo>()` devolve um vi.fn().
 */
vi.mock("~/utils/db.server", () => {
  const method = () => vi.fn();
  const model = new Proxy(
    {},
    {
      get: (target: Record<string, unknown>, prop: string) => {
        if (!(prop in target)) target[prop] = method();
        return target[prop];
      },
    },
  );

  const db = new Proxy(
    {},
    {
      get: (target: Record<string, unknown>, prop: string) => {
        if (prop === "then") return undefined; // não é thenable
        if (!(prop in target)) target[prop] = model;
        return target[prop];
      },
    },
  );

  return { db };
});
