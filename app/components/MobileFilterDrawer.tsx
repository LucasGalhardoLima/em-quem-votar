import { FilterSidebar } from "./FilterSidebar";
import { useFilterStore } from "~/stores/filterStore";
import { useSubmit } from "react-router";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from "~/components/ui/sheet";
import { Badge } from "~/components/ui/badge";

interface MobileFilterDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    query: string | null;
}

export function MobileFilterDrawer({ isOpen, onClose, query }: MobileFilterDrawerProps) {
    const { selectedTags, setTags } = useFilterStore();
    const submit = useSubmit();

    const clearFilters = () => {
        setTags([]);

        const params = new URLSearchParams();
        if (query) params.set("q", query);
        submit(params, { method: "get", preventScrollReset: true, replace: false });
    };

    return (
        <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <SheetContent side="bottom" className="h-[85vh] rounded-t-[2rem] px-0 pb-0 flex flex-col gap-0 border-t-0 ring-0 focus-visible:outline-none">
                <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-muted/50 mb-3" />
                <SheetHeader className="px-6 pb-4 flex flex-row items-center justify-between border-b border-border/50 space-y-0 text-left">
                    <div className="flex items-center gap-3">
                        <SheetTitle className="text-xl">Filtros</SheetTitle>
                        {selectedTags.length > 0 && (
                            <Badge
                                variant="destructive"
                                className="cursor-pointer hover:bg-destructive/90 px-2 py-0.5 h-6"
                                onClick={clearFilters}
                            >
                                Limpar
                            </Badge>
                        )}
                    </div>
                </SheetHeader>

                <div className="flex-1 overflow-y-auto px-6 py-6 overscroll-contain pb-safe-area">
                    <FilterSidebar query={query} showHeader={false} />
                </div>
            </SheetContent>
        </Sheet>
    );
}
