import { createHmac, timingSafeEqual } from "node:crypto";
import { redirect } from "react-router";

/**
 * Proteção das rotas /admin.
 *
 * O painel aprova posições e edita o que a plataforma publica sobre
 * candidatos reais durante uma eleição. Sem trava, qualquer pessoa com o
 * endereço poderia alterar o conteúdo — problema de segurança e de
 * integridade editorial ao mesmo tempo.
 *
 * POR QUE NÃO HTTP BASIC: o React Router descarta os headers de uma
 * `Response` lançada de dentro de um loader (só status e corpo sobrevivem
 * até o ErrorBoundary). Sem `WWW-Authenticate` chegando ao navegador, o
 * prompt nativo nunca aparece e nem o próprio editor consegue entrar. Por
 * isso a sessão é um cookie assinado, com uma tela de login de verdade.
 *
 * Configuração: ADMIN_PASSWORD (obrigatória em produção) e ADMIN_USER
 * (opcional, padrão "admin").
 */

const COOKIE_NAME = "eqv_admin";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8; // 8 horas

export const LOGIN_PATH = "/admin/login";

function misconfigured(): never {
  throw new Response(
    "Painel indisponível: ADMIN_PASSWORD não configurada no servidor.",
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}

/** Comparação em tempo constante, tolerante a tamanhos diferentes. */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) {
    // Compara mesmo assim, para não vazar o comprimento pelo tempo gasto.
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

/** Token = expiração + assinatura HMAC. Sem estado no servidor. */
function issueToken(secret: string): string {
  const expiresAt = String(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);
  return `${expiresAt}.${sign(expiresAt, secret)}`;
}

function tokenIsValid(token: string, secret: string): boolean {
  const separator = token.lastIndexOf(".");
  if (separator <= 0) return false;

  const payload = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  if (!safeEqual(signature, sign(payload, secret))) return false;

  const expiresAt = Number(payload);
  return Number.isFinite(expiresAt) && expiresAt > Date.now();
}

function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("Cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) {
      return decodeURIComponent(part.slice(eq + 1).trim());
    }
  }
  return null;
}

function buildCookie(value: string, maxAge: number, secure: boolean): string {
  return [
    `${COOKIE_NAME}=${encodeURIComponent(value)}`,
    "Path=/admin",
    "HttpOnly",
    "SameSite=Lax",
    secure ? "Secure" : null,
    `Max-Age=${maxAge}`,
  ]
    .filter(Boolean)
    .join("; ");
}

function isSecureRequest(request: Request): boolean {
  if (process.env.NODE_ENV === "production") return true;
  return new URL(request.url).protocol === "https:";
}

/**
 * Só aceita destinos internos ao painel. Sem isso, `?next=` viraria um
 * open redirect: bastaria mandar ao editor um link de login que devolve
 * para um domínio hostil depois de autenticar.
 */
export function safeNextPath(raw: string | null): string {
  if (!raw) return "/admin";
  if (!raw.startsWith("/admin")) return "/admin";
  if (raw.startsWith("//")) return "/admin";
  return raw;
}

export function adminPasswordConfigured(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD);
}

/** Verdadeiro quando o pedido traz uma sessão válida. Não lança. */
export function hasAdminSession(request: Request): boolean {
  const secret = process.env.ADMIN_PASSWORD;
  if (!secret) return false;
  const token = readCookie(request, COOKIE_NAME);
  return token ? tokenIsValid(token, secret) : false;
}

/**
 * Chamar no início de TODO loader e action sob /admin.
 * Redireciona para o login quando não há sessão — nunca retorna nesse caso.
 */
export function requireAdmin(request: Request): void {
  if (!adminPasswordConfigured()) {
    // Em produção, falha fechado: sem senha, sem painel.
    if (process.env.NODE_ENV === "production") misconfigured();
    console.warn(
      "[admin] ADMIN_PASSWORD não definida — painel liberado apenas porque isto não é produção.",
    );
    return;
  }

  if (hasAdminSession(request)) return;

  const url = new URL(request.url);
  const next = `${url.pathname}${url.search}`;
  throw redirect(
    `${LOGIN_PATH}?next=${encodeURIComponent(next)}`,
    { headers: { "Cache-Control": "no-store" } },
  );
}

/** Valida as credenciais do formulário. */
export function credentialsAreValid(user: string, password: string): boolean {
  const expectedPassword = process.env.ADMIN_PASSWORD;
  if (!expectedPassword) return false;
  const expectedUser = process.env.ADMIN_USER || "admin";
  // As duas comparações sempre rodam: sair cedo no usuário errado
  // revelaria, pelo tempo, qual das partes falhou.
  const userOk = safeEqual(user, expectedUser);
  const passwordOk = safeEqual(password, expectedPassword);
  return userOk && passwordOk;
}

export function createAdminSessionCookie(request: Request): string {
  const secret = process.env.ADMIN_PASSWORD;
  if (!secret) misconfigured();
  return buildCookie(
    issueToken(secret),
    SESSION_MAX_AGE_SECONDS,
    isSecureRequest(request),
  );
}

export function destroyAdminSessionCookie(request: Request): string {
  return buildCookie("", 0, isSecureRequest(request));
}
