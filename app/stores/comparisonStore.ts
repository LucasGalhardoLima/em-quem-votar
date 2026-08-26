import { useEffect } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export const MAX_COMPARISON = 3;

export type ToggleResult = "added" | "removed" | "limit";

interface ComparisonStore {
  selectedIds: string[];
  /** Falso até o localStorage ser lido — evita divergência com o HTML do SSR. */
  hydrated: boolean;
  toggleId: (id: string) => ToggleResult;
  remove: (id: string) => void;
  setIds: (ids: string[]) => void;
  clear: () => void;
  isSelected: (id: string) => boolean;
  markHydrated: () => void;
}

export const useComparisonStore = create<ComparisonStore>()(
  persist(
    (set, get) => ({
      selectedIds: [],
      hydrated: false,
      toggleId: (id) => {
        const { selectedIds } = get();
        if (selectedIds.includes(id)) {
          set({ selectedIds: selectedIds.filter((i) => i !== id) });
          return "removed";
        }
        if (selectedIds.length >= MAX_COMPARISON) return "limit";
        set({ selectedIds: [...selectedIds, id] });
        return "added";
      },
      remove: (id) =>
        set({ selectedIds: get().selectedIds.filter((i) => i !== id) }),
      setIds: (ids) => set({ selectedIds: ids.slice(0, MAX_COMPARISON) }),
      clear: () => set({ selectedIds: [] }),
      isSelected: (id) => get().selectedIds.includes(id),
      markHydrated: () => set({ hydrated: true }),
    }),
    {
      name: "comparison-store",
      partialize: (s) => ({ selectedIds: s.selectedIds }),
      // O SSR renderiza sempre com a lista vazia. A leitura do localStorage
      // é adiada para depois da montagem, senão o primeiro render do cliente
      // divergiria do HTML entregue pelo servidor.
      skipHydration: true,
    },
  ),
);

/**
 * Dispara a leitura do localStorage uma única vez, após a montagem.
 * Chamada pelas telas que exibem estado de comparação.
 */
export function useComparisonHydration() {
  useEffect(() => {
    if (useComparisonStore.getState().hydrated) return;
    void useComparisonStore.persist.rehydrate();
    useComparisonStore.getState().markHydrated();
  }, []);
  return useComparisonStore((s) => s.hydrated);
}
