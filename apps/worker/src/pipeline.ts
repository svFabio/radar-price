import { prisma as defaultPrisma, SearchTarget } from "@radar/database";
import { PlaywrightMarketplaceScraper } from "./scraper/playwright.scraper.js";
import { HeuristicFilter, RawScrapedListing } from "./analyzer/heuristic.filter.js";
import { VisionAnalyzer, EvaluatedSpecs } from "./analyzer/vision.analyzer.js";
import { DealRanker, CandidateDeal } from "./ranking/deal.ranker.js";
import { TelegramNotificationProvider, WhatsAppNotificationProvider, NotificationProvider } from "@radar/notifications";

export interface CandidateWithDb extends CandidateDeal {
  listingId: string;
}

export type ChannelProvider = Pick<NotificationProvider, "sendDailyDigest"> & { channelName?: string };

export interface PipelineDependencies {
  prisma?: any;
  scraper?: Pick<PlaywrightMarketplaceScraper, "init" | "scrapeSearch" | "close">;
  vision?: Pick<VisionAnalyzer, "analyze">;
  telegram?: ChannelProvider;
  whatsapp?: ChannelProvider;
  providers?: ChannelProvider[];
}

export interface TargetProcessSummary {
  rawCount: number;
  passedHeuristicsCount: number;
  reusedEvaluationsCount: number;
  newEvaluationsCount: number;
  dispatchedAlertsCount: number;
}

export class WorkerPipeline {
  private prisma: any;
  private scraper: Pick<PlaywrightMarketplaceScraper, "init" | "scrapeSearch" | "close">;
  private vision: Pick<VisionAnalyzer, "analyze">;
  private providers: Array<{ sendDailyDigest: (deals: any[]) => Promise<{ success: boolean; error?: string }>; channelName: string }>;

  constructor(deps: PipelineDependencies = {}) {
    this.prisma = deps.prisma ?? defaultPrisma;
    this.scraper = deps.scraper ?? new PlaywrightMarketplaceScraper();
    this.vision = deps.vision ?? new VisionAnalyzer();

    if (deps.providers && deps.providers.length > 0) {
      this.providers = deps.providers.map((p) => ({
        sendDailyDigest: p.sendDailyDigest.bind(p),
        channelName: p.channelName || "notification",
      }));
    } else {
      const activeProviders: Array<{ sendDailyDigest: (deals: any[]) => Promise<{ success: boolean; error?: string }>; channelName: string }> = [];

      // Telegram provider
      const telegramProvider =
        deps.telegram ??
        new TelegramNotificationProvider({
          botToken: process.env.TELEGRAM_BOT_TOKEN || "",
          chatId: process.env.TELEGRAM_CHAT_ID || "",
        });
      activeProviders.push({
        sendDailyDigest: telegramProvider.sendDailyDigest.bind(telegramProvider),
        channelName: telegramProvider.channelName || "telegram",
      });

      // WhatsApp provider (if injected or env variables configured)
      if (deps.whatsapp) {
        activeProviders.push({
          sendDailyDigest: deps.whatsapp.sendDailyDigest.bind(deps.whatsapp),
          channelName: deps.whatsapp.channelName || "whatsapp",
        });
      } else if (process.env.WHATSAPP_API_URL && (process.env.WHATSAPP_PHONE || process.env.WHATSAPP_RECIPIENT_PHONE)) {
        const whatsapp = new WhatsAppNotificationProvider({
          apiUrl: process.env.WHATSAPP_API_URL,
          apiKey: process.env.WHATSAPP_API_KEY,
          recipientPhone: (process.env.WHATSAPP_PHONE || process.env.WHATSAPP_RECIPIENT_PHONE)!,
        });
        activeProviders.push({
          sendDailyDigest: whatsapp.sendDailyDigest.bind(whatsapp),
          channelName: whatsapp.channelName,
        });
      }

      this.providers = activeProviders;
    }
  }

  /**
   * 1. SearchTarget Fallback:
   * Query active targets from PostgreSQL. If none exist or DB is empty,
   * fall back to environment variables creating or reusing a default target.
   */
  async getActiveTargets(): Promise<SearchTarget[]> {
    console.log("[Pipeline] Step 0: Checking active SearchTargets in database...");
    const activeTargets = await this.prisma.searchTarget.findMany({
      where: { active: true },
    });

    if (activeTargets && activeTargets.length > 0) {
      console.log(`[Pipeline] Found ${activeTargets.length} active SearchTarget(s) in database.`);
      return activeTargets;
    }

    console.log("[Pipeline] No active SearchTarget found in database. Falling back to environment variables...");
    const query = process.env.SEARCH_QUERY || "laptop gamer";
    const city = process.env.DEFAULT_CITY || "La Paz";
    const minPrice = process.env.MIN_PRICE ? parseFloat(process.env.MIN_PRICE) : 1500;
    const maxPrice = process.env.MAX_PRICE ? parseFloat(process.env.MAX_PRICE) : 6000;

    let defaultTarget = await this.prisma.searchTarget.findFirst({
      where: { query, location: city },
    });

    if (!defaultTarget) {
      defaultTarget = await this.prisma.searchTarget.create({
        data: {
          name: `Default - ${query}`,
          query,
          location: city,
          minPrice,
          maxPrice,
          currency: "BOB",
          active: true,
          keywordsExclude: ["repuesto", "pieza", "pantalla rota"],
        },
      });
      console.log(`[Pipeline] Created default SearchTarget "${defaultTarget.name}" (ID: ${defaultTarget.id}).`);
    } else if (!defaultTarget.active) {
      defaultTarget = await this.prisma.searchTarget.update({
        where: { id: defaultTarget.id },
        data: { active: true },
      });
      console.log(`[Pipeline] Reactivated existing default SearchTarget "${defaultTarget.name}" (ID: ${defaultTarget.id}).`);
    } else {
      console.log(`[Pipeline] Reusing existing active default SearchTarget "${defaultTarget.name}" (ID: ${defaultTarget.id}).`);
    }

    return [defaultTarget];
  }

  /**
   * Processes a single SearchTarget end-to-end:
   * - Scrapes Facebook Marketplace
   * - Idempotently persists listings with fbItemId
   * - Evaluates Tier-1 heuristics
   * - Tier-2 Multimodal Vision with short-circuit to save Gemini tokens
   * - Tier-3 Deal Ranking & Alert Deduplication to prevent Telegram spam
   */
  async processTarget(target: SearchTarget): Promise<TargetProcessSummary> {
    console.log(`\n--- Processing Target: "${target.name}" ("${target.query}" in "${target.location}") ---`);
    const city = target.location ? target.location.split(",")[0].trim() : (process.env.DEFAULT_CITY || "La Paz");
    const minPrice = target.minPrice ?? (process.env.MIN_PRICE ? parseFloat(process.env.MIN_PRICE) : 1500);
    const maxPrice = target.maxPrice ?? (process.env.MAX_PRICE ? parseFloat(process.env.MAX_PRICE) : 6000);

    // 1. Scrape raw listings
    console.log(`[Pipeline] Step 1: Scraping Marketplace listings...`);
    const rawListings: RawScrapedListing[] = await this.scraper.scrapeSearch({
      query: target.query,
      city,
      minPrice,
      maxPrice,
      limit: 20,
    });
    console.log(`[Pipeline] Found ${rawListings.length} total raw listings.`);

    if (rawListings.length === 0) {
      await this.prisma.searchTarget.update({
        where: { id: target.id },
        data: { lastRunAt: new Date() },
      });
      return {
        rawCount: 0,
        passedHeuristicsCount: 0,
        reusedEvaluationsCount: 0,
        newEvaluationsCount: 0,
        dispatchedAlertsCount: 0,
      };
    }

    // 2. Persist with idempotency & apply Heuristic Filter
    console.log(`[Pipeline] Step 2: Persisting listings (upsert) and evaluating heuristics...`);
    const passedItems: { raw: RawScrapedListing; db: any }[] = [];

    for (const raw of rawListings) {
      // 2. Idempotency: upsert by fbItemId
      const savedListing = await this.prisma.listing.upsert({
        where: { fbItemId: raw.fbItemId },
        create: {
          fbItemId: raw.fbItemId,
          searchTargetId: target.id,
          title: raw.title,
          listedPrice: raw.listedPrice ?? null,
          currency: raw.currency || target.currency || "BOB",
          location: raw.location || target.location,
          url: raw.url,
          imageUrls: raw.imageUrls,
          status: "PENDING",
        },
        update: {
          title: raw.title,
          listedPrice: raw.listedPrice ?? null,
          currency: raw.currency || target.currency || "BOB",
          location: raw.location || target.location,
          url: raw.url,
          imageUrls: raw.imageUrls,
        },
        include: {
          evaluation: true,
        },
      });

      const { pass, reason } = HeuristicFilter.evaluate(raw, {
        minPrice,
        maxPrice,
        keywordsInclude: target.keywordsInclude,
        keywordsExclude: target.keywordsExclude?.length ? target.keywordsExclude : ["repuesto", "pieza", "pantalla rota"],
      });

      if (!pass) {
        console.log(`  ↪ [Discarded] "${raw.title}" - ${reason}`);
        if (savedListing.status === "PENDING") {
          await this.prisma.listing.update({
            where: { id: savedListing.id },
            data: { status: "HEURISTIC_REJECTED" },
          });
        }
      } else {
        passedItems.push({ raw, db: savedListing });
      }
    }

    console.log(`[Pipeline] ${passedItems.length}/${rawListings.length} passed heuristic filters.`);

    // 3. Multimodal Vision Analysis (Tier-2) with Cost Short-Circuit
    console.log(`[Pipeline] Step 3: Running Multimodal AI Vision Analysis with Cost Short-Circuit...`);
    const candidates: CandidateWithDb[] = [];
    let reusedEvaluationsCount = 0;
    let newEvaluationsCount = 0;

    for (const item of passedItems) {
      // 3. Short-circuit: check if an evaluation is already registered
      const existingEval =
        item.db.evaluation ??
        (await this.prisma.evaluation.findUnique({
          where: { listingId: item.db.id },
        }));

      let evaluation: EvaluatedSpecs;
      if (existingEval) {
        reusedEvaluationsCount++;
        console.log(`  ⚡ [Cache Hit] Reusing existing evaluation for "${item.raw.title}" (ID: ${item.db.id})`);
        evaluation = {
          brand: existingEval.brand ?? undefined,
          model: existingEval.model ?? undefined,
          cpu: existingEval.cpu ?? undefined,
          ramGb: existingEval.ramGb ?? undefined,
          storageGb: existingEval.storageGb ?? undefined,
          gpu: existingEval.gpu ?? undefined,
          realPrice: existingEval.realPrice ?? undefined,
          conditionRating: existingEval.conditionRating ?? undefined,
          isDeal: existingEval.isDeal,
          dealScore: existingEval.dealScore,
          estimatedMarketPrice: existingEval.estimatedMarketPrice ?? undefined,
          reasoning: existingEval.reasoning ?? "Reused evaluation",
        };
      } else {
        newEvaluationsCount++;
        console.log(`  🔍 Analyzing: "${item.raw.title}" (Listed: ${item.raw.listedPrice ?? "N/A"} BOB)...`);
        evaluation = await this.vision.analyze(item.raw);
        console.log(`     Score: ${evaluation.dealScore}/100 | IsDeal: ${evaluation.isDeal} | Specs: ${evaluation.cpu || "N/A"} / ${evaluation.ramGb || "N/A"}GB`);

        await this.prisma.evaluation.create({
          data: {
            listingId: item.db.id,
            brand: evaluation.brand ?? null,
            model: evaluation.model ?? null,
            cpu: evaluation.cpu ?? null,
            ramGb: evaluation.ramGb ?? null,
            storageGb: evaluation.storageGb ?? null,
            gpu: evaluation.gpu ?? null,
            realPrice: evaluation.realPrice ?? null,
            conditionRating: evaluation.conditionRating ?? null,
            isDeal: evaluation.isDeal,
            dealScore: evaluation.dealScore,
            estimatedMarketPrice: evaluation.estimatedMarketPrice ?? null,
            reasoning: evaluation.reasoning ?? null,
          },
        });

        await this.prisma.listing.update({
          where: { id: item.db.id },
          data: { status: "EVALUATED" },
        });
      }

      candidates.push({
        listing: item.raw,
        evaluation,
        listingId: item.db.id,
      });
    }

    // 4 & 5. Dispatch alerts across configured channels with deduplication
    let dispatchedAlertsCount = 0;

    for (const provider of this.providers) {
      console.log(`[Pipeline] Step 4: Clustering & Ranking Top Deals for channel "${provider.channelName}"...`);
      const unalertedCandidates: CandidateWithDb[] = [];

      for (const candidate of candidates) {
        const existingAlert = await this.prisma.alert.findFirst({
          where: {
            listingId: candidate.listingId,
            channel: provider.channelName,
          },
        });

        if (existingAlert) {
          console.log(`  ↪ [Deduplication] Listing "${candidate.listing.title}" (ID: ${candidate.listingId}) already alerted on ${provider.channelName}. Skipping.`);
        } else {
          unalertedCandidates.push(candidate);
        }
      }

      const topDeals = DealRanker.selectTopDeals(unalertedCandidates, 5);
      console.log(`[Pipeline] Selected ${topDeals.length} Top Deal(s) for ${provider.channelName}.`);

      if (topDeals.length > 0) {
        console.log(`[Pipeline] Step 5: Dispatching notification to ${provider.channelName}...`);
        const digestResult = await provider.sendDailyDigest(topDeals);
        if (digestResult.success) {
          console.log(`✅ Successfully sent ${provider.channelName} Top Deals Digest!`);
          for (const deal of topDeals) {
            const matchingCandidate = unalertedCandidates.find((c) => c.listing.url === deal.url);
            if (matchingCandidate) {
              await this.prisma.alert.create({
                data: {
                  listingId: matchingCandidate.listingId,
                  channel: provider.channelName,
                  status: "sent",
                  metadata: {
                    dealScore: deal.dealScore,
                    realPrice: deal.realPrice ?? deal.listedPrice,
                    currency: deal.currency,
                    title: deal.dealTitle,
                  },
                },
              });

              await this.prisma.listing.update({
                where: { id: matchingCandidate.listingId },
                data: { status: "ALERTED" },
              });
              dispatchedAlertsCount++;
            }
          }
        } else {
          console.log(`⚠️ ${provider.channelName} notification skipped/failed: ${digestResult.error}`);
        }
      } else {
        console.log(`ℹ️ No outstanding new deals met the threshold for ${provider.channelName} on this run.`);
      }
    }

    await this.prisma.searchTarget.update({
      where: { id: target.id },
      data: { lastRunAt: new Date() },
    });

    return {
      rawCount: rawListings.length,
      passedHeuristicsCount: passedItems.length,
      reusedEvaluationsCount,
      newEvaluationsCount,
      dispatchedAlertsCount,
    };
  }

  /**
   * Initializes the scraper browser context.
   */
  async init(headless: boolean = true): Promise<void> {
    if (this.scraper?.init) {
      await this.scraper.init(headless);
    }
  }

  /**
   * Closes the scraper browser and releases resources.
   */
  async close(): Promise<void> {
    if (this.scraper?.close) {
      await this.scraper.close();
    }
  }

  /**
   * Runs the pipeline on-demand for a single SearchTarget (by ID or model).
   */
  async runTarget(targetOrId: string | SearchTarget): Promise<TargetProcessSummary> {
    const target =
      typeof targetOrId === "string"
        ? await this.prisma.searchTarget.findUnique({ where: { id: targetOrId } })
        : targetOrId;

    if (!target) {
      throw new Error(`Target not found: ${typeof targetOrId === "string" ? targetOrId : targetOrId?.id}`);
    }

    const headless = process.env.HEADLESS !== "false";
    await this.init(headless);
    try {
      return await this.processTarget(target);
    } finally {
      await this.close();
    }
  }

  /**
   * Main entry point to run worker cycle across all active search targets
   */
  async run(): Promise<void> {
    console.log("==========================================");
    console.log("🚀 RADAR PRICE — Facebook Marketplace Deal Sniper");
    console.log("==========================================");

    const headless = process.env.HEADLESS !== "false";

    try {
      await this.scraper.init(headless);

      // 1. Get or fallback SearchTargets
      const targets = await this.getActiveTargets();
      console.log(`[Pipeline] Found ${targets.length} active SearchTarget(s) to process.`);

      for (const target of targets) {
        await this.processTarget(target);
      }
    } catch (err) {
      console.error("❌ Fatal error in worker execution:", err);
      throw err;
    } finally {
      await this.scraper.close();
      console.log("🏁 Worker pass completed.");
    }
  }
}
