import {
  Form,
  redirect,
  useNavigation,
  useSearchParams,
} from "react-router";
import { Loader2 } from "lucide-react";
import type { Route } from "./+types/admin.login";
import { Container, MAIN_CONTENT_ID } from "~/components/layout";
import { BTN_PRIMARY, INPUT } from "~/components/admin/styles";
import { cn } from "~/lib/utils";
import {
  adminPasswordConfigured,
  createAdminSessionCookie,
  credentialsAreValid,
  hasAdminSession,
  safeNextPath,
} from "~/utils/admin-auth.server";
import {
  clearLoginFailures,
  loginGate,
  registerLoginFailure,
} from "~/utils/rate-limit.server";

export function meta() {
  return [
    { title: "Entrar · Admin | Em Quem Votar?" },
    { name: "robots", content: "noindex,nofollow" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const next = safeNextPath(url.searchParams.get("next"));

  // Já autenticado: não faz sentido mostrar o formulário de novo.
  if (hasAdminSession(request)) throw redirect(next);

  return { configured: adminPasswordConfigured() };
}

/**
 * Origem do pedido, para a trava de tentativas.
 *
 * Atrás da borda da Vercel o primeiro item de `x-forwarded-for` é o IP
 * real do cliente e não é forjável pelo navegador. Fora desse proxy o
 * header é livre, e aí a trava por chave vale pouco — o atraso
 * progressivo continua valendo, porque ele é aplicado por tentativa.
 */
function originKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const real = request.headers.get("x-real-ip")?.trim();
  return forwarded || real || "local";
}

const sleep = (ms: number) =>
  ms > 0 ? new Promise(resolve => setTimeout(resolve, ms)) : Promise.resolve();

/** Nunca deixe entrada do usuário entrar crua no log: quebra de linha lá vira log forjado. */
const forLog = (value: string) => JSON.stringify(value.slice(0, 64));

export async function action({ request }: Route.ActionArgs) {
  const key = originKey(request);

  // A trava é conferida ANTES de ler o corpo: bloqueado não paga parsing.
  const gate = loginGate(key);
  if (gate.blocked) {
    console.warn(
      `[admin] login bloqueado para ${key} — libera em ${gate.retryAfterSeconds}s.`,
    );
    return { error: blockedMessage(gate.retryAfterSeconds) };
  }

  const formData = await request.formData();
  const user = String(formData.get("user") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = safeNextPath(String(formData.get("next") ?? ""));

  if (!credentialsAreValid(user, password)) {
    const failure = registerLoginFailure(key);
    // Falha de login precisa aparecer no log: sem isso, uma tentativa de
    // força bruta contra o painel passa inteira sem deixar rastro.
    console.warn(
      `[admin] login falhou (tentativa ${failure.failures}) — origem ${key}, ` +
        `usuário ${forLog(user)}.`,
    );
    // Atraso progressivo: derruba a taxa de tentativas mesmo dentro da
    // janela, antes do bloqueio. Teto baixo porque cada espera segura uma
    // invocação serverless aberta — atraso longo seria DoS contra o site.
    await sleep(failure.delayMs);

    // Mensagem única de propósito: dizer qual campo errou entrega ao
    // atacante a informação de que o usuário existe.
    return {
      error: failure.blocked
        ? blockedMessage(failure.retryAfterSeconds)
        : "Usuário ou senha incorretos.",
    };
  }

  clearLoginFailures(key);

  throw redirect(next, {
    headers: {
      "Set-Cookie": createAdminSessionCookie(request),
      "Cache-Control": "no-store",
    },
  });
}

function blockedMessage(retryAfterSeconds: number): string {
  const minutos = Math.max(1, Math.ceil(retryAfterSeconds / 60));
  return `Muitas tentativas seguidas. Tente de novo em ${minutos} min.`;
}

export default function AdminLogin({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const [searchParams] = useSearchParams();
  const next = safeNextPathClient(searchParams.get("next"));

  // `formData` e não `state === "submitting"`: ele continua preenchido
  // durante o `loading` que vem depois do POST bem-sucedido, então o botão
  // fica travado até o redirecionamento terminar. Com `submitting` sozinho
  // haveria uma janela em que o botão volta a aceitar clique e dispara um
  // segundo POST de login.
  const navigation = useNavigation();
  const submitting = navigation.formData != null;

  return (
    <main id={MAIN_CONTENT_ID} className="flex flex-1 items-center justify-center">
      <Container className="max-w-[420px] py-16">
        <h1 className="font-heading text-3xl font-bold tracking-[-0.02em] text-slate-800">
          Painel editorial
        </h1>
        <p className="mt-1.5 text-sm text-slate-500">
          Acesso restrito a quem cura as posições e as candidaturas.
        </p>

        {!loaderData.configured ? (
          <p className="mt-6 rounded-2xl border border-amber-200/80 bg-amber-50 px-5 py-4 text-sm leading-relaxed text-amber-800">
            <strong className="font-semibold">ADMIN_PASSWORD não está definida.</strong>{" "}
            Em produção o painel responde 503 até que ela seja configurada no
            servidor. Veja <code className="font-mono">.env.example</code>.
          </p>
        ) : (
          <Form
            method="post"
            className="mt-6 grid gap-3 rounded-2xl border border-slate-200 bg-white p-6"
          >
            <input type="hidden" name="next" value={next} />

            <label className="grid gap-1.5">
              <span className="text-xs font-semibold text-slate-600">
                Usuário
              </span>
              <input
                name="user"
                autoComplete="username"
                defaultValue="admin"
                required
                className={cn(INPUT, "px-4 py-3")}
              />
            </label>

            <label className="grid gap-1.5">
              <span className="text-xs font-semibold text-slate-600">
                Senha
              </span>
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
                autoFocus
                className={cn(INPUT, "px-4 py-3")}
              />
            </label>

            {actionData?.error && (
              <p
                role="alert"
                className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs text-rose-800"
              >
                {actionData.error}
              </p>
            )}

            {/* O envio precisa aparecer no botão: sem isso um clique duplo
                manda dois POST de login, e cada um deles conta como uma
                tentativa na trava de força bruta — o usuário legítimo se
                bloqueia sozinho na metade do tempo. */}
            <button
              type="submit"
              disabled={submitting}
              aria-busy={submitting}
              className={cn(BTN_PRIMARY, "mt-1")}
            >
              {submitting && (
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              )}
              {submitting ? "Entrando…" : "Entrar"}
            </button>
          </Form>
        )}

        <p className="mt-4 text-xs leading-relaxed text-slate-500">
          A sessão dura 8 horas e vale só para /admin. Nada do que você faz
          aqui aparece para o público antes de ser aprovado.
        </p>
      </Container>
    </main>
  );
}

/**
 * Espelha `safeNextPath` no cliente — o servidor continua sendo a
 * autoridade, mas o valor vai num input hidden e não faz sentido mandar
 * lixo de volta. Precisa ficar duplicado porque a versão canônica mora
 * num módulo `.server.ts`, que não pode ser importado daqui.
 */
function safeNextPathClient(raw: string | null): string {
  if (!raw || !raw.startsWith("/admin")) return "/admin";
  const boundary = raw.charAt("/admin".length);
  const isBoundary =
    boundary === "" || boundary === "/" || boundary === "?" || boundary === "#";
  return isBoundary ? raw : "/admin";
}
