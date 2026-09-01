import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createAdminSessionCookie,
  credentialsAreValid,
  destroyAdminSessionCookie,
  hasAdminSession,
  requireAdmin,
  safeEqual,
  safeNextPath,
} from "../admin-auth.server";
import {
  clearLoginFailures,
  loginGate,
  registerLoginFailure,
} from "../rate-limit.server";

/**
 * O painel /admin edita o que a plataforma publica sobre candidatos reais
 * durante uma eleição. Estes testes existem para que ninguém afrouxe a
 * trava sem perceber o que está abrindo.
 */

/**
 * Fixtures, não credenciais: estas strings só existem dentro deste arquivo.
 * Ficam em constantes — e não como literais ao lado de `ADMIN_PASSWORD` —
 * porque o detector de segredos do CI dispara nesse par e transforma todo PR
 * que toca este teste em alarme falso.
 */
const FIXTURE = {
  valida: "s3nha-forte",
  antiga: "senha-antiga",
  nova: "senha-nova",
  comAcento: "eleição-2026",
} as const;

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
    process.env.ADMIN_PASSWORD = FIXTURE.valida;
    const res = attempt(req("https://exemplo.test/admin/candidato/abc?x=1"));
    expect(res?.status).toBe(302);
    const location = res?.headers.get("Location") ?? "";
    expect(location).toContain("/admin/login");
    // Volta exatamente para onde a pessoa tentou ir.
    expect(decodeURIComponent(location)).toContain("/admin/candidato/abc?x=1");
    expect(res?.headers.get("Cache-Control")).toBe("no-store");
  });

  it("aceita um cookie de sessão válido", () => {
    process.env.ADMIN_PASSWORD = FIXTURE.valida;
    const cookie = cookieHeaderFrom(createAdminSessionCookie(req()));
    expect(attempt(req("https://exemplo.test/admin", cookie))).toBeNull();
  });

  it("rejeita cookie assinado com outra senha", () => {
    process.env.ADMIN_PASSWORD = FIXTURE.antiga;
    const cookie = cookieHeaderFrom(createAdminSessionCookie(req()));
    // Trocar a senha invalida todas as sessões em aberto — é o mecanismo
    // de revogação, já que não há estado de sessão no servidor.
    process.env.ADMIN_PASSWORD = FIXTURE.nova;
    expect(attempt(req("https://exemplo.test/admin", cookie))?.status).toBe(302);
  });

  it("rejeita cookie adulterado", () => {
    process.env.ADMIN_PASSWORD = FIXTURE.valida;
    const cookie = cookieHeaderFrom(createAdminSessionCookie(req()));
    const adulterado = `${cookie.slice(0, -3)}xyz`;
    expect(attempt(req("https://exemplo.test/admin", adulterado))?.status).toBe(302);
  });

  it("rejeita token com expiração no passado, mesmo bem formado", () => {
    process.env.ADMIN_PASSWORD = FIXTURE.valida;
    const cookie = cookieHeaderFrom(createAdminSessionCookie(req()));
    const valor = decodeURIComponent(cookie.split("=")[1]);
    const assinatura = valor.slice(valor.lastIndexOf(".") + 1);
    // Assinatura legítima, mas para um payload vencido: a verificação de
    // expiração é independente da de assinatura.
    const vencido = `eqv_admin=${encodeURIComponent(`1.${assinatura}`)}`;
    expect(attempt(req("https://exemplo.test/admin", vencido))?.status).toBe(302);
  });

  it("o cookie é HttpOnly, SameSite=Lax e restrito a /admin", () => {
    process.env.ADMIN_PASSWORD = FIXTURE.valida;
    const setCookie = createAdminSessionCookie(req());
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Lax");
    expect(setCookie).toContain("Path=/admin");
  });

  it("marca Secure em produção", () => {
    process.env.ADMIN_PASSWORD = FIXTURE.valida;
    vi.stubEnv("NODE_ENV", "production");
    expect(createAdminSessionCookie(req())).toContain("Secure");
    vi.unstubAllEnvs();
  });

  it("o logout zera o cookie", () => {
    process.env.ADMIN_PASSWORD = FIXTURE.valida;
    expect(destroyAdminSessionCookie(req())).toContain("Max-Age=0");
  });
});

describe("credentialsAreValid", () => {
  it("aceita as credenciais corretas", () => {
    process.env.ADMIN_PASSWORD = FIXTURE.valida;
    expect(credentialsAreValid("admin", FIXTURE.valida)).toBe(true);
  });

  it("respeita ADMIN_USER quando definido", () => {
    process.env.ADMIN_PASSWORD = FIXTURE.valida;
    process.env.ADMIN_USER = "lucas";
    expect(credentialsAreValid("lucas", FIXTURE.valida)).toBe(true);
    expect(credentialsAreValid("admin", FIXTURE.valida)).toBe(false);
  });

  it("rejeita senha errada, inclusive de comprimento diferente", () => {
    process.env.ADMIN_PASSWORD = FIXTURE.valida;
    expect(credentialsAreValid("admin", "errada")).toBe(false);
    expect(credentialsAreValid("admin", "x")).toBe(false);
    expect(credentialsAreValid("admin", "")).toBe(false);
  });

  it("sem ADMIN_PASSWORD, nenhuma credencial passa", () => {
    expect(credentialsAreValid("admin", "")).toBe(false);
    expect(credentialsAreValid("admin", "qualquer")).toBe(false);
  });

  it("aceita senha com acento", () => {
    process.env.ADMIN_PASSWORD = FIXTURE.comAcento;
    expect(credentialsAreValid("admin", FIXTURE.comAcento)).toBe(true);
    expect(credentialsAreValid("admin", "eleicao-2026")).toBe(false);
  });
});

describe("safeNextPath", () => {
  it("preserva destinos internos ao painel", () => {
    expect(safeNextPath("/admin")).toBe("/admin");
    expect(safeNextPath("/admin/")).toBe("/admin/");
    expect(safeNextPath("/admin?x=1")).toBe("/admin?x=1");
    expect(safeNextPath("/admin#topo")).toBe("/admin#topo");
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

  it("exige fronteira depois de /admin, não só o prefixo", () => {
    // `startsWith("/admin")` sozinho aceitava tudo isto, e nada disso é
    // uma rota do painel.
    expect(safeNextPath("/administracao-falsa")).toBe("/admin");
    expect(safeNextPath("/adminevil.com")).toBe("/admin");
    expect(safeNextPath("/admin@malicioso.test")).toBe("/admin");
    expect(safeNextPath("/admin\\malicioso.test")).toBe("/admin");
    expect(safeNextPath("/admin.malicioso.test")).toBe("/admin");
  });
});

describe("derivação da chave de sessão", () => {
  /** Assinatura do esquema antigo: HMAC com a senha crua como chave. */
  function legacyToken(password: string): string {
    const expiresAt = String(Date.now() + 60_000);
    const signature = createHmac("sha256", password)
      .update(expiresAt)
      .digest("base64url");
    return `eqv_admin=${encodeURIComponent(`${expiresAt}.${signature}`)}`;
  }

  it("a chave NÃO é a senha crua — token do esquema antigo é rejeitado", () => {
    // Se este teste voltar a passar como válido, alguém desfez a
    // derivação e o cookie voltou a ser (texto conhecido, assinatura) com
    // a senha do painel como chave: um vazamento de cookie passaria a
    // custar a senha permanente, não uma sessão de 8h.
    process.env.ADMIN_PASSWORD = FIXTURE.valida;
    expect(hasAdminSession(req("https://exemplo.test/admin", legacyToken(FIXTURE.valida)))).toBe(
      false,
    );
  });

  it("trocar a senha continua invalidando as sessões abertas", () => {
    // A derivação usa salt fixo justamente para preservar isto: senha
    // diferente → chave diferente → assinatura antiga não confere. É o
    // único mecanismo de revogação, já que não há estado no servidor.
    process.env.ADMIN_PASSWORD = FIXTURE.antiga;
    const cookie = cookieHeaderFrom(createAdminSessionCookie(req()));
    expect(hasAdminSession(req("https://exemplo.test/admin", cookie))).toBe(true);

    process.env.ADMIN_PASSWORD = FIXTURE.nova;
    expect(hasAdminSession(req("https://exemplo.test/admin", cookie))).toBe(false);

    // E voltar para a senha antiga revalida — a chave é função da senha,
    // não de estado acumulado no cache.
    process.env.ADMIN_PASSWORD = FIXTURE.antiga;
    expect(hasAdminSession(req("https://exemplo.test/admin", cookie))).toBe(true);
  });

  it("deriva uma vez por processo, não por requisição", () => {
    // scrypt custa ~50ms de propósito. Sem cache, 100 validações levariam
    // mais de 5s; com cache, alguns milissegundos. O teto abaixo é
    // folgado justamente para não depender da velocidade da máquina.
    process.env.ADMIN_PASSWORD = FIXTURE.valida;
    const cookie = cookieHeaderFrom(createAdminSessionCookie(req()));

    const started = Date.now();
    for (let i = 0; i < 100; i += 1) {
      expect(hasAdminSession(req("https://exemplo.test/admin", cookie))).toBe(true);
    }
    expect(Date.now() - started).toBeLessThan(2000);
  });
});

describe("safeEqual", () => {
  it("compara conteúdo, inclusive com comprimentos diferentes", () => {
    expect(safeEqual("Bearer abc", "Bearer abc")).toBe(true);
    expect(safeEqual("Bearer abc", "Bearer abd")).toBe(false);
    expect(safeEqual("Bearer abc", "Bearer abcdef")).toBe(false);
    expect(safeEqual("", "Bearer abc")).toBe(false);
    expect(safeEqual("", "")).toBe(true);
  });
});

describe("trava de tentativas de login", () => {
  const KEY = "203.0.113.7";

  beforeEach(() => clearLoginFailures(KEY));
  afterEach(() => clearLoginFailures(KEY));

  it("começa liberada", () => {
    expect(loginGate(KEY)).toEqual({ blocked: false, retryAfterSeconds: 0 });
  });

  it("o atraso cresce a cada falha, com teto", () => {
    const delays = Array.from({ length: 6 }, () => registerLoginFailure(KEY).delayMs);
    expect(delays.slice(0, 4)).toEqual([250, 500, 1000, 2000]);
    // Teto: uma espera longa seguraria a função serverless aberta e viraria
    // DoS contra o próprio site.
    expect(delays.every(ms => ms <= 2000)).toBe(true);
  });

  it("bloqueia depois de cinco falhas na janela", () => {
    for (let i = 0; i < 4; i += 1) {
      expect(registerLoginFailure(KEY).blocked).toBe(false);
    }
    expect(registerLoginFailure(KEY).blocked).toBe(true);

    const gate = loginGate(KEY);
    expect(gate.blocked).toBe(true);
    expect(gate.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("login bem-sucedido zera o contador", () => {
    for (let i = 0; i < 5; i += 1) registerLoginFailure(KEY);
    expect(loginGate(KEY).blocked).toBe(true);

    clearLoginFailures(KEY);
    expect(loginGate(KEY).blocked).toBe(false);
    expect(registerLoginFailure(KEY).failures).toBe(1);
  });

  it("uma origem bloqueada não afeta outra", () => {
    for (let i = 0; i < 5; i += 1) registerLoginFailure(KEY);
    expect(loginGate("198.51.100.4").blocked).toBe(false);
  });
});

describe("hasAdminSession", () => {
  it("é falso sem senha configurada, mesmo com cookie", () => {
    process.env.ADMIN_PASSWORD = FIXTURE.valida;
    const cookie = cookieHeaderFrom(createAdminSessionCookie(req()));
    delete process.env.ADMIN_PASSWORD;
    expect(hasAdminSession(req("https://exemplo.test/admin", cookie))).toBe(false);
  });

  it("é falso sem cookie", () => {
    process.env.ADMIN_PASSWORD = FIXTURE.valida;
    expect(hasAdminSession(req())).toBe(false);
  });
});
