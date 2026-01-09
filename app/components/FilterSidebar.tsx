import { clsx } from "clsx";
import { Link, useSubmit } from "react-router";
import { FILTER_GROUPS } from "~/data/filters";
import { useFilterStore } from "~/stores/filterStore";
import { Search, X } from "lucide-react";

interface FilterSidebarProps {
  query: string | null;
  showHeader?: boolean;
}

export function FilterSidebar({ query, showHeader = true }: FilterSidebarProps) {
  const { selectedTags, toggleTag, setTags } = useFilterStore();
  const submit = useSubmit();

  // ... (handlers)
  const handleTagClick = (slug: string) => {
    toggleTag(slug);
    // Determine new tags for URL submission
    const isSelected = selectedTags.includes(slug);
    const newTags = isSelected
      ? selectedTags.filter((t) => t !== slug)
      : [...selectedTags, slug];

    submitParams(newTags, query);
  };

  const submitParams = (tags: string[], q: string | null) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (tags.length > 0) params.set("tags", tags.join(","));

    submit(params, { method: "get", preventScrollReset: true, replace: false });
  };

  const clearFilters = () => {
    setTags([]);
    submitParams([], query);
  };

  return (
    <aside className="w-full md:w-64 flex-shrink-0 space-y-8">
      <div>
        {showHeader && (
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-gray-900 text-lg">Filtros</h3>
            {selectedTags.length > 0 && (
              <button
                onClick={clearFilters}
                className="text-xs text-brand-alert hover:text-brand-alert/80 font-medium flex items-center gap-1 bg-brand-alert/10 px-2 py-1 rounded-md transition-colors"
              >
                <X size={12} /> Limpar
              </button>
            )}
          </div>
        )}

        <div className="space-y-8">
          {FILTER_GROUPS.map((group, groupIdx) => (
            <div key={group.title} className="space-y-3">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                {group.title}
              </h4>
              <div className="flex flex-col gap-1.5">
                {group.filters.map((filter) => {
                  const isSelected = selectedTags.includes(filter.slug);
                  return (
                    <button
                      key={filter.slug}
                      onClick={() => handleTagClick(filter.slug)}
                      className={clsx(
                        "flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all duration-200 w-full text-left group",
                        isSelected
                          ? "bg-brand-tertiary text-brand-text-alt font-medium shadow-sm ring-1 ring-brand-primary/20"
                          : "text-gray-600 hover:bg-gray-100"
                      )}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        {/* Optional: Checkbox icon simulator */}
                        <div className={clsx(
                          "w-4 h-4 rounded border flex items-center justify-center transition-colors flex-shrink-0",
                          isSelected ? "bg-brand-primary border-brand-primary" : "border-gray-300 group-hover:border-gray-400 bg-white"
                        )}>
                          {isSelected && <div className="w-1.5 h-1.5 bg-white rounded-sm" />}
                        </div>
                        <span className="truncate">{filter.label}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Placeholder for Party Filters (Future) */}
      {/* 
      <div className="pt-4 border-t border-gray-100">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Partidos
        </p>
        ...
      </div>
      */}
    </aside>
  );
}
