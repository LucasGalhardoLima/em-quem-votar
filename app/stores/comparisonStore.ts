import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ComparisonStore {
  selectedIds: string[];
  toggleId: (id: string) => void;
  clear: () => void;
  isSelected: (id: string) => boolean;
}

export const useComparisonStore = create<ComparisonStore>()(
  persist(
    (set, get) => ({
      selectedIds: [],
      toggleId: (id) => {
        const { selectedIds } = get();
        if (selectedIds.includes(id)) {
          set({ selectedIds: selectedIds.filter((i) => i !== id) });
        } else {
          if (selectedIds.length >= 3) {
            alert("Você pode comparar no máximo 3 políticos.");
            return;
          }
          set({ selectedIds: [...selectedIds, id] });
        }
      },
      clear: () => set({ selectedIds: [] }),
      isSelected: (id) => get().selectedIds.includes(id),
    }),
    {
      name: "comparison-store",
    }
  )
);
