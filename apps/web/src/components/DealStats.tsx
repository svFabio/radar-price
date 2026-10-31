import { Flame, TrendingUp, ShieldCheck } from "lucide-react";
import { formatCurrency } from "../utils/formatters";

interface DealStatsProps {
  filteredCount: number;
  totalCount: number;
  accumulatedSavings: number;
  averageScore: number;
}

export function DealStats({
  filteredCount,
  totalCount,
  accumulatedSavings,
  averageScore,
}: DealStatsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {/* Stat 1: Total Deals */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center gap-4">
        <div className="p-3 bg-amber-500/10 text-amber-400 rounded-lg border border-amber-500/20">
          <Flame className="w-6 h-6" />
        </div>
        <div>
          <div className="text-xs text-slate-400 font-medium">Gangas Detectadas</div>
          <div className="text-2xl font-black text-white">
            {filteredCount}
            {filteredCount !== totalCount && (
              <span className="text-xs font-normal text-slate-500 ml-1.5">
                (de {totalCount})
              </span>
            )}
          </div>
          <div className="text-xs text-slate-500">Filtradas por IA en tiempo real</div>
        </div>
      </div>

      {/* Stat 2: Accumulated Savings */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center gap-4">
        <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20">
          <TrendingUp className="w-6 h-6" />
        </div>
        <div>
          <div className="text-xs text-slate-400 font-medium">Ahorro Estimado Acumulado</div>
          <div className="text-2xl font-black text-emerald-400">
            {formatCurrency(accumulatedSavings)}
          </div>
          <div className="text-xs text-slate-500">Bajo valor de mercado calculado</div>
        </div>
      </div>

      {/* Stat 3: Average Score */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center gap-4">
        <div className="p-3 bg-sky-500/10 text-sky-400 rounded-lg border border-sky-500/20">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <div>
          <div className="text-xs text-slate-400 font-medium">Score Promedio de Ganga</div>
          <div className="text-2xl font-black text-white">
            {averageScore > 0 ? `${averageScore}/100` : "—"}
          </div>
          <div className="text-xs text-slate-500">Confianza de arbitraje de hardware</div>
        </div>
      </div>
    </div>
  );
}
