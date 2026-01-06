import { useEffect, useState } from "react";
import posthog from "posthog-js";
import { PostHogProvider } from "posthog-js/react";
import { useLocation } from "react-router";

export function PHProvider({ children }: { children: React.ReactNode }) {
    const [hydrated, setHydrated] = useState(false);
    const location = useLocation();

    useEffect(() => {
        const posthogKey = import.meta.env.VITE_POSTHOG_KEY;
        const posthogHost = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';

        posthog.init(posthogKey, {
            api_host: posthogHost,
            person_profiles: 'identified_only', // Privacy friendly
            loaded: (ph) => {
                if (import.meta.env.DEV) ph.opt_out_capturing(); // Disable in DEV
            }
        });

        setHydrated(true);
    }, []);

    useEffect(() => {
        // Capture pageview on route change after hydration
        if (hydrated && typeof window !== "undefined") {
            posthog.capture("$pageview", {
                $current_url: window.location.href,
            });
        }
    }, [location, hydrated]);

    if (!hydrated) return <>{children}</>;

    return <PostHogProvider client={posthog}>{children}</PostHogProvider>;
}
