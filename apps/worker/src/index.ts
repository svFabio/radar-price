import "dotenv/config";
import { PlaywrightMarketplaceScraper } from "./scraper/playwright.scraper.js";
import { HeuristicFilter, RawScrapedListing } from "./analyzer/heuristic.filter.js";
import { VisionAnalyzer } from "./analyzer/vision.analyzer.js";
import { DealRanker, CandidateDeal } from "./ranking/deal.ranker.js";
import { TelegramNotificationProvider } from "@radar/notifications";

async function runWorker() {
  console.log("==========================================");
  console.log("🚀 RADAR PRICE — Facebook Marketplace Deal Sniper");
  console.log("==========================================");

  const query = process.env.SEARCH_QUERY || "laptop gamer";
  const city = process.env.DEFAULT_CITY || "La Paz";
  const minPrice = process.env.MIN_PRICE ? parseFloat(process.env.MIN_PRICE) : 1500;
  const maxPrice = process.env.MAX_PRICE ? parseFloat(process.env.MAX_PRICE) : 6000;
  const headless = process.env.HEADLESS !== "false";

  console.log(`[Config] Query: "${query}" | City: ${city} | Price: ${minPrice}-${maxPrice} BOB | Headless: ${headless}`);

  const scraper = new PlaywrightMarketplaceScraper();
  const vision = new VisionAnalyzer();
  const telegram = new TelegramNotificationProvider({
    botToken: process.env.TELEGRAM_BOT_TOKEN || "",
    chatId: process.env.TELEGRAM_CHAT_ID || "",
  });

  try {
    await scraper.init(headless);

    // 1. Scrape raw listings
    console.log(`[Pipeline] Step 1: Scraping Marketplace listings...`);
    const rawListings = await scraper.scrapeSearch({
      query,
      city,
      minPrice,
      maxPrice,
      limit: 20,
    });

    console.log(`[Pipeline] Found ${rawListings.length} total raw listings.`);

    // 2. Tier-1 Heuristic Filtering
    console.log(`[Pipeline] Step 2: Running Tier-1 heuristic filtering...`);
    const passedListings: RawScrapedListing[] = [];
    for (const listing of rawListings) {
      const { pass, reason } = HeuristicFilter.evaluate(listing, {
        minPrice,
        maxPrice,
        keywordsExclude: ["repuesto", "pieza", "pantalla rota"],
      });

      if (pass) {
        passedListings.push(listing);
      } else {
        console.log(`  ↪ [Discarded] "${listing.title}" - ${reason}`);
      }
    }

    console.log(`[Pipeline] ${passedListings.length}/${rawListings.length} passed heuristic filters.`);

    // 3. Multimodal Vision Analysis (Tier-2)
    console.log(`[Pipeline] Step 3: Running Multimodal AI Vision Analysis...`);
    const candidates: CandidateDeal[] = [];

    for (const listing of passedListings) {
      console.log(`  🔍 Analyzing: "${listing.title}" (Listed: ${listing.listedPrice ?? "N/A"} BOB)...`);
      const evaluation = await vision.analyze(listing);
      console.log(`     Score: ${evaluation.dealScore}/100 | IsDeal: ${evaluation.isDeal} | Specs: ${evaluation.cpu || "N/A"} / ${evaluation.ramGb || "N/A"}GB`);
      candidates.push({ listing, evaluation });
    }

    // 4. Clustering & Top 5 Selection
    console.log(`[Pipeline] Step 4: Clustering & Ranking Top Deals...`);
    const topDeals = DealRanker.selectTopDeals(candidates, 5);
    console.log(`[Pipeline] Selected ${topDeals.length} Top Deals.`);

    // 5. Send Alert / Digest
    if (topDeals.length > 0) {
      console.log(`[Pipeline] Step 5: Dispatching notification to Telegram...`);
      const digestResult = await telegram.sendDailyDigest(topDeals);
      if (digestResult.success) {
        console.log("✅ Successfully sent Telegram Top Deals Digest!");
      } else {
        console.log(`⚠️ Telegram notification skipped/failed: ${digestResult.error}`);
      }
    } else {
      console.log("ℹ️ No outstanding deals met the threshold on this run.");
    }
  } catch (err) {
    console.error("❌ Fatal error in worker execution:", err);
  } finally {
    await scraper.close();
    console.log("🏁 Worker pass completed.");
  }
}

runWorker();
