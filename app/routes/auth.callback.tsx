import { redirect } from "react-router";
import { createSupabaseServerClient } from "~/utils/supabase.server";
import { db } from "~/utils/db.server";
import type { Route } from "./+types/auth.callback";

export async function loader({ request }: Route.LoaderArgs) {
    const requestUrl = new URL(request.url);
    const code = requestUrl.searchParams.get("code");
    const next = requestUrl.searchParams.get("next") || "/";

    if (code) {
        const { supabase, headers } = createSupabaseServerClient(request);

        // 1. Exchange Code for Session
        const { data: { session }, error } = await supabase.auth.exchangeCodeForSession(code);

        if (error) {
            console.error("Auth callback error:", error);
            return redirect("/?error=auth_failed");
        }

        if (session?.user) {
            // 2. Sync with UserProfile in our DB
            const { id, email, user_metadata } = session.user;

            // Upsert user profile
            const user = await db.userProfile.upsert({
                where: { id: id },
                update: {
                    email: email!,
                    name: user_metadata.full_name || user_metadata.name || email!.split('@')[0],
                    photoUrl: user_metadata.avatar_url || user_metadata.picture,
                    updatedAt: new Date(),
                },
                create: {
                    id: id,
                    email: email!,
                    name: user_metadata.full_name || user_metadata.name || email!.split('@')[0],
                    photoUrl: user_metadata.avatar_url || user_metadata.picture,
                }
            });

            // 3. Onboarding Redirect
            // If the user hasn't answered the quiz yet, redirect them there.
            const quizAnswers = user.quizAnswers as Record<string, number> | null;
            const hasAnswers = quizAnswers && Object.keys(quizAnswers).length > 0;

            if (!hasAnswers) {
                return redirect("/quiz", { headers });
            }
        }

        return redirect(next, { headers });
    }

    return redirect("/?error=no_code");
}
