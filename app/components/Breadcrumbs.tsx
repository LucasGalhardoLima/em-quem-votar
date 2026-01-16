import { Link } from "react-router";
import { ChevronRight, Home } from "lucide-react";
import { clsx } from "clsx";

export interface BreadcrumbItem {
    label: string;
    href?: string;
    active?: boolean;
}

interface BreadcrumbsProps {
    items: BreadcrumbItem[];
    className?: string;
}

export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
    return (
        <nav aria-label="Breadcrumb" className={clsx("flex items-center text-sm font-medium", className)}>
            <ol className="flex items-center space-x-2">
                <li className="flex items-center">
                    <Link
                        to="/"
                        className="text-gray-400 hover:text-brand-primary transition-colors flex items-center"
                    >
                        <Home size={14} className="mr-1.5" />
                        <span className="sr-only">Início</span>
                    </Link>
                </li>

                {items.map((item, index) => (
                    <li key={index} className="flex items-center">
                        <ChevronRight size={14} className="text-gray-300 mx-1" />
                        {item.href && !item.active ? (
                            <Link
                                to={item.href}
                                className="text-gray-500 hover:text-brand-primary transition-colors"
                            >
                                {item.label}
                            </Link>
                        ) : (
                            <span className={clsx(
                                "font-bold",
                                item.active ? "text-brand-primary" : "text-gray-400"
                            )}>
                                {item.label}
                            </span>
                        )}
                    </li>
                ))}
            </ol>
        </nav>
    );
}
