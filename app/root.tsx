import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";

import type { Route } from "./+types/root";
import "./app.css";
import { checkRateLimit } from "~/utils/rate-limit.server";

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
    href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
  },
];

import { Footer } from "~/components/Footer";

import { useEffect } from "react";
import posthog from "posthog-js";

export function Layout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Initialize PostHog (replace with real key in production)
    // configured to respect privacy designed for "anonymous" usage initially
    posthog.init('phc_PLACEHOLDER_KEY', {
        api_host: 'https://us.i.posthog.com',
        person_profiles: 'identified_only', // Privacy friendly
        loaded: (posthog) => {
            if (import.meta.env.DEV) posthog.opt_out_capturing(); // Disable in DEV
        }
    })
  }, []);

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body className="flex flex-col min-h-screen">
        <div className="flex-grow">
            {children}
        </div>
        <Footer />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="pt-16 p-4 container mx-auto">
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre className="w-full p-4 overflow-x-auto">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
