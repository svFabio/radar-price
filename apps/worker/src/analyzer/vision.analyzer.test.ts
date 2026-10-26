import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { VisionAnalyzer } from "./vision.analyzer.js";

describe("VisionAnalyzer", () => {
  test("returns mock evaluation when no API key is provided", async () => {
    // Instantiate with empty key to force fallback mode
    const analyzer = new VisionAnalyzer("");
    
    const listing = {
      fbItemId: "999",
      title: "Laptop Asus ROG Strix G15 i7 RTX 3060",
      listedPrice: 4200,
      currency: "BOB",
      url: "https://facebook.com/marketplace/item/999",
      imageUrls: ["https://example.com/fake-image.jpg"],
      location: "La Paz",
    };

    const result = await analyzer.analyze(listing);
    assert.ok(result);
    assert.equal(typeof result.dealScore, "number");
    assert.equal(typeof result.isDeal, "boolean");
    assert.ok(result.reasoning.length > 0);
    assert.equal(result.realPrice, 4200);
  });

  test("evaluates deal score correctly based on budget", async () => {
    const analyzer = new VisionAnalyzer("");
    
    const cheapListing = {
      fbItemId: "998",
      title: "Laptop Lenovo ThinkPad",
      listedPrice: 2500,
      currency: "BOB",
      url: "https://facebook.com/marketplace/item/998",
      imageUrls: [],
    };

    const result = await analyzer.analyze(cheapListing);
    assert.equal(result.isDeal, true);
    assert.ok(result.dealScore >= 70);
  });
});
