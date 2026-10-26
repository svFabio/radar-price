export interface RawScrapedListing {
  fbItemId: string;
  title: string;
  listedPrice?: number | null;
  currency: string;
  url: string;
  imageUrls: string[];
  location?: string | null;
}

export interface HeuristicRuleOptions {
  minPrice?: number | null;
  maxPrice?: number | null;
  keywordsInclude?: string[];
  keywordsExclude?: string[];
}

export class HeuristicFilter {
  // Common terms indicating buyer intent instead of seller intent
  private static readonly BUYER_INTENT_PATTERNS = [
    /\bbusco\b/i,
    /\bcompro\b/i,
    /\bse busca\b/i,
    /\balguien vende\b/i,
    /\bnecesito\b/i,
  ];

  // Common terms indicating junk or accessories instead of actual working laptops
  private static readonly JUNK_PATTERNS = [
    /\bpara repuesto/i,
    /\bpara piezas\b/i,
    /\bchatarra\b/i,
    /\bbloquead[ao]\b/i,
    /\biclou[d]?\b/i,
    /\bfunda\b/i,
    /\bcargador\b/i,
    /\bmochila\b/i,
    /\bteclado\b/i,
    /\bmouse\b/i,
    /\bsoporte\b/i,
    /\bcooler\b/i,
    /\bpantalla rota\b/i,
  ];

  static evaluate(listing: RawScrapedListing, options: HeuristicRuleOptions = {}): { pass: boolean; reason?: string } {
    const titleLower = listing.title.toLowerCase();

    // 1. Filter out buyer requests ("busco laptop", "compro")
    for (const pattern of this.BUYER_INTENT_PATTERNS) {
      if (pattern.test(titleLower)) {
        return { pass: false, reason: `Ignored: Buyer request pattern matched (${pattern.source})` };
      }
    }

    // 2. Filter out junk/accessories
    for (const pattern of this.JUNK_PATTERNS) {
      if (pattern.test(titleLower)) {
        return { pass: false, reason: `Ignored: Junk or accessory pattern matched (${pattern.source})` };
      }
    }

    // 3. User-defined exclusion keywords
    if (options.keywordsExclude && options.keywordsExclude.length > 0) {
      for (const kw of options.keywordsExclude) {
        if (titleLower.includes(kw.toLowerCase())) {
          return { pass: false, reason: `Ignored: Excluded keyword '${kw}' present in title` };
        }
      }
    }

    // 4. User-defined mandatory keywords
    if (options.keywordsInclude && options.keywordsInclude.length > 0) {
      const hasAny = options.keywordsInclude.some((kw) => titleLower.includes(kw.toLowerCase()));
      if (!hasAny) {
        return { pass: false, reason: `Ignored: Missing mandatory keywords (${options.keywordsInclude.join(", ")})` };
      }
    }

    // 5. Price bounds: if listedPrice is known and > maxPrice (with 20% margin for negotiable pricing)
    if (listing.listedPrice && options.maxPrice && listing.listedPrice > options.maxPrice * 1.2) {
      return { pass: false, reason: `Ignored: Price ${listing.listedPrice} exceeds max budget ${options.maxPrice}` };
    }

    return { pass: true };
  }
}
