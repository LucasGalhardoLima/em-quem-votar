import { redirect } from "react-router";
import type { Route } from "./+types/politico.$id";

export function loader({ params }: Route.LoaderArgs) {
  // Redirect legacy politician URLs to candidate pages
  // The ID format may differ, so redirect to the listing as fallback
  return redirect(`/candidatos`, 301);
}
