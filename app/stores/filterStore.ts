import { create } from "zustand";

interface FilterState {
  // New candidate-specific filters
  selectedParties: string[];
  selectedTopic: string | null;
  selectedStance: string | null;
  toggleParty: (party: string) => void;
  setTopic: (slug: string | null) => void;
  setStance: (stance: string | null) => void;
  clearAll: () => void;

  // Legacy tag-based filters (backwards compatibility for busca.tsx)
  selectedTags: string[];
  toggleTag: (slug: string) => void;
  setTags: (slugs: string[]) => void;
}

export const useFilterStore = create<FilterState>((set) => ({
  // New
  selectedParties: [],
  selectedTopic: null,
  selectedStance: null,
  toggleParty: (party) =>
    set((state) => ({
      selectedParties: state.selectedParties.includes(party)
        ? state.selectedParties.filter((p) => p !== party)
        : [...state.selectedParties, party],
    })),
  setTopic: (slug) => set({ selectedTopic: slug }),
  setStance: (stance) => set({ selectedStance: stance }),
  clearAll: () =>
    set({
      selectedParties: [],
      selectedTopic: null,
      selectedStance: null,
      selectedTags: [],
    }),

  // Legacy
  selectedTags: [],
  toggleTag: (slug) =>
    set((state) => ({
      selectedTags: state.selectedTags.includes(slug)
        ? state.selectedTags.filter((t) => t !== slug)
        : [...state.selectedTags, slug],
    })),
  setTags: (slugs) => set({ selectedTags: slugs }),
}));
