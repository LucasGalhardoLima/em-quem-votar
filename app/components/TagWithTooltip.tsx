import { Info, ShieldCheck } from "lucide-react";
import { TAG_DEFINITIONS } from "~/data/tag-definitions";
import { Badge } from "~/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";

interface TagWithTooltipProps {
  tag: {
    id: string;
    name: string;
    slug: string;
  };
}

export function TagWithTooltip({ tag }: TagWithTooltipProps) {
  const definition = TAG_DEFINITIONS[tag.slug];

  if (!definition) {
    return (
      <Badge
        variant="secondary"
        className="bg-brand-primary-light text-brand-primary border-brand-primary/20 hover:bg-brand-primary/20 font-medium whitespace-nowrap"
      >
        {tag.name}
      </Badge>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <Badge
            variant="secondary"
            className="cursor-help gap-1.5 bg-brand-primary-light text-brand-primary border-brand-primary/20 hover:bg-brand-primary/20 pr-1.5 font-medium whitespace-nowrap"
          >
            {tag.name}
            <Info size={12} className="text-brand-primary/60" />
          </Badge>
        </TooltipTrigger>

        <TooltipContent side="top" className="max-w-xs p-4 bg-white text-gray-800 border-gray-200 shadow-xl z-50">
          <div className="flex items-center gap-2 font-bold text-gray-900 mb-2 border-b border-gray-100 pb-2">
            <ShieldCheck size={14} className="text-brand-success" />
            Origem da Classificação
          </div>
          <p className="leading-relaxed text-gray-600 mb-2 text-xs">
            {definition.reasonText}
          </p>
          <div className="bg-gray-50 p-2 rounded border border-gray-100">
            <span className="block text-[10px] text-gray-400 uppercase tracking-wider font-bold mb-0.5">Baseado no voto:</span>
            <span className="font-semibold text-gray-900 text-xs">{definition.triggerVote}</span>
            <span className="text-gray-500 text-xs"> em </span>
            <span className="font-medium text-gray-700 text-xs block mt-0.5 leading-tight">{definition.billTitle}</span>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
