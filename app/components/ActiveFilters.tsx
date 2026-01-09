import { X } from "lucide-react";
import { useFilterStore } from "~/stores/filterStore";
import { FILTER_GROUPS } from "~/data/filters";
import { useSubmit } from "react-router";

interface ActiveFiltersProps {
    query: string | null;
}

export function ActiveFilters({ query }: ActiveFiltersProps) {
    const { selectedTags, toggleTag } = useFilterStore();
    const submit = useSubmit();

    if (selectedTags.length === 0) return null;

    // Helper to get label for a slug
    const getLabel = (slug: string) => {
        for (const group of FILTER_GROUPS) {
            const filter = group.filters.find(f => f.slug === slug);
            if (filter) return filter.label;
        }
        return slug;
    };

    const handleRemove = (slug: string) => {
        toggleTag(slug);
        const newTags = selectedTags.filter(t => t !== slug);

        // Submit new state
        const params = new URLSearchParams();
        if (query) params.set("q", query);
        if (newTags.length > 0) params.set("tags", newTags.join(","));

        submit(params, { method: "get", preventScrollReset: true, replace: false });
    };

    return (
        <div className="flex flex-wrap gap-2 mb-4">
            {selectedTags.map(slug => (
                <button
                    key={slug}
                    onClick={() => handleRemove(slug)}
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-brand-tertiary text-brand-text-alt rounded-full text-sm font-medium hover:bg-brand-tertiary/80 transition-colors border border-brand-primary/20"
                >
                    {getLabel(slug)}
                    <X size={14} className="text-brand-primary" />
                </button>
            ))}
        </div>
    );
}
