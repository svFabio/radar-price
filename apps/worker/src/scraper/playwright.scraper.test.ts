import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { HeuristicFilter } from "../analyzer/heuristic.filter.js";
import { DealRanker } from "../ranking/deal.ranker.js";
import { PlaywrightMarketplaceScraper } from "./playwright.scraper.js";

describe("HeuristicFilter", () => {
  test("discards buyer intent posts", () => {
    const post = {
      fbItemId: "101",
      title: "Busco laptop i7 urgente pago al contado",
      listedPrice: 3000,
      currency: "BOB",
      url: "https://fb.com/101",
      imageUrls: [],
    };
    const res = HeuristicFilter.evaluate(post, { minPrice: 1000, maxPrice: 5000 });
    assert.equal(res.pass, false);
    assert.match(res.reason!, /Buyer request/);
  });

  test("discards accessories and broken parts", () => {
    const post = {
      fbItemId: "102",
      title: "Cargador para laptop Lenovo ThinkPad 65W",
      listedPrice: 150,
      currency: "BOB",
      url: "https://fb.com/102",
      imageUrls: [],
    };
    const res = HeuristicFilter.evaluate(post, { minPrice: 100, maxPrice: 5000 });
    assert.equal(res.pass, false);
    assert.match(res.reason!, /Junk or accessory/);
  });

  test("passes valid laptop posts", () => {
    const post = {
      fbItemId: "103",
      title: "Laptop Lenovo Legion 5 RTX 3060 Ryzen 7 como nueva",
      listedPrice: 4500,
      currency: "BOB",
      url: "https://fb.com/103",
      imageUrls: [],
    };
    const res = HeuristicFilter.evaluate(post, { minPrice: 2000, maxPrice: 6000 });
    assert.equal(res.pass, true);
  });
});

describe("Checkpoint Detection", () => {
  test("flags login and checkpoint URLs correctly", async () => {
    const scraper = new PlaywrightMarketplaceScraper();
    
    // Mock page with checkpoint URL
    const mockCheckpointPage = {
      url: () => "https://www.facebook.com/checkpoint/123456789/",
      $: async () => null,
    } as any;

    const isBlocked = await scraper.detectCheckpoint(mockCheckpointPage);
    assert.equal(isBlocked, true);

    // Mock normal marketplace page
    const mockCleanPage = {
      url: () => "https://www.facebook.com/marketplace/lapaz/search?query=laptop",
      $: async () => null,
    } as any;

    const isClean = await scraper.detectCheckpoint(mockCleanPage);
    assert.equal(isClean, false);
  });
});

describe("DealRanker & Clustering", () => {
  test("clusters duplicate hardware tiers and chooses highest score", () => {
    const candidate1 = {
      listing: {
        fbItemId: "201",
        title: "Dell G15 RTX 3050 i5",
        listedPrice: 4000,
        currency: "BOB",
        url: "https://fb.com/201",
        imageUrls: [],
      },
      evaluation: {
        brand: "Dell",
        model: "G15",
        cpu: "i5-11400H",
        gpu: "RTX 3050",
        ramGb: 16,
        isDeal: true,
        dealScore: 75,
        realPrice: 4000,
        reasoning: "Good deal",
      },
    };

    const candidate2 = {
      listing: {
        fbItemId: "202",
        title: "Dell G15 gaming RTX 3050",
        listedPrice: 3500,
        currency: "BOB",
        url: "https://fb.com/202",
        imageUrls: [],
      },
      evaluation: {
        brand: "Dell",
        model: "G15",
        cpu: "i5-11400H",
        gpu: "RTX 3050",
        ramGb: 16,
        isDeal: true,
        dealScore: 90,
        realPrice: 3500,
        reasoning: "Exceptional bargain",
      },
    };

    const topDeals = DealRanker.selectTopDeals([candidate1, candidate2], 5);
    // Should only have 1 deal for this cluster, with the higher score (90)
    assert.equal(topDeals.length, 1);
    assert.equal(topDeals[0].dealScore, 90);
    assert.equal(topDeals[0].realPrice, 3500);
  });
});
