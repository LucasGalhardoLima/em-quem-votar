import { Link } from "react-router";
import { User, Check } from "lucide-react";
import { TagWithTooltip } from "~/components/TagWithTooltip";
import { toast } from "sonner";
import { useComparisonStore } from "~/stores/comparisonStore";
import { motion } from "framer-motion";

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

    return (
        <motion.div variants={variants}>
            <Link
                to={`/politico/${politician.id}`}
                prefetch="intent"
                className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all flex items-start gap-4 group cursor-pointer h-full relative"
            >
                <button
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const newState = !isSelected(politician.id);
                        toggleId(politician.id);

                        if (newState) {
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
                    }}
                    className="absolute top-3 right-3 z-10 p-1.5 rounded-full hover:bg-gray-50 transition-colors group/btn"
                    title="Comparar"
                >
                    <div className={`w-5 h-5 rounded flex items-center justify-center transition-all ${isSelected(politician.id)
                        ? "bg-blue-600 text-white shadow-sm"
                        : "bg-white border-2 border-gray-200 group-hover:border-blue-400"
                        }`}>
                        {isSelected(politician.id) && <Check size={14} strokeWidth={3} />}
                    </div>
                </button>

                <div className="w-14 h-14 rounded-full overflow-hidden bg-gray-200 flex-shrink-0 border border-gray-100">
                    {politician.photoUrl ? (
                        <img src={politician.photoUrl} alt={politician.name} className="w-full h-full object-cover" />
                    ) : (
                        <User className="w-full h-full p-3 text-gray-400" />
                    )}
                </div>
                <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors truncate text-lg">{politician.name}</h3>
                    <p className="text-sm text-gray-500 truncate mb-2">{politician.party} • {politician.state}</p>

                    {politician.tags && politician.tags.length > 0 && (
                        <div className="flex gap-1.5 flex-wrap">
                            {politician.tags.slice(0, 3).map((pt: any) => (
                                <TagWithTooltip key={pt.tag.id || pt.tag.slug} tag={pt.tag} />
                            ))}
                        </div>
                    )}

                    <div className="mt-3 pt-2 border-t border-gray-50 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <span
                            className="text-[10px] text-gray-300 hover:text-gray-500 hover:underline transition-colors block"
                        >
                            Ver perfil completo
                        </span>
                    </div>
                </div>
            </Link>
        </motion.div>
    );
}
