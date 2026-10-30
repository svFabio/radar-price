import { Clock, Trash2, Play, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import type { SearchTarget } from "../types";
import { formatRelativeTime } from "../utils/formatters";

interface TargetCardProps {
  target: SearchTarget;
  isScanning: boolean;
  feedback: "success" | "error" | null;
  onRunScan: (id: string) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}

export function TargetCard({
  target,
  isScanning,
  feedback,
  onRunScan,
  onToggle,
  onDelete,
}: TargetCardProps) {
  const relativeTime = formatRelativeTime(target.lastRunAt);
  const isPending = relativeTime === "Pendiente";

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition flex flex-col justify-between space-y-4">
      {/* Top Header */}
      <div className="space-y-2.5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <h3 className="font-semibold text-white text-base leading-tight">{target.name}</h3>
            {/* Toggle switch */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                role="switch"
                aria-checked={target.active}
                aria-label={target.active ? "Pausar campaña" : "Activar campaña"}
                onClick={() => onToggle(target.id)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-slate-900 ${
                  target.active ? "bg-emerald-600" : "bg-slate-700"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                    target.active ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </button>
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
                  target.active
                    ? "bg-emerald-950/60 text-emerald-400 border-emerald-800/40"
                    : "bg-slate-800 text-slate-400 border-slate-700"
                }`}
              >
                {target.active ? "Activa" : "Pausada"}
              </span>
            </div>
          </div>

          <button
            onClick={() => onDelete(target.id)}
            className="text-slate-500 hover:text-rose-400 transition p-1 rounded hover:bg-slate-800"
            title="Eliminar campaña"
            aria-label="Eliminar campaña"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {/* Query */}
        <div className="text-xs text-emerald-400 font-mono bg-emerald-950/40 border border-emerald-800/40 rounded px-2.5 py-1 inline-block">
          query: "{target.query}"
        </div>

        {/* Details & Location */}
        <div className="text-xs text-slate-400 flex flex-wrap items-center gap-3 pt-1">
          <span>
            Presupuesto: {target.minPrice ?? 0} - {target.maxPrice ?? "∞"} {target.currency}
          </span>
          <span>📍 {target.location}</span>
        </div>

        {/* Relative Last Run Indicator */}
        <div className="pt-1">
          <div
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border ${
              isPending
                ? "bg-amber-950/30 text-amber-300 border-amber-800/40"
                : "bg-slate-800/80 text-slate-300 border-slate-700/60"
            }`}
          >
            <Clock className={`w-3.5 h-3.5 ${isPending ? "text-amber-400" : "text-emerald-400"}`} />
            <span>Última ejecución:</span>
            <span className="font-semibold text-white">{relativeTime}</span>
          </div>
        </div>
      </div>

      {/* Footer / Controls */}
      <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between gap-2 text-xs">
        <div className="text-slate-500 flex flex-col">
          <span>Barrido cada {target.intervalMinutes}m</span>
          <span className="text-slate-400">{target._count?.listings ?? 0} analizadas</span>
        </div>

        {/* Scan Now Button */}
        <div>
          {feedback === "success" ? (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-lg text-xs font-semibold animate-pulse">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              ¡Barrido enviado!
            </div>
          ) : feedback === "error" ? (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/20 text-rose-300 border border-rose-500/40 rounded-lg text-xs font-semibold">
              <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
              Fallo al escanear
            </div>
          ) : (
            <button
              onClick={() => onRunScan(target.id)}
              disabled={isScanning}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition shadow-sm ${
                isScanning
                  ? "bg-slate-800 text-slate-400 cursor-not-allowed border border-slate-700"
                  : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950 hover:shadow-emerald-900 border border-emerald-500/50"
              }`}
              title="Forzar barrido inmediato de Marketplace"
            >
              {isScanning ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                  <span>Escaneando...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Escanear Ahora</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
