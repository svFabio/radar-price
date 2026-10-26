import { DealNotificationPayload } from "@radar/notifications";
import { RawScrapedListing } from "../analyzer/heuristic.filter.js";
import { EvaluatedSpecs } from "../analyzer/vision.analyzer.js";

export interface CandidateDeal {
  listing: RawScrapedListing;
  evaluation: EvaluatedSpecs;
}

export class DealRanker {
  /**
   * Sorts candidate deals by DealScore, clusters similar models together,
   * and returns the Top N most advantageous deals.
   */
  static selectTopDeals(candidates: CandidateDeal[], topCount: number = 5): DealNotificationPayload[] {
    // 1. Filter only items that qualify as deals
    const qualified = candidates.filter((c) => c.evaluation.isDeal || c.evaluation.dealScore >= 70);

    // 2. Sort descending by deal score
    qualified.sort((a, b) => b.evaluation.dealScore - a.evaluation.dealScore);

    // 3. Cluster and deduplicate similar hardware
    const seenClusters = new Set<string>();
    const topDeals: DealNotificationPayload[] = [];

    for (const c of qualified) {
      if (topDeals.length >= topCount) break;

      const clusterKey = this.generateClusterKey(c);
      if (seenClusters.has(clusterKey)) {
        // Already picked the best deal in this cluster/tier
        continue;
      }
      seenClusters.add(clusterKey);

      topDeals.push({
        dealTitle: `${c.evaluation.brand || ""} ${c.evaluation.model || c.listing.title}`.trim(),
        brand: c.evaluation.brand,
        model: c.evaluation.model,
        specs: {
          cpu: c.evaluation.cpu,
          ramGb: c.evaluation.ramGb,
          gpu: c.evaluation.gpu,
          storageGb: c.evaluation.storageGb,
        },
        listedPrice: c.listing.listedPrice,
        realPrice: c.evaluation.realPrice,
        estimatedMarketPrice: c.evaluation.estimatedMarketPrice,
        currency: c.listing.currency,
        dealScore: c.evaluation.dealScore,
        conditionRating: c.evaluation.conditionRating,
        reasoning: c.evaluation.reasoning,
        url: c.listing.url,
        imageUrls: c.listing.imageUrls,
        location: c.listing.location,
      });
    }

    return topDeals;
  }

  private static generateClusterKey(c: CandidateDeal): string {
    const brand = (c.evaluation.brand || "unknown").toLowerCase();
    const cpu = (c.evaluation.cpu || "unknown").toLowerCase().replace(/[^a-z0-9]/g, "");
    const gpu = (c.evaluation.gpu || "none").toLowerCase().replace(/[^a-z0-9]/g, "");
    return `${brand}-${cpu}-${gpu}`;
  }
}
