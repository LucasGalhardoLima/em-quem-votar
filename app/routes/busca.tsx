import { redirect } from "react-router";
import type { Route } from "./+types/busca";

export function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  // Preserve query parameters
  const newUrl = `/candidatos${url.search}`;
  return redirect(newUrl, 301);
}
