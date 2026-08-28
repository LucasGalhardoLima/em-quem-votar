import { createHmac, scryptSync, timingSafeEqual } from "node:crypto";
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
 * (opcional, padrão "admin"). A chave que assina o cookie é DERIVADA da
 * senha com scrypt — nunca é a senha crua. Ver `sessionKey` abaixo.
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

/**
 * Comparação em tempo constante, tolerante a tamanhos diferentes.
 * Exportada porque o cron (`/api/cron/tse-status`) precisa exatamente
 * disto para conferir o bearer — comparar segredo com `===` sai cedo no
 * primeiro byte diferente e vaza o prefixo correto pelo tempo gasto.
 */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) {
    // Compara mesmo assim, para não vazar o comprimento pelo tempo gasto.
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

/**
 * DERIVAÇÃO DA CHAVE — por que a assinatura não usa a senha crua.
 *
 * O token é `<expiração>.<HMAC>` e a expiração viaja legível dentro do
 * cookie. Assinar isso com `ADMIN_PASSWORD` fazia do cookie um par
 * (texto conhecido, assinatura) cuja chave é a própria senha do painel,
 * sem KDF e sem salt. Quem visse o cookie uma única vez — log de proxy,
 * extensão de navegador, print de DevTools, máquina compartilhada —
 * deixava de levar uma sessão de 8h e passava a poder quebrar a senha
 * permanente offline, a ~600 mil tentativas por segundo num só núcleo
 * (medido nesta máquina). E com a senha em mãos dá para forjar cookies
 * com qualquer expiração, não só reusar o vazado.
 *
 * Agora a chave do HMAC é `scrypt(ADMIN_PASSWORD, salt fixo)`. Cada
 * tentativa offline passa a custar ~50ms e 32MB (N=2^15, r=8, p=1) em vez
 * de ~1.6µs: ~30 mil vezes mais cara por tentativa, e cara em *memória*,
 * que é justamente o que tira a vantagem de GPU e ASIC.
 *
 * POR QUE O SALT É FIXO. Um salt aleatório por token quebraria a promessa
 * registrada no CLAUDE.md de que trocar a senha revoga toda sessão aberta,
 * ou obrigaria a guardar estado no servidor. Salt fixo mantém a relação
 * senha → chave → assinatura: senha diferente, chave diferente, cookie
 * antigo deixa de conferir. O salt é público de propósito; ele não é o
 * que protege aqui. O que protege é o custo por tentativa. (Salt existe
 * para impedir que uma tabela pré-computada ataque muitos hashes de uma
 * vez; aqui só existe uma senha e nenhum banco de hashes.)
 *
 * POR QUE NÃO UM `ADMIN_SESSION_SECRET` SEPARADO. Seria igualmente
 * seguro, mas exige uma variável de ambiente nova em produção e um
 * mecanismo extra para preservar a revogação por troca de senha. scrypt
 * sobre a senha resolve os dois pontos sem configuração nova.
 *
 * CUSTO: scrypt é caro de propósito, então derivamos UMA vez por processo
 * e guardamos em cache. Sem o cache, toda requisição a /admin pagaria os
 * ~50ms. O cache é invalidado quando a senha muda (ver `sessionKey`), o
 * que é o que faz a revogação continuar valendo sem reiniciar nada.
 */
const KEY_SALT = "em-quem-votar/admin-session/v1";
const KEY_LENGTH = 32;
// maxmem precisa ser declarado: 128 * N * r = 32MB bate no teto padrão do Node.
const SCRYPT_PARAMS = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

let keyCache: { password: string; key: Buffer } | null = null;

function sessionKey(password: string): Buffer {
  if (keyCache && keyCache.password === password) return keyCache.key;
  const key = scryptSync(password, KEY_SALT, KEY_LENGTH, SCRYPT_PARAMS);
  keyCache = { password, key };
  return key;
}

function sign(payload: string, password: string): string {
  return createHmac("sha256", sessionKey(password))
    .update(payload)
    .digest("base64url");
}

/** Token = expiração + assinatura HMAC. Sem estado no servidor. */
function issueToken(password: string): string {
  const expiresAt = String(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);
  return `${expiresAt}.${sign(expiresAt, password)}`;
}

function tokenIsValid(token: string, password: string): boolean {
  const separator = token.lastIndexOf(".");
  if (separator <= 0) return false;

  const payload = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  if (!safeEqual(signature, sign(payload, password))) return false;

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

const ADMIN_PREFIX = "/admin";

/**
 * Só aceita destinos internos ao painel. Sem isso, `?next=` viraria um
 * open redirect: bastaria mandar ao editor um link de login que devolve
 * para um domínio hostil depois de autenticar.
 *
 * O prefixo tem que terminar em fronteira. `startsWith("/admin")` sozinho
 * aceitava `/administracao-falsa`, `/adminevil.com` e `/admin@outro.host`
 * — nenhum deles é uma rota do painel. (A checagem de `//` que existia
 * aqui era código morto: nada que começa com `//` começa com `/admin`.)
 */
export function safeNextPath(raw: string | null): string {
  if (!raw || !raw.startsWith(ADMIN_PREFIX)) return ADMIN_PREFIX;
  const boundary = raw.charAt(ADMIN_PREFIX.length);
  if (boundary !== "" && boundary !== "/" && boundary !== "?" && boundary !== "#") {
    return ADMIN_PREFIX;
  }
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
