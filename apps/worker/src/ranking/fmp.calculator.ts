/**
 * Fair Market Price (FMP) and Arbitrage Calculator
 * 
 * Computes deterministic historical medians from past database listings
 * for equivalent hardware tiers, avoiding LLM valuation hallucinations.
 */

export interface FmpResult {
  medianPrice: number;
  sampleCount: number;
  isStatistical: boolean;
}

export class FmpCalculator {
  /**
   * Computes the statistical median price from historical observations.
   * Discards 0 or negative prices.
   */
  static calculateMedian(prices: number[]): number | null {
    const validPrices = prices.filter((p) => typeof p === "number" && p > 0).sort((a, b) => a - b);
    if (validPrices.length === 0) return null;

    const mid = Math.floor(validPrices.length / 2);
    if (validPrices.length % 2 === 0) {
      return (validPrices[mid - 1] + validPrices[mid]) / 2;
    }
    return validPrices[mid];
  }

  /**
   * Resolves the authoritative Fair Market Price:
   * - Uses historical median if at least `minSamples` (default: 3) exist.
   * - Otherwise falls back to LLM estimated market price.
   */
  static resolveFmp(
    historicalPrices: number[] = [],
    llmEstimatedPrice?: number | null,
    minSamples: number = 3
  ): FmpResult {
    const valid = historicalPrices.filter((p) => typeof p === "number" && p > 0);
    if (valid.length >= minSamples) {
      const median = this.calculateMedian(valid);
      if (median !== null) {
        return {
          medianPrice: Math.round(median),
          sampleCount: valid.length,
          isStatistical: true,
        };
      }
    }

    const fallback = llmEstimatedPrice && llmEstimatedPrice > 0 ? Math.round(llmEstimatedPrice) : 0;
    return {
      medianPrice: fallback,
      sampleCount: valid.length,
      isStatistical: false,
    };
  }

  /**
   * Calculates Deal Score based on architectural formula:
   * DealScore = ((FMP - RealPrice) / FMP) * 100 * ConditionFactor
   * 
   * Condition rating (1-10) scales the condition factor:
   * 10 = 1.0, 8 = 0.9, 5 = 0.75, etc.
   */
  static calculateDealScore(
    fairMarketPrice: number,
    realPrice: number,
    conditionRating?: number | null
  ): number {
    if (!fairMarketPrice || fairMarketPrice <= 0 || !realPrice || realPrice <= 0) {
      return 0;
    }

    // Condition factor scales between 0.6 (poor) and 1.0 (mint)
    const rating = conditionRating && conditionRating >= 1 && conditionRating <= 10 ? conditionRating : 7;
    const conditionFactor = 0.6 + (rating / 10) * 0.4;

    const discountPercentage = ((fairMarketPrice - realPrice) / fairMarketPrice) * 100;
    const rawScore = discountPercentage * conditionFactor;

    // Clamped between 0 and 100
    return Math.max(0, Math.min(100, Math.round(rawScore)));
  }
}
