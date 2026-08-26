import {
  isRouteErrorResponse,
  Link,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { Toaster } from "sonner";

import type { Route } from "./+types/root";
import "./app.css";
import { checkRateLimit } from "~/utils/rate-limit.server";
import { Container, SiteFooter, SiteHeader } from "~/components/layout";

export async function loader({ request }: Route.LoaderArgs) {
  const ip = request.headers.get("x-forwarded-for") || "local";
  if (!checkRateLimit(ip)) {
    throw new Response("Too Many Requests", { status: 429 });
  }
  return null;
}

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Outfit:wght@500;600;700;800&display=swap",
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#f8fafc" />
        <Meta />
        <Links />
      </head>
      <body className="bg-slate-50 text-slate-800 antialiased">
        {children}
        <Toaster richColors position="bottom-center" closeButton />
        <ScrollRestoration />
        <Scripts />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}

export default function App() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <SiteHeader />
      <Outlet />
      <SiteFooter />
    </div>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let title = "Algo deu errado";
  let details =
    "Tivemos um problema inesperado ao carregar esta página. Tente novamente em instantes.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      title = "Página não encontrada";
      details =
        "O endereço que você abriu não existe ou foi movido. Os candidatos continuam em /candidatos.";
    } else if (error.status === 429) {
      title = "Muitas requisições";
      details =
        "Recebemos requisições demais deste endereço. Aguarde um minuto e recarregue a página.";
    } else {
      title = `Erro ${error.status}`;
      details = error.statusText || details;
    }
  } else if (import.meta.env.DEV && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <SiteHeader />
      <Container className="flex flex-1 flex-col items-center justify-center gap-5 py-24 text-center">
        <h1 className="font-heading text-4xl font-bold tracking-[-0.02em] text-slate-800">
          {title}
        </h1>
        <p className="max-w-lg text-[15px] leading-relaxed text-slate-600">
          {details}
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            to="/candidatos"
            className="rounded-xl bg-slate-800 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-900"
          >
            Ver os candidatos
          </Link>
          <Link
            to="/"
            className="rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-600 transition-colors hover:border-slate-300"
          >
            Voltar ao início
          </Link>
        </div>
        {stack && (
          <pre className="mt-6 w-full overflow-x-auto rounded-xl border border-slate-200 bg-white p-4 text-left text-xs text-slate-600">
            <code>{stack}</code>
          </pre>
        )}
      </Container>
      <SiteFooter />
    </div>
  );
}
