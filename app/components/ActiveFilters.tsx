import { X } from "lucide-react";
import { useFilterStore } from "~/stores/filterStore";
import { FILTER_GROUPS } from "~/data/filters";
import { useSubmit } from "react-router";

interface ActiveFiltersProps {
    query: string | null;
    tags: string[];
    states: string[];
    parties: string[];
}

export function ActiveFilters({ query, tags, states, parties }: ActiveFiltersProps) {
    const { toggleTag } = useFilterStore();
    const submit = useSubmit();

    const allFilters = [
        ...tags.map(slug => ({ type: 'tag', value: slug })),
        ...states.map(uf => ({ type: 'uf', value: uf })),
        ...parties.map(p => ({ type: 'partido', value: p }))
    ];

    if (allFilters.length === 0) return null;

    // Helper to get label for a slug
    const getLabel = (item: { type: string, value: string }) => {
        if (item.type === 'tag') {
            for (const group of FILTER_GROUPS) {
                const filter = group.filters.find(f => f.slug === item.value);
                if (filter) return filter.label;
            }
            return item.value;
        }
        return item.value; // UF or Party is usually self-descriptive (SP, PT)
    };

    const handleRemove = (item: { type: string, value: string }) => {
        let newTags = tags;
        let newStates = states;
        let newParties = parties;

        if (item.type === 'tag') {
            toggleTag(item.value); // Sync store
            newTags = tags.filter(t => t !== item.value);
        } else if (item.type === 'uf') {
            newStates = states.filter(s => s !== item.value);
        } else if (item.type === 'partido') {
            newParties = parties.filter(p => p !== item.value);
        }

        // Submit new state
        const params = new URLSearchParams();
        if (query) params.set("q", query);
        if (newTags.length > 0) params.set("tags", newTags.join(","));
        if (newStates.length > 0) params.set("uf", newStates.join(","));
        if (newParties.length > 0) params.set("partido", newParties.join(","));

        submit(params, { method: "get", preventScrollReset: true, replace: false });
    };

    return (
        <div className="flex flex-wrap gap-2 mb-4">
            {allFilters.map(item => (
                <button
                    key={`${item.type}-${item.value}`}
                    onClick={() => handleRemove(item)}
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-brand-primary-light text-brand-primary rounded-full text-sm font-medium hover:bg-brand-primary/10 transition-colors border border-brand-primary/20"
                >
                    {item.type !== 'tag' && <span className="opacity-60 text-xs uppercase mr-0.5">{item.type}:</span>}
                    {getLabel(item)}
                    <X size={14} className="text-brand-primary" />
                </button>
            ))}
        </div>
    );
}
