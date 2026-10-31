export interface SearchTarget {
  id: string;
  name: string;
  query: string;
  minPrice: number | null;
  maxPrice: number | null;
  currency: string;
  location: string;
  active: boolean;
  intervalMinutes: number;
  lastRunAt?: string | null;
  _count?: { listings: number };
}

export interface DealItem {
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

export interface DealFiltersState {
  searchQuery: string;
  selectedBrands: string[];
  minScore: number;
  minPrice: string;
  maxPrice: string;
}
