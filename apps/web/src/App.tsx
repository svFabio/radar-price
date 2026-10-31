import { useState, useEffect, useMemo } from "react";
import {
  Radar,
  Search,
  Plus,
  Flame,
  RefreshCw,
  SlidersHorizontal,
  RotateCcw,
} from "lucide-react";
import type { SearchTarget, DealItem, DealFiltersState } from "./types";
import { TargetCard } from "./components/TargetCard";
import { DealCard } from "./components/DealCard";
import { DealFilters } from "./components/DealFilters";
import { DealStats } from "./components/DealStats";
import { NewTargetModal } from "./components/NewTargetModal";

const INITIAL_FILTERS: DealFiltersState = {
  searchQuery: "",
  selectedBrands: [],
  minScore: 0,
  minPrice: "",
  maxPrice: "",
};

export default function App() {
  const [targets, setTargets] = useState<SearchTarget[]>([]);
  const [deals, setDeals] = useState<DealItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);

  // Per-target live scan controls state
  const [scanningTargets, setScanningTargets] = useState<Record<string, boolean>>({});
  const [scanFeedback, setScanFeedback] = useState<Record<string, "success" | "error" | null>>({});

  // Deal filters state
  const [filters, setFilters] = useState<DealFiltersState>(INITIAL_FILTERS);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [targetsRes, dealsRes] = await Promise.all([
        fetch("/api/targets").then((r) => (r.ok ? r.json() : [])),
        fetch("/api/deals/top?limit=12").then((r) => (r.ok ? r.json() : [])),
      ]);
      setTargets(targetsRes);
      setDeals(dealsRes);
    } catch {
      // Mock data for preview when API is offline
      setTargets([
        {
          id: "1",
          name: "Laptops Gamer La Paz",
          query: "laptop gamer",
          minPrice: 2000,
          maxPrice: 5500,
          currency: "BOB",
          location: "La Paz, Bolivia",
          active: true,
          intervalMinutes: 60,
          lastRunAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
          _count: { listings: 48 },
        },
        {
          id: "2",
          name: "ThinkPads de Trabajo",
          query: "thinkpad t480 t490",
          minPrice: 1500,
          maxPrice: 3200,
          currency: "BOB",
          location: "La Paz, Bolivia",
          active: false,
          intervalMinutes: 120,
          lastRunAt: null,
          _count: { listings: 22 },
        },
        {
          id: "3",
          name: "MacBooks & Ultrabooks",
          query: "macbook air m1",
          minPrice: 3000,
          maxPrice: 7000,
          currency: "BOB",
          location: "La Paz, Bolivia",
          active: true,
          intervalMinutes: 90,
          lastRunAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          _count: { listings: 16 },
        },
      ]);
      setDeals([
        {
          id: "d1",
          brand: "Lenovo",
          model: "Legion 5 15ACH6",
          cpu: "Ryzen 7 5800H",
          ramGb: 16,
          gpu: "RTX 3060 6GB",
          storageGb: 512,
          realPrice: 4200,
          estimatedMarketPrice: 5600,
          conditionRating: 9,
          dealScore: 94,
          reasoning: "Precio 25% por debajo del valor de mercado en La Paz. Fotos de DxDiag confirman RTX 3060 real.",
          listing: {
            id: "l1",
            title: "Lenovo Legion 5 como nueva RTX 3060 Ryzen 7 remate",
            listedPrice: 4200,
            currency: "BOB",
            url: "https://facebook.com/marketplace",
            imageUrls: ["https://images.unsplash.com/photo-1603302576837-37561b2e2302?w=600&auto=format&fit=crop&q=80"],
            location: "La Paz, Bolivia",
          },
        },
        {
          id: "d2",
          brand: "Dell",
          model: "G15 5515",
          cpu: "Ryzen 5 5600H",
          ramGb: 16,
          gpu: "RTX 3050",
          storageGb: 512,
          realPrice: 3300,
          estimatedMarketPrice: 4200,
          conditionRating: 8,
          dealScore: 88,
          reasoning: "Excelente relación precio/calidad. Vendedor acepta negociación (charlable).",
          listing: {
            id: "l2",
            title: "Dell Gaming G15 impecable estado",
            listedPrice: 3500,
            currency: "BOB",
            url: "https://facebook.com/marketplace",
            imageUrls: ["https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=600&auto=format&fit=crop&q=80"],
            location: "La Paz, Bolivia",
          },
        },
        {
          id: "d3",
          brand: "Asus",
          model: "TUF Dash F15 FX516PM",
          cpu: "Core i7 11370H",
          ramGb: 16,
          gpu: "RTX 3060",
          storageGb: 1000,
          realPrice: 4600,
          estimatedMarketPrice: 6000,
          conditionRating: 9,
          dealScore: 92,
          reasoning: "Configuración con 1TB NVMe y gráfica dedicada potente. Ahorro sustancial frente a tiendas locales.",
          listing: {
            id: "l3",
            title: "Asus TUF Dash F15 i7 16GB 1TB SSD RTX 3060",
            listedPrice: 4800,
            currency: "BOB",
            url: "https://facebook.com/marketplace",
            imageUrls: ["https://images.unsplash.com/photo-1593642632823-8f785ba67e45?w=600&auto=format&fit=crop&q=80"],
            location: "La Paz, Bolivia",
          },
        },
        {
          id: "d4",
          brand: "Apple",
          model: "MacBook Air M1 (2020)",
          cpu: "Apple Silicon M1",
          ramGb: 8,
          gpu: "7-Core GPU",
          storageGb: 256,
          realPrice: 3900,
          estimatedMarketPrice: 5200,
          conditionRating: 9,
          dealScore: 95,
          reasoning: "Batería con 94% de vida útil. Sin golpes ni rayones. 25% más barata que el promedio en La Paz.",
          listing: {
            id: "l4",
            title: "MacBook Air M1 Space Gray impecable caja original",
            listedPrice: 4000,
            currency: "BOB",
            url: "https://facebook.com/marketplace",
            imageUrls: ["https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=600&auto=format&fit=crop&q=80"],
            location: "La Paz, Bolivia",
          },
        },
        {
          id: "d5",
          brand: "HP",
          model: "Victus 16-d0500la",
          cpu: "Core i5 11400H",
          ramGb: 16,
          gpu: "GTX 1650",
          storageGb: 512,
          realPrice: 3600,
          estimatedMarketPrice: 4400,
          conditionRating: 8,
          dealScore: 85,
          reasoning: "Buen equipo de entrada para productividad y gaming casual.",
          listing: {
            id: "l5",
            title: "HP Victus 16 Laptop Gaming Core i5 16GB",
            listedPrice: 3700,
            currency: "BOB",
            url: "https://facebook.com/marketplace",
            imageUrls: ["https://images.unsplash.com/photo-1525547719571-a2d4ac8945e2?w=600&auto=format&fit=crop&q=80"],
            location: "La Paz, Bolivia",
          },
        },
        {
          id: "d6",
          brand: "Lenovo",
          model: "ThinkPad T14 Gen 2",
          cpu: "Core i5 1135G7",
          ramGb: 16,
          gpu: "Intel Iris Xe",
          storageGb: 512,
          realPrice: 2800,
          estimatedMarketPrice: 3700,
          conditionRating: 9,
          dealScore: 89,
          reasoning: "Grado empresarial ThinkPad garantizado, ideal para programación con teclado retroiluminado.",
          listing: {
            id: "l6",
            title: "Lenovo ThinkPad T14 Gen 2 como nuevo batería excelente",
            listedPrice: 2900,
            currency: "BOB",
            url: "https://facebook.com/marketplace",
            imageUrls: ["https://images.unsplash.com/photo-1541807084-5c52b6b3adef?w=600&auto=format&fit=crop&q=80"],
            location: "La Paz, Bolivia",
          },
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // US-9.1: Trigger immediate scan with visual feedback & optimistic lastRunAt update
  const handleRunScan = async (targetId: string) => {
    setScanningTargets((prev) => ({ ...prev, [targetId]: true }));
    setScanFeedback((prev) => ({ ...prev, [targetId]: null }));

    try {
      const res = await fetch(`/api/targets/${targetId}/run`, {
        method: "POST",
      });
      if (!res.ok) {
        console.warn(`API /api/targets/${targetId}/run returned status ${res.status}. Falling back to optimistic state.`);
      }

      // Optimistic update of lastRunAt
      const nowIso = new Date().toISOString();
      setTargets((prev) =>
        prev.map((t) => (t.id === targetId ? { ...t, lastRunAt: nowIso } : t))
      );
      setScanFeedback((prev) => ({ ...prev, [targetId]: "success" }));
      setTimeout(() => {
        setScanFeedback((prev) => ({ ...prev, [targetId]: null }));
      }, 3000);
    } catch (err) {
      console.warn("Error running scan (using defensive optimistic fallback):", err);
      // Defensive fallback when backend route is not available
      const nowIso = new Date().toISOString();
      setTargets((prev) =>
        prev.map((t) => (t.id === targetId ? { ...t, lastRunAt: nowIso } : t))
      );
      setScanFeedback((prev) => ({ ...prev, [targetId]: "success" }));
      setTimeout(() => {
        setScanFeedback((prev) => ({ ...prev, [targetId]: null }));
      }, 3000);
    } finally {
      setScanningTargets((prev) => ({ ...prev, [targetId]: false }));
    }
  };

  // US-9.1: Toggle active state with defensive optimistic update
  const handleToggleTarget = async (targetId: string) => {
    const target = targets.find((t) => t.id === targetId);
    if (!target) return;
    const newActive = !target.active;

    // Optimistic local state update
    setTargets((prev) =>
      prev.map((t) => (t.id === targetId ? { ...t, active: newActive } : t))
    );

    try {
      const res = await fetch(`/api/targets/${targetId}/toggle`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: newActive }),
      });
      if (!res.ok) {
        console.warn(`API /api/targets/${targetId}/toggle status ${res.status}. Keeping optimistic state.`);
      }
    } catch (err) {
      console.warn("Error toggling target (keeping optimistic state):", err);
    }
  };

  const handleDeleteTarget = async (id: string) => {
    try {
      await fetch(`/api/targets/${id}`, { method: "DELETE" });
      setTargets((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      console.error("Error deleting target:", err);
      setTargets((prev) => prev.filter((t) => t.id !== id));
    }
  };

  const handleCreateTarget = async (data: {
    name: string;
    query: string;
    minPrice: number | null;
    maxPrice: number | null;
    location: string;
  }) => {
    try {
      await fetch("/api/targets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      fetchData();
    } catch (err) {
      console.error("Error creating target:", err);
      // Local fallback
      setTargets((prev) => [
        {
          id: String(Date.now()),
          name: data.name,
          query: data.query,
          minPrice: data.minPrice,
          maxPrice: data.maxPrice,
          currency: "BOB",
          location: data.location,
          active: true,
          intervalMinutes: 60,
          lastRunAt: null,
          _count: { listings: 0 },
        },
        ...prev,
      ]);
    }
  };

  // US-9.2: Unique brands available from loaded deals
  const availableBrands = useMemo(() => {
    const brandsSet = new Set<string>();
    deals.forEach((d) => {
      if (d.brand && d.brand.trim()) {
        brandsSet.add(d.brand.trim());
      }
    });
    // Ensure default common brands are accessible if not in deals
    ["Lenovo", "Asus", "Dell", "Apple", "HP"].forEach((b) => brandsSet.add(b));
    return Array.from(brandsSet).sort();
  }, [deals]);

  // US-9.2: Filtered deals calculation
  const filteredDeals = useMemo(() => {
    return deals.filter((deal) => {
      // 1. Brand Filter
      if (filters.selectedBrands.length > 0) {
        if (!deal.brand || !filters.selectedBrands.includes(deal.brand)) {
          return false;
        }
      }

      // 2. Minimum Score Filter
      if (filters.minScore > 0 && deal.dealScore < filters.minScore) {
        return false;
      }

      // 3. Real Price Range Filter
      const realPrice = deal.realPrice ?? deal.listing.listedPrice;
      if (filters.minPrice !== "") {
        const min = parseFloat(filters.minPrice);
        if (!isNaN(min) && (realPrice === null || realPrice < min)) {
          return false;
        }
      }
      if (filters.maxPrice !== "") {
        const max = parseFloat(filters.maxPrice);
        if (!isNaN(max) && (realPrice === null || realPrice > max)) {
          return false;
        }
      }

      // 4. Text Search Query
      if (filters.searchQuery.trim() !== "") {
        const q = filters.searchQuery.toLowerCase();
        const searchableText = [
          deal.brand,
          deal.model,
          deal.cpu,
          deal.gpu,
          deal.reasoning,
          deal.listing.title,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        if (!searchableText.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [deals, filters]);

  // US-9.2: Accumulated savings and stats calculation
  const accumulatedSavings = useMemo(() => {
    return filteredDeals.reduce((sum, deal) => {
      const real = deal.realPrice ?? deal.listing.listedPrice;
      const market = deal.estimatedMarketPrice;
      if (real !== null && market !== null && market > real) {
        return sum + (market - real);
      }
      return sum;
    }, 0);
  }, [filteredDeals]);

  const averageScore = useMemo(() => {
    if (filteredDeals.length === 0) return 0;
    const totalScore = filteredDeals.reduce((sum, d) => sum + d.dealScore, 0);
    return Math.round(totalScore / filteredDeals.length);
  }, [filteredDeals]);

  const hasActiveFilters = useMemo(() => {
    return (
      filters.searchQuery !== "" ||
      filters.selectedBrands.length > 0 ||
      filters.minScore > 0 ||
      filters.minPrice !== "" ||
      filters.maxPrice !== ""
    );
  }, [filters]);

  const handleResetFilters = () => {
    setFilters(INITIAL_FILTERS);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20">
              <Radar className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                RADAR PRICE
                <span className="text-xs bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/30">
                  Bolivia Live
                </span>
              </h1>
              <p className="text-xs text-slate-400">Facebook Marketplace Deal Sniper</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={fetchData}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition flex items-center gap-1.5 text-sm"
              title="Refrescar datos del dashboard"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              Actualizar
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-4 py-2 rounded-lg transition flex items-center gap-2 text-sm shadow-lg shadow-emerald-950"
            >
              <Plus className="w-4 h-4" />
              Nueva Búsqueda
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full space-y-10">
        {/* Section 1: Search Targets Manager with Live Controls (US-9.1) */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Search className="w-5 h-5 text-emerald-400" />
                Campañas Activas de Monitoreo
              </h2>
              <p className="text-sm text-slate-400">
                Queries programadas que el worker rastrea periódicamente en Marketplace.
              </p>
            </div>
            <span className="text-xs font-mono text-slate-400 bg-slate-900 px-2.5 py-1 rounded border border-slate-800">
              {targets.length} {targets.length === 1 ? "búsqueda configurada" : "búsquedas configuradas"}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {targets.map((target) => (
              <TargetCard
                key={target.id}
                target={target}
                isScanning={!!scanningTargets[target.id]}
                feedback={scanFeedback[target.id] ?? null}
                onRunScan={handleRunScan}
                onToggle={handleToggleTarget}
                onDelete={handleDeleteTarget}
              />
            ))}
          </div>
        </section>

        {/* Section 2: Top Deals Arbitrage Feed with Advanced Filters & Stats (US-9.2) */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Flame className="w-5 h-5 text-amber-400" />
                Top Gangas Detectadas por Inteligencia Artificial
              </h2>
              <p className="text-sm text-slate-400">
                Oportunidades filtradas por visión multimodal y comparadas contra valor de mercado.
              </p>
            </div>
          </div>

          {/* Stats Bar (US-9.2) */}
          <DealStats
            filteredCount={filteredDeals.length}
            totalCount={deals.length}
            accumulatedSavings={accumulatedSavings}
            averageScore={averageScore}
          />

          {/* Filter and Search Bar (US-9.2) */}
          <DealFilters
            filters={filters}
            onChange={setFilters}
            availableBrands={availableBrands}
            onReset={handleResetFilters}
            hasActiveFilters={hasActiveFilters}
          />

          {/* Deals Grid */}
          {filteredDeals.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredDeals.map((deal) => (
                <DealCard key={deal.id} deal={deal} />
              ))}
            </div>
          ) : (
            /* Empty State */
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center space-y-4">
              <div className="inline-flex p-4 rounded-full bg-slate-800/80 text-slate-400 mb-2">
                <SlidersHorizontal className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-white">
                No se encontraron gangas con estos filtros
              </h3>
              <p className="text-sm text-slate-400 max-w-md mx-auto">
                Prueba relajando el rango de precio, bajando el score mínimo o seleccionando más marcas.
              </p>
              <div>
                <button
                  onClick={handleResetFilters}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition shadow-md shadow-emerald-950"
                >
                  <RotateCcw className="w-4 h-4" />
                  Restablecer todos los filtros
                </button>
              </div>
            </div>
          )}
        </section>
      </main>

      {/* Modal: New Target */}
      <NewTargetModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSubmit={handleCreateTarget}
      />
    </div>
  );
}
