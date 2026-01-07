import { Link } from "react-router";
import { ChevronRight, Home } from "lucide-react";

interface BreadcrumbItem {
    label: string;
    href?: string;
}

interface BreadcrumbsProps {
    items: BreadcrumbItem[];
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
    return (
        <nav className="flex" aria-label="Breadcrumb">
            <ol className="inline-flex items-center space-x-1 md:space-x-3">
                <li className="inline-flex items-center">
                    <Link
                        to="/"
                        className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-blue-600 transition-colors"
                    >
                        <Home className="w-4 h-4 mr-2" />
                        Início
                    </Link>
                </li>
                {items.map((item, index) => (
                    <li key={index}>
                        <div className="flex items-center">
                            <ChevronRight className="w-4 h-4 text-gray-400 mx-1" />
                            {item.href ? (
                                <Link
                                    to={item.href}
                                    className="ml-1 text-sm font-medium text-gray-500 hover:text-blue-600 transition-colors md:ml-2"
                                >
                                    {item.label}
                                </Link>
                            ) : (
                                <span className="ml-1 text-sm font-medium text-gray-700 md:ml-2 line-clamp-1 max-w-[200px] md:max-w-none">
                                    {item.label}
                                </span>
                            )}
                        </div>
                    </li>
                ))}
            </ol>
        </nav>
    );
}
