import { Info, ShieldCheck } from "lucide-react";
import { TAG_DEFINITIONS } from "~/data/tag-definitions";

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
      <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium bg-brand-primary-light text-brand-primary shadow-sm border border-brand-primary/20">
        {tag.name}
      </span>
    );
  }

  return (
    <div className="group/tooltip relative inline-block">
      <span className="cursor-help inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-brand-primary-light text-brand-primary shadow-sm hover:bg-brand-primary/10 transition-colors border border-brand-primary/20">
        {tag.name}
        <Info size={12} className="text-brand-primary/60 group-hover/tooltip:text-brand-primary transition-colors" />
      </span>

      {/* Tooltip */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-72 p-4 bg-white text-gray-800 text-xs rounded-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.2)] border border-gray-200 opacity-0 invisible translate-y-2 group-hover/tooltip:opacity-100 group-hover/tooltip:visible group-hover/tooltip:translate-y-0 transition-all duration-200 z-50 pointer-events-none text-left">
        <div className="flex items-center gap-2 font-bold text-gray-900 mb-2 border-b border-gray-100 pb-2">
          <ShieldCheck size={14} className="text-brand-success" />
          Origem da Classificação
        </div>
        <p className="leading-relaxed text-gray-600 mb-2">
          {definition.reasonText}
        </p>
        <div className="bg-gray-50 p-2 rounded border border-gray-100">
          <span className="block text-[10px] text-gray-400 uppercase tracking-wider font-bold mb-0.5">Baseado no voto:</span>
          <span className="font-semibold text-gray-900">{definition.triggerVote}</span>
          <span className="text-gray-500"> em </span>
          <span className="font-medium text-gray-700">{definition.billTitle}</span>
        </div>

        {/* Arrow */}
        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-2 border-x-8 border-x-transparent border-t-8 border-t-white drop-shadow-sm"></div>
      </div>
    </div>
  );
}
