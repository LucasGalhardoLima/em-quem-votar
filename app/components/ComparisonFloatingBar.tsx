import { Link, useNavigate } from "react-router";
import { useComparisonStore } from "~/stores/comparisonStore";
import { ArrowRight } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { toast } from "sonner";
import { cn } from "~/lib/utils";

export function ComparisonFloatingBar() {
  const { selectedIds, clear } = useComparisonStore();
  const navigate = useNavigate();

  if (selectedIds.length === 0) return null;

  const handleCompare = (e: React.MouseEvent) => {
    if (selectedIds.length < 2) {
      e.preventDefault();
      toast.info("Selecione pelo menos 2 políticos para comparar");
    }
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-5 fade-in duration-300 w-[95%] max-w-md md:w-auto">
      <div className="bg-popover/95 backdrop-blur-md text-popover-foreground rounded-full shadow-2xl p-2 pl-5 flex items-center justify-between gap-4 border border-border/50 ring-1 ring-black/5">
        <div className="flex items-center gap-3 min-w-0">
          <Badge className="h-6 w-6 rounded-full flex items-center justify-center p-0 text-xs shrink-0">
            {selectedIds.length}
          </Badge>
          <div className="flex flex-col min-w-0">
            <span className="font-semibold text-sm leading-none truncate">
              Para comparar
            </span>
            <span className="text-[10px] text-muted-foreground hidden sm:inline">
              Máximo de 3 políticos
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={clear}
            className="text-xs text-muted-foreground hover:text-foreground h-9 px-3 hidden sm:flex"
          >
            Limpar
          </Button>

          <Button
            asChild
            disabled={selectedIds.length < 2}
            className={cn("rounded-full h-10 pl-5 pr-4 font-bold shadow-lg transition-all",
              selectedIds.length >= 2 ? "shadow-primary/25 hover:shadow-primary/40" : "opacity-50 cursor-not-allowed"
            )}
          >
            <Link
              to={`/comparar?ids=${selectedIds.join(",")}`}
              onClick={handleCompare}
            >
              Comparar
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
