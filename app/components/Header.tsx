import { Link, useLocation } from "react-router";
import { ArrowLeft, ChevronRight, Home } from "lucide-react";
import { clsx } from "clsx";
import { Button } from "~/components/ui/button";

export interface BreadcrumbItem {
  label: string;
  href?: string;
  active?: boolean;
}

interface HeaderProps {
  breadcrumbItems?: BreadcrumbItem[];
}

export function Header({ breadcrumbItems = [] }: HeaderProps) {
  const location = useLocation();
  const isHome = location.pathname === "/";

  // On Home, we don't show the header (handled by home.tsx)
  if (isHome) return null;

  return (
    <>
      <div className="w-full sticky top-0 bg-background/80 backdrop-blur-sm z-40 border-b border-border/40">
        <div className="max-w-7xl mx-auto px-4 py-4 md:py-6 flex items-center justify-between">
          {/* Left Side: Breadcrumbs (Desktop) or Back (Mobile) */}
          <div className="flex items-center">
            {/* Mobile Only: Simple Back link */}
            {/* Mobile Only: Back link + context */}
            <div className="md:hidden flex items-center gap-1">
              <Link to="/">
                <Button variant="ghost" size="icon" className="h-11 w-11 -ml-3">
                  <ArrowLeft className="h-5 w-5" />
                  <span className="sr-only">Voltar</span>
                </Button>
              </Link>
              {breadcrumbItems.length > 0 && (
                <span className="text-sm font-bold text-foreground truncate max-w-[180px]">
                  {breadcrumbItems.find(item => item.active)?.label || breadcrumbItems[breadcrumbItems.length - 1].label}
                </span>
              )}
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

          {/* Right Side: Site Name/Logo */}
          <div className="flex items-center gap-2">
            <Link to="/" className="flex items-center gap-1 group">
              <span className="text-sm md:text-lg font-black tracking-tighter text-brand-text group-hover:text-brand-primary transition-colors">
                <span className="md:inline">EM QUEM</span> <span className="text-brand-primary group-hover:text-brand-text">VOTAR?</span>
              </span>
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
