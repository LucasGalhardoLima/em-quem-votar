import { Link } from "react-router";
import { User, Check } from "lucide-react";
import { TagWithTooltip } from "~/components/TagWithTooltip";
import { toast } from "sonner";
import { useComparisonStore } from "~/stores/comparisonStore";
import { motion } from "framer-motion";
import { Card, CardContent } from "~/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

interface PoliticianCardProps {
    politician: {
        id: string;
        name: string;
        party: string;
        state: string;
        photoUrl: string | null;
        tags: {
            tag: {
                id: string;
                name: string;
                slug: string;
                category: string;
                description?: string;
            }
        }[];
    };
    variants?: any;
}

export function PoliticianCard({ politician, variants }: PoliticianCardProps) {
    const { toggleId, isSelected } = useComparisonStore();
    const selected = isSelected(politician.id);

    const handleCompare = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        toggleId(politician.id);

        if (!selected) {
            toast.success(`${politician.name} adicionado à comparação`, {
                duration: 2000,
                position: "bottom-center"
            });
        } else {
            toast.info(`${politician.name} removido`, {
                duration: 1500,
                position: "bottom-center"
            });
        }
    };

    return (
        <motion.div variants={variants} layout>
            <Link
                to={`/politico/${politician.id}`}
                prefetch="intent"
                className="block h-full outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-xl"
            >
                <Card className={cn(
                    "h-full transition-all duration-200 hover:shadow-md border-transparent hover:border-primary/10",
                    selected ? "ring-2 ring-primary border-primary bg-primary/5" : "bg-card"
                )}>
                    <CardContent className="p-4 flex items-start gap-4 relative">
                        {/* Compare Toggle */}
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleCompare}
                            className={cn(
                                "absolute top-2 right-2 h-8 w-8 rounded-full transition-all z-10",
                                selected
                                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                                    : "bg-background/80 text-muted-foreground hover:bg-muted hover:text-foreground"
                            )}
                            title={selected ? "Remover da comparação" : "Comparar"}
                        >
                            <Check className={cn("h-4 w-4", selected ? "opacity-100" : "opacity-0 group-hover:opacity-50")} />
                            <span className="sr-only">Comparar</span>
                            {/* Ring for unselected state to look like a checkbox outline */}
                            {!selected && (
                                <div className="absolute inset-0 rounded-full border-2 border-muted-foreground/20 group-hover:border-primary/50 pointer-events-none" />
                            )}
                        </Button>

                        <Avatar className="h-14 w-14 border border-border bg-muted shrink-0">
                            <AvatarImage src={politician.photoUrl || undefined} alt={politician.name} className="object-cover" />
                            <AvatarFallback>
                                <User className="h-6 w-6 text-muted-foreground" />
                            </AvatarFallback>
                        </Avatar>

                        <div className="min-w-0 flex-1 flex flex-col pt-0.5">
                            <h3 className="font-semibold text-lg text-foreground leading-tight truncate pr-8">
                                {politician.name}
                            </h3>
                            <p className="text-sm text-muted-foreground truncate mb-3">
                                {politician.party} • {politician.state}
                            </p>

                            {politician.tags && politician.tags.length > 0 && (
                                <div className="flex gap-1.5 flex-wrap">
                                    {politician.tags.slice(0, 3).map((pt: any) => (
                                        <TagWithTooltip key={pt.tag.id || pt.tag.slug} tag={pt.tag} />
                                    ))}
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </Link>
        </motion.div>
    );
}
