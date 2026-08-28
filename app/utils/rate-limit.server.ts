/**
 * Limitação de taxa, em memória do processo.
 *
 * LIMITAÇÃO CONHECIDA — leia antes de confiar nisto. O estado vive num
 * `Map` deste processo. O site roda em serverless na Vercel: cada
 * instância tem o seu Map, instâncias sobem e descem sozinhas, e um cold
 * start zera os contadores. Ou seja, isto ENCARECE um ataque; não o
 * impede. Um atacante paciente que espere o reciclo das instâncias, ou
 * que caia em instâncias diferentes, recupera tentativas de graça.
 *
 * A trava de verdade exige estado compartilhado — uma tabela no Postgres
 * que já existe, ou um Redis. Isso mexeria no `prisma/schema.prisma`, que
 * está fora do escopo desta mudança; a recomendação está no relatório.
 *
 * shortcut: contadores por instância, sem persistência — upgrade: mover
 * `loginGate`/`registerLoginFailure` para uma tabela `LoginAttempt`
 * (chave, falhas, bloqueadoAté) no Postgres, ou para o Upstash Redis do
 * marketplace da Vercel, quando o painel tiver mais de um editor ou o
 * projeto sair do plano Hobby.
 */

type Counter = { count: number; expires: number };

// ─── Limite geral por IP (usado pelo loader do root) ────────────────────────

const cache = new Map<string, Counter>();

const LIMIT = 100; // requests
const WINDOW = 60 * 1000; // 1 minute in ms

export function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = cache.get(ip);

  if (!record || record.expires < now) {
    cache.set(ip, { count: 1, expires: now + WINDOW });
    return true;
  }

  if (record.count >= LIMIT) {
    return false;
  }

  record.count += 1;
  return true;
}

// ─── Cota nomeada, para rotas de recurso ────────────────────────────────────

/**
 * O loader do root NÃO cobre resource routes (as que não exportam
 * `default`): o React Router as despacha por `handleResourceRequest`, que
 * executa só o handler da folha. `/api/cron/tse-status`, `sitemap.xml` e
 * `resources/og/:id` nunca passam pelo `checkRateLimit` do root. Quem
 * precisa de limite tem que pedir aqui, explicitamente.
 */
const quotas = new Map<string, Counter>();

export function checkQuota(
  bucket: string,
  key: string,
  limit: number,
  windowMs: number,
): boolean {
  const now = Date.now();
  const id = `${bucket}:${key}`;
  const record = quotas.get(id);

  if (!record || record.expires < now) {
    prune(quotas, now);
    quotas.set(id, { count: 1, expires: now + windowMs });
    return true;
  }

  if (record.count >= limit) return false;

  record.count += 1;
  return true;
}

// ─── Trava de tentativas de login ───────────────────────────────────────────

/**
 * Uma senha única, sem segundo fator, protege tudo que a plataforma
 * publica sobre candidaturas reais. Sem contador, a única defesa era o
 * comprimento da senha.
 *
 * Duas camadas, de propósito:
 *  - atraso progressivo a partir da PRIMEIRA falha, que derruba a taxa de
 *    tentativas mesmo antes de qualquer bloqueio;
 *  - bloqueio temporário depois de `MAX_FAILURES` falhas na janela.
 *
 * A chave é o IP, não o usuário. Bloquear por usuário aqui seria um
 * ataque de negação de serviço trivial: só existe uma conta, então
 * qualquer estranho conseguiria trancar o editor para fora mandando
 * senhas erradas. O IP vem do `x-forwarded-for` reescrito pela borda da
 * Vercel; num deploy que não esteja atrás desse proxy o header é
 * forjável, e aí a trava vira só o atraso progressivo.
 */
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILURES = 5;
const LOGIN_BLOCK_MS = 15 * 60 * 1000;
const LOGIN_DELAY_BASE_MS = 250;
const LOGIN_DELAY_CAP_MS = 2000; // segurar a função por mais tempo custa dinheiro e vira DoS
const MAX_TRACKED_KEYS = 10_000;

type Attempt = { failures: number; expires: number; blockedUntil: number };

const loginAttempts = new Map<string, Attempt>();

export type LoginGate = { blocked: boolean; retryAfterSeconds: number };

/** Estado atual da trava para esta origem. Não conta tentativa. */
export function loginGate(key: string): LoginGate {
  const now = Date.now();
  const record = loginAttempts.get(key);
  if (!record || record.blockedUntil <= now) {
    return { blocked: false, retryAfterSeconds: 0 };
  }
  return {
    blocked: true,
    retryAfterSeconds: Math.ceil((record.blockedUntil - now) / 1000),
  };
}

export type LoginFailure = LoginGate & { failures: number; delayMs: number };

/** Registra uma falha e devolve quanto esperar antes de responder. */
export function registerLoginFailure(key: string): LoginFailure {
  const now = Date.now();
  if (loginAttempts.size >= MAX_TRACKED_KEYS) prune(loginAttempts, now);

  const previous = loginAttempts.get(key);
  const carryOver =
    previous && previous.expires > now ? previous.failures : 0;
  const failures = carryOver + 1;

  const blockedUntil =
    failures >= LOGIN_MAX_FAILURES ? now + LOGIN_BLOCK_MS : 0;

  loginAttempts.set(key, {
    failures,
    expires: Math.max(now + LOGIN_WINDOW_MS, blockedUntil),
    blockedUntil,
  });

  return {
    failures,
    delayMs: Math.min(
      LOGIN_DELAY_BASE_MS * 2 ** (failures - 1),
      LOGIN_DELAY_CAP_MS,
    ),
    blocked: blockedUntil > now,
    retryAfterSeconds: blockedUntil ? Math.ceil(LOGIN_BLOCK_MS / 1000) : 0,
  };
}

/** Login bem-sucedido zera o contador desta origem. */
export function clearLoginFailures(key: string): void {
  loginAttempts.delete(key);
}

// ─── Manutenção ─────────────────────────────────────────────────────────────

function prune(map: Map<string, { expires: number }>, now: number): void {
  for (const [key, record] of map) {
    if (record.expires < now) map.delete(key);
  }
}

// Limpeza periódica. `unref` para o timer não segurar o processo aberto —
// sem isso o `vitest` e qualquer script CLI ficam pendurados 5 minutos.
if (typeof setInterval !== "undefined") {
  const timer = setInterval(() => {
    const now = Date.now();
    prune(cache, now);
    prune(quotas, now);
    prune(loginAttempts, now);
  }, 5 * 60 * 1000);
  timer.unref?.();
}
