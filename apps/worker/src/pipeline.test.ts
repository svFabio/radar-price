import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { WorkerPipeline, PipelineDependencies } from "./pipeline.js";
import { RawScrapedListing } from "./analyzer/heuristic.filter.js";
import { EvaluatedSpecs } from "./analyzer/vision.analyzer.js";

describe("WorkerPipeline - Arbitrator Requirements (US-5.1)", () => {
  describe("1. SearchTarget Fallback", () => {
    test("returns active targets from database when available without fallback creation", async () => {
      const existingTargets = [
        {
          id: "target-1",
          name: "Laptops Gamer Cochabamba",
          query: "laptop gamer",
          location: "Cochabamba",
          minPrice: 2000,
          maxPrice: 5000,
          active: true,
          keywordsInclude: [],
          keywordsExclude: [],
        },
      ];

      let createdTarget = false;
      const mockPrisma = {
        searchTarget: {
          findMany: async ({ where }: any) => {
            if (where?.active) return existingTargets;
            return [];
          },
          findFirst: async () => null,
          create: async () => {
            createdTarget = true;
            return null;
          },
        },
      };

      const pipeline = new WorkerPipeline({ prisma: mockPrisma });
      const targets = await pipeline.getActiveTargets();

      assert.equal(targets.length, 1);
      assert.equal(targets[0].id, "target-1");
      assert.equal(createdTarget, false, "Should not create a default target if active ones exist");
    });

    test("falls back to environment variables and creates default target when DB has no active targets", async () => {
      process.env.SEARCH_QUERY = "thinkpad t480";
      process.env.DEFAULT_CITY = "Santa Cruz";
      process.env.MIN_PRICE = "1800";
      process.env.MAX_PRICE = "4200";

      let createdData: any = null;
      const mockPrisma = {
        searchTarget: {
          findMany: async () => [], // empty DB
          findFirst: async () => null, // no existing target
          create: async ({ data }: any) => {
            createdData = data;
            return { id: "default-target-id", ...data };
          },
        },
      };

      const pipeline = new WorkerPipeline({ prisma: mockPrisma });
      const targets = await pipeline.getActiveTargets();

      assert.equal(targets.length, 1);
      assert.equal(targets[0].id, "default-target-id");
      assert.ok(createdData);
      assert.equal(createdData.query, "thinkpad t480");
      assert.equal(createdData.location, "Santa Cruz");
      assert.equal(createdData.minPrice, 1800);
      assert.equal(createdData.maxPrice, 4200);
      assert.equal(createdData.active, true);
    });

    test("reactivates existing inactive default target when found", async () => {
      process.env.SEARCH_QUERY = "macbook air";
      process.env.DEFAULT_CITY = "La Paz";

      let updatedId = "";
      let updatedData: any = null;

      const mockPrisma = {
        searchTarget: {
          findMany: async () => [],
          findFirst: async () => ({
            id: "target-inactive",
            name: "Default - macbook air",
            query: "macbook air",
            location: "La Paz",
            active: false,
          }),
          update: async ({ where, data }: any) => {
            updatedId = where.id;
            updatedData = data;
            return { id: where.id, active: data.active };
          },
        },
      };

      const pipeline = new WorkerPipeline({ prisma: mockPrisma });
      const targets = await pipeline.getActiveTargets();

      assert.equal(targets.length, 1);
      assert.equal(updatedId, "target-inactive");
      assert.equal(updatedData.active, true);
    });
  });

  describe("2. Idempotencia en Listing", () => {
    test("upserts listings by fbItemId and marks heuristic rejected appropriately", async () => {
      const mockTarget: any = {
        id: "target-100",
        name: "Laptops Gamer",
        query: "laptop gamer",
        location: "La Paz",
        minPrice: 1500,
        maxPrice: 6000,
        currency: "BOB",
        keywordsInclude: [],
        keywordsExclude: ["repuesto", "pantalla rota"],
      };

      const scrapedRawListings: RawScrapedListing[] = [
        {
          fbItemId: "fb-item-1",
          title: "Laptop Asus ROG RTX 3060",
          listedPrice: 4000,
          currency: "BOB",
          url: "https://fb.com/1",
          imageUrls: ["https://img.com/1.jpg"],
          location: "La Paz",
        },
        {
          fbItemId: "fb-item-2",
          title: "Laptop HP para repuesto", // Should be rejected by heuristic
          listedPrice: 500,
          currency: "BOB",
          url: "https://fb.com/2",
          imageUrls: [],
          location: "La Paz",
        },
      ];

      const upsertedListings: any[] = [];
      const updatedStatuses: any[] = [];

      const mockPrisma = {
        listing: {
          upsert: async (args: any) => {
            upsertedListings.push(args);
            const isSecond = args.where.fbItemId === "fb-item-2";
            return {
              id: isSecond ? "listing-db-2" : "listing-db-1",
              fbItemId: args.where.fbItemId,
              title: args.create.title,
              status: "PENDING",
              evaluation: null,
            };
          },
          update: async ({ where, data }: any) => {
            updatedStatuses.push({ id: where.id, ...data });
            return {};
          },
        },
        evaluation: {
          findUnique: async () => null,
          create: async () => ({ id: "eval-1" }),
        },
        alert: {
          findFirst: async () => null,
          create: async () => ({ id: "alert-1" }),
        },
        searchTarget: {
          update: async () => ({}),
        },
      };

      const mockScraper = {
        init: async () => {},
        scrapeSearch: async () => scrapedRawListings,
        close: async () => {},
      };

      const mockVision = {
        analyze: async () => ({
          brand: "Asus",
          model: "ROG",
          cpu: "i7-11800H",
          isDeal: true,
          dealScore: 85,
          reasoning: "Great deal",
        }),
      };

      const mockTelegram = {
        sendDailyDigest: async () => ({ success: true }),
      };

      const pipeline = new WorkerPipeline({
        prisma: mockPrisma,
        scraper: mockScraper,
        vision: mockVision,
        telegram: mockTelegram,
      });

      const summary = await pipeline.processTarget(mockTarget);

      // Verify upserts were called for both listings with fbItemId
      assert.equal(upsertedListings.length, 2);
      assert.equal(upsertedListings[0].where.fbItemId, "fb-item-1");
      assert.equal(upsertedListings[1].where.fbItemId, "fb-item-2");

      // Verify fb-item-2 was marked HEURISTIC_REJECTED
      const rejectedUpdate = updatedStatuses.find((u) => u.id === "listing-db-2");
      assert.ok(rejectedUpdate);
      assert.equal(rejectedUpdate.status, "HEURISTIC_REJECTED");

      // fb-item-1 passed heuristics and got evaluated
      assert.equal(summary.passedHeuristicsCount, 1);
    });
  });

  describe("3. Short-circuit de Costos (Gemini Vision)", () => {
    test("skips Gemini Vision call and reuses existing evaluation when present in DB", async () => {
      const mockTarget: any = {
        id: "target-100",
        name: "Laptops Gamer",
        query: "laptop gamer",
        location: "La Paz",
        minPrice: 1500,
        maxPrice: 6000,
        currency: "BOB",
      };

      const scrapedRawListings: RawScrapedListing[] = [
        {
          fbItemId: "fb-item-cached",
          title: "Lenovo Legion 5 RTX 3060",
          listedPrice: 3800,
          currency: "BOB",
          url: "https://fb.com/cached",
          imageUrls: ["https://img.com/legion.jpg"],
        },
      ];

      const existingEvaluation: any = {
        id: "existing-eval-id",
        listingId: "listing-db-cached",
        brand: "Lenovo",
        model: "Legion 5",
        cpu: "Ryzen 7 5800H",
        ramGb: 16,
        gpu: "RTX 3060",
        realPrice: 3800,
        isDeal: true,
        dealScore: 92,
        reasoning: "Previously analyzed deal",
      };

      let visionAnalyzeCalls = 0;
      let evalCreated = false;

      const mockPrisma = {
        listing: {
          upsert: async () => ({
            id: "listing-db-cached",
            fbItemId: "fb-item-cached",
            title: "Lenovo Legion 5 RTX 3060",
            status: "EVALUATED",
            evaluation: existingEvaluation, // Cached evaluation loaded with include
          }),
          update: async () => ({}),
        },
        evaluation: {
          findUnique: async () => existingEvaluation,
          create: async () => {
            evalCreated = true;
            return {};
          },
        },
        alert: {
          findFirst: async () => null,
          create: async () => ({ id: "alert-1" }),
        },
        searchTarget: {
          update: async () => ({}),
        },
      };

      const mockScraper = {
        init: async () => {},
        scrapeSearch: async () => scrapedRawListings,
        close: async () => {},
      };

      const mockVision = {
        analyze: async () => {
          visionAnalyzeCalls++;
          return {} as EvaluatedSpecs;
        },
      };

      const mockTelegram = {
        sendDailyDigest: async () => ({ success: true }),
      };

      const pipeline = new WorkerPipeline({
        prisma: mockPrisma,
        scraper: mockScraper,
        vision: mockVision,
        telegram: mockTelegram,
      });

      const summary = await pipeline.processTarget(mockTarget);

      // Vision analyze must NOT be called
      assert.equal(visionAnalyzeCalls, 0, "Gemini Vision must not be called when evaluation exists");
      assert.equal(evalCreated, false, "Evaluation should not be re-created");
      assert.equal(summary.reusedEvaluationsCount, 1);
      assert.equal(summary.newEvaluationsCount, 0);
    });

    test("calls Gemini Vision and persists evaluation when no prior evaluation exists", async () => {
      const mockTarget: any = {
        id: "target-100",
        name: "Laptops Gamer",
        query: "laptop gamer",
        location: "La Paz",
        minPrice: 1500,
        maxPrice: 6000,
        currency: "BOB",
      };

      const scrapedRawListings: RawScrapedListing[] = [
        {
          fbItemId: "fb-item-new",
          title: "Acer Nitro 5 RTX 3050",
          listedPrice: 3500,
          currency: "BOB",
          url: "https://fb.com/new",
          imageUrls: ["https://img.com/nitro.jpg"],
        },
      ];

      let visionAnalyzeCalls = 0;
      let createdEvaluationData: any = null;
      let updatedListingStatus = "";

      const mockPrisma = {
        listing: {
          upsert: async () => ({
            id: "listing-db-new",
            fbItemId: "fb-item-new",
            title: "Acer Nitro 5 RTX 3050",
            status: "PENDING",
            evaluation: null,
          }),
          update: async ({ data }: any) => {
            if (data.status) updatedListingStatus = data.status;
            return {};
          },
        },
        evaluation: {
          findUnique: async () => null,
          create: async ({ data }: any) => {
            createdEvaluationData = data;
            return { id: "eval-new", ...data };
          },
        },
        alert: {
          findFirst: async () => null,
          create: async () => ({ id: "alert-1" }),
        },
        searchTarget: {
          update: async () => ({}),
        },
      };

      const mockScraper = {
        init: async () => {},
        scrapeSearch: async () => scrapedRawListings,
        close: async () => {},
      };

      const mockVision = {
        analyze: async () => {
          visionAnalyzeCalls++;
          return {
            brand: "Acer",
            model: "Nitro 5",
            cpu: "i5-11400H",
            ramGb: 16,
            gpu: "RTX 3050",
            realPrice: 3500,
            isDeal: true,
            dealScore: 88,
            reasoning: "Great price for Nitro 5",
          };
        },
      };

      const mockTelegram = {
        sendDailyDigest: async () => ({ success: true }),
      };

      const pipeline = new WorkerPipeline({
        prisma: mockPrisma,
        scraper: mockScraper,
        vision: mockVision,
        telegram: mockTelegram,
      });

      const summary = await pipeline.processTarget(mockTarget);

      assert.equal(visionAnalyzeCalls, 1);
      assert.ok(createdEvaluationData);
      assert.equal(createdEvaluationData.listingId, "listing-db-new");
      assert.equal(createdEvaluationData.dealScore, 88);
      assert.equal(createdEvaluationData.isDeal, true);
      assert.equal(summary.newEvaluationsCount, 1);
    });
  });

  describe("4. Deduplicación de Alertas", () => {
    test("skips alert dispatch and avoids creating duplicate Alert record when already alerted on telegram", async () => {
      const mockTarget: any = {
        id: "target-100",
        name: "Laptops Gamer",
        query: "laptop gamer",
        location: "La Paz",
        minPrice: 1500,
        maxPrice: 6000,
        currency: "BOB",
      };

      const scrapedRawListings: RawScrapedListing[] = [
        {
          fbItemId: "fb-item-already-alerted",
          title: "MSI GF63 Thin",
          listedPrice: 3200,
          currency: "BOB",
          url: "https://fb.com/already-alerted",
          imageUrls: [],
        },
      ];

      let telegramDispatchCalls = 0;
      let alertCreateCalls = 0;

      const mockPrisma = {
        listing: {
          upsert: async () => ({
            id: "listing-db-already-alerted",
            fbItemId: "fb-item-already-alerted",
            title: "MSI GF63 Thin",
            status: "ALERTED",
            evaluation: {
              brand: "MSI",
              model: "GF63",
              isDeal: true,
              dealScore: 85,
              realPrice: 3200,
            },
          }),
          update: async () => ({}),
        },
        evaluation: {
          findUnique: async () => null,
          create: async () => ({}),
        },
        alert: {
          // Pre-existing alert found for channel 'telegram'
          findFirst: async ({ where }: any) => {
            if (where.listingId === "listing-db-already-alerted" && where.channel === "telegram") {
              return {
                id: "alert-prev-id",
                listingId: "listing-db-already-alerted",
                channel: "telegram",
                status: "sent",
              };
            }
            return null;
          },
          create: async () => {
            alertCreateCalls++;
            return {};
          },
        },
        searchTarget: {
          update: async () => ({}),
        },
      };

      const mockScraper = {
        init: async () => {},
        scrapeSearch: async () => scrapedRawListings,
        close: async () => {},
      };

      const mockVision = {
        analyze: async () => ({
          brand: "MSI",
          model: "GF63",
          isDeal: true,
          dealScore: 85,
          reasoning: "Good",
        }),
      };

      const mockTelegram = {
        sendDailyDigest: async () => {
          telegramDispatchCalls++;
          return { success: true };
        },
      };

      const pipeline = new WorkerPipeline({
        prisma: mockPrisma,
        scraper: mockScraper,
        vision: mockVision,
        telegram: mockTelegram,
      });

      const summary = await pipeline.processTarget(mockTarget);

      // Since the deal was already alerted on telegram, it must NOT be sent to telegram again
      assert.equal(telegramDispatchCalls, 0, "Should not dispatch to Telegram for already alerted item");
      assert.equal(alertCreateCalls, 0, "Should not create duplicate Alert record");
      assert.equal(summary.dispatchedAlertsCount, 0);
    });

    test("dispatches to telegram and records Alert in DB when not previously alerted", async () => {
      const mockTarget: any = {
        id: "target-100",
        name: "Laptops Gamer",
        query: "laptop gamer",
        location: "La Paz",
        minPrice: 1500,
        maxPrice: 6000,
        currency: "BOB",
      };

      const scrapedRawListings: RawScrapedListing[] = [
        {
          fbItemId: "fb-item-unalerted",
          title: "HP Victus RTX 3050",
          listedPrice: 3400,
          currency: "BOB",
          url: "https://fb.com/unalerted",
          imageUrls: ["https://img.com/victus.jpg"],
        },
      ];

      let telegramDispatchCalls = 0;
      let createdAlertData: any = null;
      let listingStatusUpdated = "";

      const mockPrisma = {
        listing: {
          upsert: async () => ({
            id: "listing-db-unalerted",
            fbItemId: "fb-item-unalerted",
            title: "HP Victus RTX 3050",
            status: "PENDING",
            evaluation: null,
          }),
          update: async ({ data }: any) => {
            if (data.status) listingStatusUpdated = data.status;
            return {};
          },
        },
        evaluation: {
          findUnique: async () => null,
          create: async () => ({ id: "eval-1" }),
        },
        alert: {
          findFirst: async () => null, // No previous alert
          create: async ({ data }: any) => {
            createdAlertData = data;
            return { id: "alert-new", ...data };
          },
        },
        searchTarget: {
          update: async () => ({}),
        },
      };

      const mockScraper = {
        init: async () => {},
        scrapeSearch: async () => scrapedRawListings,
        close: async () => {},
      };

      const mockVision = {
        analyze: async () => ({
          brand: "HP",
          model: "Victus",
          cpu: "Ryzen 5 5600H",
          ramGb: 16,
          gpu: "RTX 3050",
          realPrice: 3400,
          isDeal: true,
          dealScore: 89,
          reasoning: "Great bargain",
        }),
      };

      const mockTelegram = {
        sendDailyDigest: async () => {
          telegramDispatchCalls++;
          return { success: true };
        },
      };

      const pipeline = new WorkerPipeline({
        prisma: mockPrisma,
        scraper: mockScraper,
        vision: mockVision,
        telegram: mockTelegram,
      });

      const summary = await pipeline.processTarget(mockTarget);

      assert.equal(telegramDispatchCalls, 1, "Must dispatch to Telegram");
      assert.ok(createdAlertData, "Must create Alert record in DB");
      assert.equal(createdAlertData.listingId, "listing-db-unalerted");
      assert.equal(createdAlertData.channel, "telegram");
      assert.equal(createdAlertData.status, "sent");
      assert.equal(listingStatusUpdated, "ALERTED");
      assert.equal(summary.dispatchedAlertsCount, 1);
    });
  });

  describe("5. On-Demand runTarget Execution", () => {
    test("runTarget initializes scraper, processes single target by ID, and cleanly closes scraper", async () => {
      let initCalled = false;
      let closeCalled = false;

      const mockTarget = {
        id: "target-ondemand",
        name: "Thinkpads",
        query: "thinkpad",
        location: "La Paz",
        minPrice: 1000,
        maxPrice: 3000,
        currency: "BOB",
        keywordsInclude: [],
        keywordsExclude: [],
        active: true,
      };

      const mockPrisma = {
        searchTarget: {
          findUnique: async ({ where }: any) => {
            if (where.id === "target-ondemand") return mockTarget;
            return null;
          },
          update: async () => mockTarget,
        },
      };

      const mockScraper = {
        init: async () => {
          initCalled = true;
        },
        scrapeSearch: async () => [],
        close: async () => {
          closeCalled = true;
        },
      };

      const pipeline = new WorkerPipeline({
        prisma: mockPrisma,
        scraper: mockScraper,
      });

      const summary = await pipeline.runTarget("target-ondemand");

      assert.equal(initCalled, true, "Scraper must be initialized");
      assert.equal(closeCalled, true, "Scraper must be closed in finally");
      assert.equal(summary.rawCount, 0);
    });

    test("runTarget throws when target ID is not found", async () => {
      const mockPrisma = {
        searchTarget: {
          findUnique: async () => null,
        },
      };

      const pipeline = new WorkerPipeline({ prisma: mockPrisma });

      await assert.rejects(
        async () => {
          await pipeline.runTarget("unknown-id");
        },
        { message: "Target not found: unknown-id" }
      );
    });
  });
});
