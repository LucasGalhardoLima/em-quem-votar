import { create } from 'zustand';

interface FilterState {
  selectedTags: string[];
  toggleTag: (slug: string) => void;
  setTags: (slugs: string[]) => void;
}

export const useFilterStore = create<FilterState>((set) => ({
  selectedTags: [],
  toggleTag: (slug) =>
    set((state) => {
      const isSelected = state.selectedTags.includes(slug);
      return {
        selectedTags: isSelected
          ? state.selectedTags.filter((t) => t !== slug)
          : [...state.selectedTags, slug],
      };
    }),
  setTags: (slugs) => set({ selectedTags: slugs }),
}));
