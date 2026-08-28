import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { checkQuota, checkRateLimit } from "../rate-limit.server";

/**
 * A trava de login (`loginGate`/`registerLoginFailure`/`clearLoginFailures`)
 * já é coberta em `app/utils/__tests__/admin-auth.server.test.ts`, junto do
 * que ela protege. Aqui ficam só os dois contadores que ninguém mais testa:
 * o limite geral por IP do loader do root e a cota nomeada das resource
 * routes.
 *
 * TEMPO É FALSO DE PROPÓSITO. As janelas são de 1 minuto; esperar de verdade
 * transformaria a suíte num teste de paciência. `vi.useFakeTimers()` também
 * substitui `Date.now()`, que é o relógio que o módulo lê.
 *
 * CHAVES ÚNICAS POR TESTE. O estado vive num `Map` de módulo, sem função de
 * reset exportada — é a limitação declarada no cabeçalho do próprio módulo.
 * Cada teste usa a sua chave para não herdar contagem do teste anterior.
 */

// Espelham as constantes privadas do módulo. Se alguém mexer nelas lá, estes
// testes falham — e é essa a intenção: o limite é contrato, não detalhe.
const LIMIT = 100;
const WINDOW = 60 * 1000;

let counter = 0;
/** Uma chave nova a cada chamada, para isolar os testes entre si. */
function novaChave(prefixo: string): string {
  counter += 1;
  return `${prefixo}-${counter}`;
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("checkRateLimit", () => {
  it("libera exatamente LIMIT requisições e recusa a seguinte", () => {
    const ip = novaChave("198.51.100");

    for (let i = 1; i <= LIMIT; i += 1) {
      expect(checkRateLimit(ip)).toBe(true);
    }
    // A recusa começa na 101ª: a 100ª ainda passa.
    expect(checkRateLimit(ip)).toBe(false);
    expect(checkRateLimit(ip)).toBe(false);
  });

  it("a janela zera o contador quando vence", () => {
    const ip = novaChave("198.51.100");

    for (let i = 1; i <= LIMIT; i += 1) checkRateLimit(ip);
    expect(checkRateLimit(ip)).toBe(false);

    // `expires < now`: em cima do vencimento o registro ainda vale.
    vi.advanceTimersByTime(WINDOW);
    expect(checkRateLimit(ip)).toBe(false);

    // Um milissegundo depois ele venceu e a contagem recomeça do zero.
    vi.advanceTimersByTime(1);
    expect(checkRateLimit(ip)).toBe(true);
  });

  it("a janela é fixa, não deslizante: pedidos dentro dela não a estendem", () => {
    const ip = novaChave("198.51.100");

    expect(checkRateLimit(ip)).toBe(true);
    vi.advanceTimersByTime(WINDOW - 1);
    expect(checkRateLimit(ip)).toBe(true); // ainda a mesma janela

    // Se a janela fosse deslizante, este pedido cairia dentro da janela
    // renovada pelo anterior. Como o `expires` é gravado uma vez só, aqui
    // já é uma janela nova — e a contagem antiga foi descartada.
    vi.advanceTimersByTime(2);
    for (let i = 1; i <= LIMIT; i += 1) {
      expect(checkRateLimit(ip)).toBe(true);
    }
    expect(checkRateLimit(ip)).toBe(false);
  });

  it("um IP no limite não afeta outro IP", () => {
    // O limite é por origem. Se os contadores se misturassem, um robô
    // derrubaria o site inteiro para todo mundo.
    const saturado = novaChave("198.51.100");
    const inocente = novaChave("203.0.113");

    for (let i = 1; i <= LIMIT; i += 1) checkRateLimit(saturado);
    expect(checkRateLimit(saturado)).toBe(false);
    expect(checkRateLimit(inocente)).toBe(true);
  });
});

describe("checkQuota", () => {
  it("libera exatamente `limit` chamadas por janela", () => {
    const key = novaChave("chave");

    expect(checkQuota("og", key, 3, 1000)).toBe(true);
    expect(checkQuota("og", key, 3, 1000)).toBe(true);
    expect(checkQuota("og", key, 3, 1000)).toBe(true);
    expect(checkQuota("og", key, 3, 1000)).toBe(false);
  });

  it("a janela vencida libera de novo, com contagem reiniciada", () => {
    const key = novaChave("chave");

    expect(checkQuota("og", key, 2, 1000)).toBe(true);
    expect(checkQuota("og", key, 2, 1000)).toBe(true);
    expect(checkQuota("og", key, 2, 1000)).toBe(false);

    vi.advanceTimersByTime(1000);
    expect(checkQuota("og", key, 2, 1000)).toBe(false); // ainda não venceu

    vi.advanceTimersByTime(1);
    expect(checkQuota("og", key, 2, 1000)).toBe(true); // janela nova
    expect(checkQuota("og", key, 2, 1000)).toBe(true);
    expect(checkQuota("og", key, 2, 1000)).toBe(false);
  });

  it("a mesma chave em buckets diferentes tem contadores separados", () => {
    // O id interno é `bucket:key`. Sem o prefixo, um IP que esgotasse a cota
    // do sitemap ficaria sem OG image também.
    const key = novaChave("chave");

    expect(checkQuota("sitemap", key, 1, 1000)).toBe(true);
    expect(checkQuota("sitemap", key, 1, 1000)).toBe(false);
    expect(checkQuota("og", key, 1, 1000)).toBe(true);
  });

  it("chaves diferentes no mesmo bucket não se contaminam", () => {
    const bucket = novaChave("bucket");

    expect(checkQuota(bucket, "a", 1, 1000)).toBe(true);
    expect(checkQuota(bucket, "a", 1, 1000)).toBe(false);
    expect(checkQuota(bucket, "b", 1, 1000)).toBe(true);
  });

  it("a limpeza remove só os registros vencidos, não os vivos", () => {
    // `checkQuota` varre o mapa inteiro (`prune`) sempre que abre uma janela
    // nova. A varredura em si não é observável de fora — o que dá para
    // observar, e é o que importa, é que ela não leva junto quem ainda está
    // dentro da janela.
    const vencendo = novaChave("curta");
    const vivo = novaChave("longa");

    expect(checkQuota("og", vivo, 1, WINDOW)).toBe(true);
    expect(checkQuota("og", vencendo, 1, 1000)).toBe(true);

    // Passa da janela curta, mas não da longa. Esta chamada dispara o prune.
    vi.advanceTimersByTime(1001);
    expect(checkQuota("og", vencendo, 1, 1000)).toBe(true);

    // O registro vivo sobreviveu à varredura: continua contando.
    expect(checkQuota("og", vivo, 1, WINDOW)).toBe(false);
  });
});
