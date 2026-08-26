import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createAdminSessionCookie,
  credentialsAreValid,
  destroyAdminSessionCookie,
  hasAdminSession,
  requireAdmin,
  safeNextPath,
} from "../admin-auth.server";

/**
 * O painel /admin edita o que a plataforma publica sobre candidatos reais
 * durante uma eleição. Estes testes existem para que ninguém afrouxe a
 * trava sem perceber o que está abrindo.
 */

function req(url = "https://exemplo.test/admin", cookie?: string): Request {
  return new Request(url, {
    headers: cookie ? { Cookie: cookie } : undefined,
  });
}

/** Extrai o valor do cookie de um header Set-Cookie. */
function cookieHeaderFrom(setCookie: string): string {
  return setCookie.split(";")[0];
}

/** Captura o que requireAdmin lançou, ou null se permitiu o acesso. */
function attempt(request: Request): Response | null {
  try {
    requireAdmin(request);
    return null;
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

describe("requireAdmin", () => {
  it("sem ADMIN_PASSWORD fora de produção, libera e avisa no log", () => {
    expect(attempt(req())).toBeNull();
    expect(console.warn).toHaveBeenCalled();
  });

  it("sem ADMIN_PASSWORD em produção, falha fechado com 503", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(attempt(req())?.status).toBe(503);
    vi.unstubAllEnvs();
  });

  it("com senha configurada e sem sessão, redireciona para o login", () => {
    process.env.ADMIN_PASSWORD = "s3nha-forte";
    const res = attempt(req("https://exemplo.test/admin/candidato/abc?x=1"));
    expect(res?.status).toBe(302);
    const location = res?.headers.get("Location") ?? "";
    expect(location).toContain("/admin/login");
    // Volta exatamente para onde a pessoa tentou ir.
    expect(decodeURIComponent(location)).toContain("/admin/candidato/abc?x=1");
    expect(res?.headers.get("Cache-Control")).toBe("no-store");
  });

  it("aceita um cookie de sessão válido", () => {
    process.env.ADMIN_PASSWORD = "s3nha-forte";
    const cookie = cookieHeaderFrom(createAdminSessionCookie(req()));
    expect(attempt(req("https://exemplo.test/admin", cookie))).toBeNull();
  });

  it("rejeita cookie assinado com outra senha", () => {
    process.env.ADMIN_PASSWORD = "senha-antiga";
    const cookie = cookieHeaderFrom(createAdminSessionCookie(req()));
    // Trocar a senha invalida todas as sessões em aberto — é o mecanismo
    // de revogação, já que não há estado de sessão no servidor.
    process.env.ADMIN_PASSWORD = "senha-nova";
    expect(attempt(req("https://exemplo.test/admin", cookie))?.status).toBe(302);
  });

  it("rejeita cookie adulterado", () => {
    process.env.ADMIN_PASSWORD = "s3nha-forte";
    const cookie = cookieHeaderFrom(createAdminSessionCookie(req()));
    const adulterado = `${cookie.slice(0, -3)}xyz`;
    expect(attempt(req("https://exemplo.test/admin", adulterado))?.status).toBe(302);
  });

  it("rejeita token com expiração no passado, mesmo bem formado", () => {
    process.env.ADMIN_PASSWORD = "s3nha-forte";
    const cookie = cookieHeaderFrom(createAdminSessionCookie(req()));
    const valor = decodeURIComponent(cookie.split("=")[1]);
    const assinatura = valor.slice(valor.lastIndexOf(".") + 1);
    // Assinatura legítima, mas para um payload vencido: a verificação de
    // expiração é independente da de assinatura.
    const vencido = `eqv_admin=${encodeURIComponent(`1.${assinatura}`)}`;
    expect(attempt(req("https://exemplo.test/admin", vencido))?.status).toBe(302);
  });

  it("o cookie é HttpOnly, SameSite=Lax e restrito a /admin", () => {
    process.env.ADMIN_PASSWORD = "s3nha-forte";
    const setCookie = createAdminSessionCookie(req());
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Lax");
    expect(setCookie).toContain("Path=/admin");
  });

  it("marca Secure em produção", () => {
    process.env.ADMIN_PASSWORD = "s3nha-forte";
    vi.stubEnv("NODE_ENV", "production");
    expect(createAdminSessionCookie(req())).toContain("Secure");
    vi.unstubAllEnvs();
  });

  it("o logout zera o cookie", () => {
    process.env.ADMIN_PASSWORD = "s3nha-forte";
    expect(destroyAdminSessionCookie(req())).toContain("Max-Age=0");
  });
});

describe("credentialsAreValid", () => {
  it("aceita as credenciais corretas", () => {
    process.env.ADMIN_PASSWORD = "s3nha-forte";
    expect(credentialsAreValid("admin", "s3nha-forte")).toBe(true);
  });

  it("respeita ADMIN_USER quando definido", () => {
    process.env.ADMIN_PASSWORD = "s3nha-forte";
    process.env.ADMIN_USER = "lucas";
    expect(credentialsAreValid("lucas", "s3nha-forte")).toBe(true);
    expect(credentialsAreValid("admin", "s3nha-forte")).toBe(false);
  });

  it("rejeita senha errada, inclusive de comprimento diferente", () => {
    process.env.ADMIN_PASSWORD = "s3nha-forte";
    expect(credentialsAreValid("admin", "errada")).toBe(false);
    expect(credentialsAreValid("admin", "x")).toBe(false);
    expect(credentialsAreValid("admin", "")).toBe(false);
  });

  it("sem ADMIN_PASSWORD, nenhuma credencial passa", () => {
    expect(credentialsAreValid("admin", "")).toBe(false);
    expect(credentialsAreValid("admin", "qualquer")).toBe(false);
  });

  it("aceita senha com acento", () => {
    process.env.ADMIN_PASSWORD = "eleição-2026";
    expect(credentialsAreValid("admin", "eleição-2026")).toBe(true);
    expect(credentialsAreValid("admin", "eleicao-2026")).toBe(false);
  });
});

describe("safeNextPath", () => {
  it("preserva destinos internos ao painel", () => {
    expect(safeNextPath("/admin")).toBe("/admin");
    expect(safeNextPath("/admin/candidato/abc?x=1")).toBe("/admin/candidato/abc?x=1");
  });

  it("bloqueia open redirect", () => {
    // Sem isto, bastaria mandar ao editor um link de login que o devolve
    // para um domínio hostil depois de autenticar.
    expect(safeNextPath("https://malicioso.test")).toBe("/admin");
    expect(safeNextPath("//malicioso.test")).toBe("/admin");
    expect(safeNextPath("/candidatos")).toBe("/admin");
    expect(safeNextPath(null)).toBe("/admin");
  });
});

describe("hasAdminSession", () => {
  it("é falso sem senha configurada, mesmo com cookie", () => {
    process.env.ADMIN_PASSWORD = "s3nha-forte";
    const cookie = cookieHeaderFrom(createAdminSessionCookie(req()));
    delete process.env.ADMIN_PASSWORD;
    expect(hasAdminSession(req("https://exemplo.test/admin", cookie))).toBe(false);
  });

  it("é falso sem cookie", () => {
    process.env.ADMIN_PASSWORD = "s3nha-forte";
    expect(hasAdminSession(req())).toBe(false);
  });
});
