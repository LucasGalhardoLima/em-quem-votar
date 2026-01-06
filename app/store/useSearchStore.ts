import { create } from "zustand";

interface SearchState {
  query: string;
  selectedFilter: string | null;
  setQuery: (query: string) => void;
  setFilter: (filter: string | null) => void;
}

export const useSearchStore = create<SearchState>((set) => ({
  query: "",
  selectedFilter: null,
  setQuery: (query) => set({ query }),
  setFilter: (filter) => set({ selectedFilter: filter }),
}));
