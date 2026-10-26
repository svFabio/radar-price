import { useState, useEffect } from "react";
import { Radar, Search, Plus, ExternalLink, Cpu, HardDrive, ShieldCheck, Flame, Trash2, RefreshCw } from "lucide-react";

interface SearchTarget {
  id: string;
  name: string;
  query: string;
  minPrice: number | null;
  maxPrice: number | null;
  currency: string;
  location: string;
  active: boolean;
  intervalMinutes: number;
  _count?: { listings: number };
}

interface DealItem {
  id: string;
  brand: string | null;
  model: string | null;
  cpu: string | null;
  ramGb: number | null;
  gpu: string | null;
  storageGb: number | null;
  realPrice: number | null;
  estimatedMarketPrice: number | null;
  conditionRating: number | null;
  dealScore: number;
  reasoning: string | null;
  listing: {
    id: string;
    title: string;
    listedPrice: number | null;
    currency: string;
    url: string;
    imageUrls: string[];
    location: string | null;
  };
}

export default function App() {
  const [targets, setTargets] = useState<SearchTarget[]>([]);
  const [deals, setDeals] = useState<DealItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);

  // New Target Form State
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [location, setLocation] = useState("La Paz, Bolivia");

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
          active: true,
          intervalMinutes: 120,
          _count: { listings: 22 },
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
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateTarget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !query) return;

    try {
      await fetch("/api/targets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          query,
          minPrice: minPrice ? parseFloat(minPrice) : null,
          maxPrice: maxPrice ? parseFloat(maxPrice) : null,
          location,
        }),
      });
      setName("");
      setQuery("");
      setMinPrice("");
      setMaxPrice("");
      setShowAddModal(false);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteTarget = async (id: string) => {
    try {
      await fetch(`/api/targets/${id}`, { method: "DELETE" });
      setTargets(targets.filter((t) => t.id !== id));
    } catch (err) {
      console.error(err);
    }
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
        {/* Section 1: Search Targets Manager (US-6.1) */}
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
              {targets.length} {targets.length === 1 ? "búsqueda activa" : "búsquedas activas"}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {targets.map((target) => (
              <div
                key={target.id}
                className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between">
                    <h3 className="font-semibold text-white text-base">{target.name}</h3>
                    <button
                      onClick={() => handleDeleteTarget(target.id)}
                      className="text-slate-500 hover:text-rose-400 transition p-1"
                      title="Eliminar campaña"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="text-xs text-emerald-400 font-mono bg-emerald-950/40 border border-emerald-800/40 rounded px-2 py-1 inline-block">
                    query: "{target.query}"
                  </div>
                  <div className="text-xs text-slate-400 flex items-center gap-4 pt-1">
                    <span>
                      Presupuesto: {target.minPrice ?? 0} - {target.maxPrice ?? "∞"} {target.currency}
                    </span>
                    <span>📍 {target.location}</span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-500">
                  <span>Barrido cada {target.intervalMinutes}m</span>
                  <span className="text-slate-400">{target._count?.listings ?? 0} publicaciones analizadas</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Section 2: Top Deals Arbitrage Feed (US-6.2) */}
        <section className="space-y-4">
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

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {deals.map((deal) => {
              const savings =
                deal.estimatedMarketPrice && deal.realPrice
                  ? Math.round(((deal.estimatedMarketPrice - deal.realPrice) / deal.estimatedMarketPrice) * 100)
                  : null;

              return (
                <div
                  key={deal.id}
                  className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden hover:border-emerald-500/50 transition flex flex-col group shadow-lg shadow-black/40"
                >
                  {/* Photo & Badge */}
                  <div className="relative aspect-video bg-slate-950 overflow-hidden">
                    <img
                      src={deal.listing.imageUrls[0] || "https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=600"}
                      alt={deal.listing.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
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
                          {deal.brand || "Laptop"}
                        </span>
                        <h3 className="text-base font-bold text-white line-clamp-1">
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
                        <p className="text-xs text-slate-400 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/60 italic">
                          "{deal.reasoning}"
                        </p>
                      )}
                    </div>

                    {/* Price and Action */}
                    <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                      <div>
                        <div className="text-xs text-slate-500">Precio Real Detectado</div>
                        <div className="text-lg font-black text-white">
                          {deal.realPrice ?? deal.listing.listedPrice ?? "Consultar"} {deal.listing.currency}
                        </div>
                      </div>

                      <a
                        href={deal.listing.url}
                        target="_blank"
                        rel="noreferrer"
                        className="bg-slate-800 hover:bg-emerald-600 text-white p-2.5 rounded-lg transition duration-200 border border-slate-700 hover:border-emerald-500"
                        title="Abrir en Facebook Marketplace"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      {/* Modal: New Target (US-6.1) */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-lg flex items-center gap-2">
                <Search className="w-5 h-5 text-emerald-400" />
                Nueva Búsqueda en Marketplace
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white text-xl leading-none"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateTarget} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Nombre de la Campaña</label>
                <input
                  type="text"
                  required
                  placeholder="ej. Laptops Gaming Económicas"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Término de Búsqueda (Query)</label>
                <input
                  type="text"
                  required
                  placeholder="ej. laptop gamer rtx"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Precio Mín (BOB)</label>
                  <input
                    type="number"
                    placeholder="ej. 2000"
                    value={minPrice}
                    onChange={(e) => setMinPrice(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Precio Máx (BOB)</label>
                  <input
                    type="number"
                    placeholder="ej. 5000"
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Ciudad / Ubicación</label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-sm text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg transition"
                >
                  Guardar Búsqueda
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
