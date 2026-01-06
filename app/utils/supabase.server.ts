import { createServerClient, parseCookieHeader, serializeCookieHeader } from "@supabase/ssr";

export const createSupabaseServerClient = (request: Request) => {
  const headers = new Headers();

  return {
    supabase: createServerClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
      {
        cookies: {
          getAll() {
            return parseCookieHeader(request.headers.get("Cookie") ?? "").map(({ name, value }) => ({
              name,
              value: value ?? "",
            }));
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              headers.append("Set-Cookie", serializeCookieHeader(name, value, options))
            );
          },
        },
      }
    ),
    headers,
  };
};
