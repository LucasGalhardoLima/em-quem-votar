import { Link, useLocation } from "react-router";
import { ArrowLeft, ChevronRight, Home, Menu, X } from "lucide-react";
import { clsx } from "clsx";
import { Button } from "~/components/ui/button";
import { useState } from "react";

export interface BreadcrumbItem {
  label: string;
  href?: string;
  active?: boolean;
}

interface HeaderProps {
  breadcrumbItems?: BreadcrumbItem[];
}

const NAV_LINKS = [
  { label: "Candidatos", href: "/candidatos" },
  { label: "Quiz", href: "/quiz" },
  { label: "Votações", href: "/votacoes" },
  { label: "Educação", href: "/educacao" },
  { label: "Sobre", href: "/sobre" },
];

export function Header({ breadcrumbItems = [] }: HeaderProps) {
  const location = useLocation();
  const isHome = location.pathname === "/";
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (isHome) return null;

  return (
    <>
      <div className="w-full sticky top-0 bg-background/80 backdrop-blur-sm z-40 border-b border-border/40">
        <div className="max-w-7xl mx-auto px-4 py-4 md:py-6 flex items-center justify-between">
          {/* Left Side: Breadcrumbs (Desktop) or Back (Mobile) */}
          <div className="flex items-center">
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

          {/* Center: Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className={clsx(
                  "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                  location.pathname.startsWith(link.href)
                    ? "text-foreground bg-muted"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Right Side: Site Name/Logo + Mobile Menu */}
          <div className="flex items-center gap-2">
            <Link to="/" className="flex items-center gap-1 group">
              <span className="text-sm md:text-lg font-black tracking-tighter text-brand-text group-hover:text-brand-primary transition-colors">
                <span className="md:inline">EM QUEM</span> <span className="text-brand-primary group-hover:text-brand-text">VOTAR?</span>
              </span>
            </Link>

            {/* Mobile Menu Toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden h-11 w-11"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              <span className="sr-only">Menu</span>
            </Button>
          </div>
        </div>

        {/* Mobile Menu Dropdown */}
        {mobileMenuOpen && (
          <nav className="md:hidden border-t border-border/40 px-4 py-3 space-y-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className={clsx(
                  "block px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                  location.pathname.startsWith(link.href)
                    ? "text-foreground bg-muted"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        )}
      </div>
    </>
  );
}
