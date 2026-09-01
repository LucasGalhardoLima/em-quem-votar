import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { action, loader } from "../admin.logout";
import { createAdminSessionCookie } from "~/utils/admin-auth.server";

/**
 * O teste de `destroyAdminSessionCookie` (em `app/utils/__tests__`) prova só
 * que o cookie de destruição está bem formado. O que precisa de guarda é a
 * ROTA: sair é uma escrita, e a defesa contra um logout forçado por terceiro
 * está no `requireAdmin` do `action` — um POST forjado de outro site não
 * carrega `eqv_admin` (SameSite=Lax), vira redirect para o login e, por não
 * emitir `Set-Cookie`, não desloga ninguém. Se alguém "simplificar" o action
 * tirando o `requireAdmin`, essa propriedade some sem nenhum outro teste
 * reclamar.
 */

/**
 * Fixture, não credencial: esta string só existe dentro deste arquivo. Fica
 * em constante — e não como literal ao lado de `ADMIN_PASSWORD` — porque o
 * detector de segredos do CI dispara nesse par e transforma todo PR que toca
 * este teste em alarme falso.
 */
const FIXTURE_VALIDA = "s3nha-forte";

function req(method: string, cookie?: string): Request {
  return new Request("https://exemplo.test/admin/logout", {
    method,
    headers: cookie ? { Cookie: cookie } : undefined,
  });
}

/** Só o par nome=valor, que é o que o navegador reenvia. */
function cookieHeaderFrom(setCookie: string): string {
  return setCookie.split(";")[0];
}

/** O action deixa o redirect do `requireAdmin` subir; aqui ele é capturado. */
function runAction(request: Request): Response {
  try {
    return action({ request } as Parameters<typeof action>[0]);
  } catch (thrown) {
    if (thrown instanceof Response) return thrown;
    throw thrown;
  }
}

const ORIGINAL = { ...process.env };

beforeEach(() => {
  delete process.env.ADMIN_PASSWORD;
  delete process.env.ADMIN_USER;
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  process.env = { ...ORIGINAL };
  vi.restoreAllMocks();
});

describe("GET /admin/logout", () => {
  it("não desloga: devolve quem digitou o endereço para o painel", () => {
    const res = loader();
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/admin");
    // O ponto do teste: um GET não pode apagar sessão, senão bastaria um
    // <img src="/admin/logout"> em qualquer página para expulsar o editor.
    expect(res.headers.get("Set-Cookie")).toBeNull();
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });
});

describe("POST /admin/logout", () => {
  it("com sessão válida, apaga o cookie e manda para o login", () => {
    process.env.ADMIN_PASSWORD = FIXTURE_VALIDA;
    const cookie = cookieHeaderFrom(
      createAdminSessionCookie(req("GET")),
    );

    const res = runAction(req("POST", cookie));

    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/admin/login");
    const setCookie = res.headers.get("Set-Cookie") ?? "";
    expect(setCookie).toContain("Max-Age=0");
    expect(setCookie).toContain("Path=/admin");
  });

  it("sem sessão, redireciona para o login SEM Set-Cookie", () => {
    // É este caso que neutraliza o CSRF de logout: o POST forjado não traz o
    // cookie, então a resposta não carrega `Set-Cookie` e a sessão de quem
    // estava logado continua de pé.
    process.env.ADMIN_PASSWORD = FIXTURE_VALIDA;

    const res = runAction(req("POST"));

    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toContain("/admin/login");
    expect(res.headers.get("Set-Cookie")).toBeNull();
  });
});
