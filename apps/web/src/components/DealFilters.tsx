import { Search, Flame, X, RotateCcw, SlidersHorizontal } from "lucide-react";
import type { DealFiltersState } from "../types";

interface DealFiltersProps {
  filters: DealFiltersState;
  onChange: (filters: DealFiltersState) => void;
  availableBrands: string[];
  onReset: () => void;
  hasActiveFilters: boolean;
}

export function DealFilters({
  filters,
  onChange,
  availableBrands,
  onReset,
  hasActiveFilters,
}: DealFiltersProps) {
  const handleScoreSelect = (score: number) => {
    onChange({
      ...filters,
      minScore: filters.minScore === score ? 0 : score,
    });
  };

  const handleBrandToggle = (brand: string) => {
    const isSelected = filters.selectedBrands.includes(brand);
    const updatedBrands = isSelected
      ? filters.selectedBrands.filter((b) => b !== brand)
      : [...filters.selectedBrands, brand];

    onChange({
      ...filters,
      selectedBrands: updatedBrands,
    });
  };

  const handleClearBrands = () => {
    onChange({
      ...filters,
      selectedBrands: [],
    });
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow-lg shadow-black/20">
      {/* Top Row: Search and Score Buttons */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={filters.searchQuery}
            onChange={(e) => onChange({ ...filters, searchQuery: e.target.value })}
            placeholder="Buscar por modelo, procesador (Ryzen, i7), GPU (RTX), o vendedor..."
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-10 pr-9 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
          />
          {filters.searchQuery && (
            <button
              onClick={() => onChange({ ...filters, searchQuery: "" })}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-0.5"
              title="Borrar búsqueda"
              aria-label="Borrar búsqueda"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Score Quick Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            Score:
          </span>
          <button
            onClick={() => handleScoreSelect(0)}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition ${
              filters.minScore === 0
                ? "bg-slate-800 text-white border-slate-600"
                : "bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-700"
            }`}
          >
            Todos
          </button>
          <button
            onClick={() => handleScoreSelect(80)}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition flex items-center gap-1 ${
              filters.minScore === 80
                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-sm"
                : "bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-700"
            }`}
          >
            &gt;80 Score
          </button>
          <button
            onClick={() => handleScoreSelect(90)}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition flex items-center gap-1 ${
              filters.minScore === 90
                ? "bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm"
                : "bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-700"
            }`}
          >
            <Flame className="w-3 h-3 text-amber-400" />
            &gt;90 Score
          </button>
        </div>

        {/* Reset Filters Button */}
        {hasActiveFilters && (
          <button
            onClick={onReset}
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 border border-rose-900/40 rounded-lg transition"
            title="Restablecer todos los filtros"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Limpiar</span>
          </button>
        )}
      </div>

      {/* Second Row: Brand Chips and Real Price Range */}
      <div className="pt-2 border-t border-slate-800/80 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Brand Chips */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-slate-400 font-medium flex items-center gap-1 mr-1">
            <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-400" />
            Marca:
          </span>
          <button
            onClick={handleClearBrands}
            className={`px-2.5 py-1 rounded-full text-xs font-medium border transition ${
              filters.selectedBrands.length === 0
                ? "bg-emerald-600 text-white border-emerald-500 shadow-sm shadow-emerald-950"
                : "bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-700"
            }`}
          >
            Todas
          </button>
          {availableBrands.map((brand) => {
            const isSelected = filters.selectedBrands.includes(brand);
            return (
              <button
                key={brand}
                onClick={() => handleBrandToggle(brand)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium border transition flex items-center gap-1.5 ${
                  isSelected
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-sm"
                    : "bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-700"
                }`}
              >
                <span>{brand}</span>
                {isSelected && <X className="w-3 h-3 text-emerald-400" />}
              </button>
            );
          })}
        </div>

        {/* Real Price Range Inputs */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-slate-400 font-medium">Precio Real (BOB):</span>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              placeholder="Mín"
              min="0"
              value={filters.minPrice}
              onChange={(e) => onChange({ ...filters, minPrice: e.target.value })}
              className="w-20 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
            />
            <span className="text-slate-600 text-xs">—</span>
            <input
              type="number"
              placeholder="Máx"
              min="0"
              value={filters.maxPrice}
              onChange={(e) => onChange({ ...filters, maxPrice: e.target.value })}
              className="w-20 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
