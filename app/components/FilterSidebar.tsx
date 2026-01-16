import { useState } from "react";
import { clsx } from "clsx";
import { Link, useSubmit } from "react-router";
import { FILTER_GROUPS } from "~/data/filters";
import { useFilterStore } from "~/stores/filterStore";
import { Search, X, ChevronDown } from "lucide-react";

interface FilterSidebarProps {
  query: string | null;
  showHeader?: boolean;
  filters?: {
    states: string[];
    parties: string[];
  };
  activeStates?: string[];
  activeParties?: string[];
}

export function FilterSidebar({
  query,
  showHeader = true,
  filters = { states: [], parties: [] },
  activeStates = [],
  activeParties = []
}: FilterSidebarProps) {
  const { selectedTags, toggleTag, setTags } = useFilterStore();
  const submit = useSubmit();
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    tags: true,
    parties: true,
    states: true
  });

  const toggleSection = (id: string) => {
    setOpenSections((prev: Record<string, boolean>) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleTagClick = (slug: string) => {
    toggleTag(slug);
    const isSelected = selectedTags.includes(slug);
    const newTags = isSelected
      ? selectedTags.filter((t) => t !== slug)
      : [...selectedTags, slug];

    submitAll(newTags, activeStates, activeParties, query);
  };

  const handleStateClick = (state: string) => {
    const isSelected = activeStates.includes(state);
    const newStates = isSelected
      ? activeStates.filter(s => s !== state)
      : [...activeStates, state];
    submitAll(selectedTags, newStates, activeParties, query);
  };

  const handlePartyClick = (party: string) => {
    const isSelected = activeParties.includes(party);
    const newParties = isSelected
      ? activeParties.filter(p => p !== party)
      : [...activeParties, party];
    submitAll(selectedTags, activeStates, newParties, query);
  };

  const submitAll = (tags: string[], states: string[], parties: string[], q: string | null) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (tags.length > 0) params.set("tags", tags.join(","));
    if (states.length > 0) params.set("uf", states.join(","));
    if (parties.length > 0) params.set("partido", parties.join(","));

    submit(params, { method: "get", preventScrollReset: true, replace: false });
  };

  const clearFilters = () => {
    setTags([]);
    submitAll([], [], [], query);
  };

  const hasAnyFilter = selectedTags.length > 0 || activeStates.length > 0 || activeParties.length > 0;

  const FilterCheckbox = ({ label, isSelected, onClick }: { label: string, isSelected: boolean, onClick: () => void }) => (
    <button
      onClick={onClick}
      className={clsx(
        "flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all duration-200 w-full text-left group",
        isSelected
          ? "bg-brand-primary-light text-brand-primary font-medium shadow-sm ring-1 ring-brand-primary/20"
          : "text-gray-600 hover:bg-gray-100"
      )}
    >
      <span className="flex items-center gap-2 min-w-0">
        <div className={clsx(
          "w-4 h-4 rounded border flex items-center justify-center transition-colors flex-shrink-0",
          isSelected ? "bg-brand-primary border-brand-primary" : "border-gray-300 group-hover:border-gray-400 bg-white"
        )}>
          {isSelected && <div className="w-1.5 h-1.5 bg-white rounded-sm" />}
        </div>
        <span className="truncate">{label}</span>
      </span>
    </button>
  );

  const CollapsibleSection = ({ id, title, children }: { id: string, title: string, children: React.ReactNode }) => {
    const isOpen = openSections[id];
    return (
      <div className="space-y-3">
        <button
          onClick={() => toggleSection(id)}
          className="w-full flex items-center justify-between text-xs font-semibold text-gray-500 uppercase tracking-wider group hover:text-brand-primary transition-colors"
        >
          <span className="flex items-center gap-2">{title}</span>
          <ChevronDown size={14} className={clsx("transition-transform duration-200", !isOpen && "-rotate-90")} />
        </button>
        {isOpen && <div className="space-y-1.5">{children}</div>}
      </div>
    );
  };

  return (
    <aside className="w-full md:w-64 flex-shrink-0 space-y-8 pb-20">
      <div>
        {showHeader && (
          <div className="flex items-center justify-between mb-6 border-b border-gray-100 pb-4">
            <h3 className="font-bold text-gray-900 text-lg">Filtros</h3>
            {hasAnyFilter && (
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

          {/* 1. Categorias Básicas */}
          {FILTER_GROUPS.map((group, idx) => (
            <CollapsibleSection key={group.title} id={`tags-${idx}`} title={group.title}>
              {group.filters.map((filter) => (
                <FilterCheckbox
                  key={filter.slug}
                  label={filter.label}
                  isSelected={selectedTags.includes(filter.slug)}
                  onClick={() => handleTagClick(filter.slug)}
                />
              ))}
            </CollapsibleSection>
          ))}

          {/* 2. Partidos */}
          {filters.parties.length > 0 && (
            <CollapsibleSection id="parties" title="Partidos">
              <div className="max-h-60 overflow-y-auto pr-2 space-y-1 scrollbar-thin scrollbar-thumb-gray-200">
                {filters.parties.map(party => (
                  <FilterCheckbox
                    key={party}
                    label={party}
                    isSelected={activeParties.includes(party)}
                    onClick={() => handlePartyClick(party)}
                  />
                ))}
              </div>
            </CollapsibleSection>
          )}

          {/* 3. Estados */}
          {filters.states.length > 0 && (
            <CollapsibleSection id="states" title="Estados">
              <div className="grid grid-cols-3 gap-1">
                {filters.states.map(state => {
                  const isSelected = activeStates.includes(state);
                  return (
                    <button
                      key={state}
                      onClick={() => handleStateClick(state)}
                      className={clsx(
                        "px-1 py-1.5 rounded text-xs font-medium text-center transition-colors border",
                        isSelected
                          ? "bg-brand-primary text-white border-brand-primary"
                          : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                      )}
                    >
                      {state}
                    </button>
                  )
                })}
              </div>
            </CollapsibleSection>
          )}

        </div>
      </div>
    </aside>
  );
}
