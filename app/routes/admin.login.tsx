import { Form, redirect, useSearchParams } from "react-router";
import type { Route } from "./+types/admin.login";
import { Container } from "~/components/layout";
import {
  adminPasswordConfigured,
  createAdminSessionCookie,
  credentialsAreValid,
  hasAdminSession,
  safeNextPath,
} from "~/utils/admin-auth.server";

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

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const user = String(formData.get("user") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = safeNextPath(String(formData.get("next") ?? ""));

  if (!credentialsAreValid(user, password)) {
    // Mensagem única de propósito: dizer qual campo errou entrega ao
    // atacante a informação de que o usuário existe.
    return { error: "Usuário ou senha incorretos." };
  }

  throw redirect(next, {
    headers: {
      "Set-Cookie": createAdminSessionCookie(request),
      "Cache-Control": "no-store",
    },
  });
}

export default function AdminLogin({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const [searchParams] = useSearchParams();
  const next = safeNextPathClient(searchParams.get("next"));

  return (
    <main className="flex flex-1 items-center justify-center">
      <Container className="max-w-[420px] py-16">
        <h1 className="font-heading text-[26px] font-bold tracking-[-0.02em] text-slate-800">
          Painel editorial
        </h1>
        <p className="mt-1.5 text-[13.5px] text-slate-500">
          Acesso restrito a quem cura as posições e as candidaturas.
        </p>

        {!loaderData.configured ? (
          <p className="mt-6 rounded-2xl border border-amber-200/80 bg-amber-50 px-5 py-4 text-[13.5px] leading-relaxed text-amber-800">
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
              <span className="text-[12.5px] font-semibold text-slate-600">
                Usuário
              </span>
              <input
                name="user"
                autoComplete="username"
                defaultValue="admin"
                required
                className="rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-800 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-600/10"
              />
            </label>

            <label className="grid gap-1.5">
              <span className="text-[12.5px] font-semibold text-slate-600">
                Senha
              </span>
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
                autoFocus
                className="rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-800 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-600/10"
              />
            </label>

            {actionData?.error && (
              <p
                role="alert"
                className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-[12.5px] text-rose-800"
              >
                {actionData.error}
              </p>
            )}

            <button
              type="submit"
              className="mt-1 rounded-xl bg-slate-800 px-6 py-3 text-[13.5px] font-semibold text-white transition-colors hover:bg-slate-900"
            >
              Entrar
            </button>
          </Form>
        )}

        <p className="mt-4 text-[11.5px] leading-relaxed text-slate-400">
          A sessão dura 8 horas e vale só para /admin. Nada do que você faz
          aqui aparece para o público antes de ser aprovado.
        </p>
      </Container>
    </main>
  );
}

/** Espelha safeNextPath no cliente — o servidor continua sendo a autoridade. */
function safeNextPathClient(raw: string | null): string {
  if (!raw || !raw.startsWith("/admin") || raw.startsWith("//")) return "/admin";
  return raw;
}
