import { ExternalLink, Cpu, HardDrive, ShieldCheck, Flame } from "lucide-react";
import type { DealItem } from "../types";
import { formatCurrency } from "../utils/formatters";

interface DealCardProps {
  deal: DealItem;
}

export function DealCard({ deal }: DealCardProps) {
  const savings =
    deal.estimatedMarketPrice && deal.realPrice && deal.estimatedMarketPrice > deal.realPrice
      ? Math.round(((deal.estimatedMarketPrice - deal.realPrice) / deal.estimatedMarketPrice) * 100)
      : null;

  const realPrice = deal.realPrice ?? deal.listing.listedPrice;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden hover:border-emerald-500/50 transition flex flex-col group shadow-lg shadow-black/40">
      {/* Photo & Badges */}
      <div className="relative aspect-video bg-slate-950 overflow-hidden">
        <img
          src={deal.listing.imageUrls[0] || "https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=600"}
          alt={deal.listing.title}
          className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
          loading="lazy"
        />
        <div className="absolute top-3 right-3 bg-emerald-500 text-slate-950 font-black text-xs px-2.5 py-1 rounded-full shadow-md flex items-center gap-1">
          <Flame className="w-3.5 h-3.5 fill-current" />
          SCORE {deal.dealScore}/100
        </div>
        {savings && savings > 0 && (
          <div className="absolute bottom-3 left-3 bg-slate-950/80 backdrop-blur text-emerald-400 font-bold text-xs px-2.5 py-1 rounded border border-emerald-500/30">
            ~{savings}% bajo mercado
          </div>
        )}
      </div>

      {/* Body Content */}
      <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
        <div className="space-y-3">
          <div>
            <span className="text-xs font-semibold text-emerald-400 tracking-wider uppercase">
              {deal.brand || "Portátil"}
            </span>
            <h3 className="text-base font-bold text-white line-clamp-1" title={deal.model || deal.listing.title}>
              {deal.model || deal.listing.title}
            </h3>
          </div>

          {/* Hardware Chips */}
          <div className="flex flex-wrap gap-1.5 text-xs">
            {deal.cpu && (
              <span className="bg-slate-800 text-slate-300 px-2 py-1 rounded flex items-center gap-1 border border-slate-700/60">
                <Cpu className="w-3 h-3 text-sky-400" />
                {deal.cpu}
              </span>
            )}
            {deal.ramGb && (
              <span className="bg-slate-800 text-slate-300 px-2 py-1 rounded flex items-center gap-1 border border-slate-700/60">
                {deal.ramGb} GB RAM
              </span>
            )}
            {deal.gpu && (
              <span className="bg-slate-800 text-slate-300 px-2 py-1 rounded flex items-center gap-1 border border-slate-700/60">
                <HardDrive className="w-3 h-3 text-emerald-400" />
                {deal.gpu}
              </span>
            )}
            {deal.conditionRating && (
              <span className="bg-slate-800 text-slate-300 px-2 py-1 rounded flex items-center gap-1 border border-slate-700/60">
                <ShieldCheck className="w-3 h-3 text-amber-400" />
                Estado: {deal.conditionRating}/10
              </span>
            )}
          </div>

          {/* AI Reasoning */}
          {deal.reasoning && (
            <p className="text-xs text-slate-400 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/60 italic line-clamp-3">
              "{deal.reasoning}"
            </p>
          )}
        </div>

        {/* Price and Action */}
        <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-3">
          <div>
            <div className="text-xs text-slate-500">Precio Real Detectado</div>
            <div className="text-lg font-black text-white">
              {realPrice !== null ? formatCurrency(realPrice, deal.listing.currency) : "Consultar"}
            </div>
            {deal.estimatedMarketPrice && (
              <div className="text-xs text-slate-400 line-through">
                Mercado: {formatCurrency(deal.estimatedMarketPrice, deal.listing.currency)}
              </div>
            )}
          </div>

          <a
            href={deal.listing.url}
            target="_blank"
            rel="noreferrer"
            className="bg-slate-800 hover:bg-emerald-600 text-white p-2.5 rounded-lg transition duration-200 border border-slate-700 hover:border-emerald-500 shadow-sm"
            title="Abrir en Facebook Marketplace"
            aria-label="Abrir en Facebook Marketplace"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>
    </div>
  );
}
