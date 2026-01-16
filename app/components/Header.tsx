import { Link, useLocation, useRouteLoaderData } from "react-router";
import { ArrowLeft, User, ChevronRight, Home } from "lucide-react";
import { useState, useEffect } from "react";
import { LoginModal } from "./LoginModal";
import { createBrowserClient } from "@supabase/ssr";
import { clsx } from "clsx";
import { Button } from "~/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";

export interface BreadcrumbItem {
  label: string;
  href?: string;
  active?: boolean;
}

interface HeaderProps {
  breadcrumbItems?: BreadcrumbItem[];
}

export function Header({ breadcrumbItems = [] }: HeaderProps) {
  const rootData = useRouteLoaderData("root") as { session: any } | undefined;
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [session, setSession] = useState<any>(rootData?.session || null);
  const location = useLocation();
  const isHome = location.pathname === "/";

  const supabase = createBrowserClient(
    import.meta.env.VITE_SUPABASE_URL!,
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY!
  );

  // Client-side session check (for UI state only)
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setSession({ user });
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, [supabase.auth]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  // On Home, we don't show the header (handled by home.tsx)
  if (isHome) return null;

  return (
    <>
      <div className="max-w-7xl mx-auto px-4 py-4 md:py-6 flex items-center justify-between sticky top-0 bg-background/80 backdrop-blur-sm z-40 border-b border-border/40">
        {/* Left Side: Breadcrumbs (Desktop) or Back (Mobile) */}
        <div className="flex items-center">
          {/* Mobile Only: Simple Back link */}
          <div className="md:hidden">
            <Link to="/">
              <Button variant="ghost" size="icon" className="h-11 w-11 -ml-3">
                <ArrowLeft className="h-5 w-5" />
                <span className="sr-only">Voltar</span>
              </Button>
            </Link>
          </div>

          {/* Desktop Only: Breadcrumbs */}
          <nav aria-label="Breadcrumb" className="hidden md:flex items-center text-sm font-medium">
            <ol className="flex items-center space-x-2">
              <li className="flex items-center">
                <Link
                  to="/"
                  className="text-muted-foreground hover:text-primary transition-colors flex items-center group"
                >
                  <Home size={14} className="mr-1.5 group-hover:scale-110 transition-transform" />
                  <span className="sr-only">Início</span>
                </Link>
              </li>

              {breadcrumbItems.map((item, index) => (
                <li key={index} className="flex items-center">
                  <ChevronRight size={14} className="text-muted-foreground/50 mx-1" />
                  {item.href && !item.active ? (
                    <Link
                      to={item.href}
                      className="text-muted-foreground hover:text-primary transition-colors"
                    >
                      {item.label}
                    </Link>
                  ) : (
                    <span className={clsx(
                      "font-semibold",
                      item.active ? "text-foreground" : "text-muted-foreground"
                    )}>
                      {item.label}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        </div>

        {/* Right Side: User Info / Login */}
        <div className="flex items-center gap-2">
          {/* Current Page Title (Mobile Only - Center Aligned if needed, but keeping right aligned controls for now) */}

          {session ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 group cursor-default">
                <Avatar className="h-8 w-8 md:h-9 md:w-9 border border-border">
                  <AvatarImage src={session.user.user_metadata?.avatar_url} alt="Avatar" />
                  <AvatarFallback className="text-xs">
                    {session.user.email?.slice(0, 2).toUpperCase() || <User size={14} />}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden md:block text-xs font-bold text-foreground tracking-tight">
                  {session.user.user_metadata?.full_name?.split(' ')[0] || "Usuário"}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="hidden md:flex text-xs uppercase tracking-widest font-bold text-muted-foreground hover:text-destructive"
              >
                Sair
              </Button>
            </div>
          ) : (
            <Button
              variant="default"
              size="sm"
              onClick={() => setIsLoginOpen(true)}
              className="text-xs font-bold md:px-6 h-9"
            >
              Entrar
            </Button>
          )}
        </div>
      </div>

      <LoginModal isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} />
    </>
  );
}
