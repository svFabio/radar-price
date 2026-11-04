import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { FmpCalculator } from "./fmp.calculator.js";

describe("FmpCalculator & Statistical Arbitrage (US-3.2)", () => {
  describe("1. Statistical Median Calculation", () => {
    test("calculates median correctly for odd count of historical prices", () => {
      const prices = [3000, 4500, 3200, 5000, 3100];
      // Sorted: [3100, 3200, 3000, 4500, 5000] -> [3000, 3100, 3200, 4500, 5000] -> mid is 3200
      const median = FmpCalculator.calculateMedian(prices);
      assert.equal(median, 3200);
    });

    test("calculates median correctly for even count of historical prices", () => {
      const prices = [3000, 4000, 3500, 4500];
      // Sorted: [3000, 3500, 4000, 4500] -> mid average is (3500 + 4000) / 2 = 3750
      const median = FmpCalculator.calculateMedian(prices);
      assert.equal(median, 3750);
    });

    test("discards zero or negative values in median computation", () => {
      const prices = [0, -500, 4000, 4200, 4400];
      const median = FmpCalculator.calculateMedian(prices);
      assert.equal(median, 4200);
    });

    test("returns null when no valid prices exist", () => {
      const median = FmpCalculator.calculateMedian([]);
      assert.equal(median, null);
    });
  });

  describe("2. FMP Resolution (Statistical vs LLM Fallback)", () => {
    test("uses statistical median when >= 3 historical samples exist", () => {
      const historical = [4200, 4500, 4000];
      const llmGuess = 5500;

      const fmp = FmpCalculator.resolveFmp(historical, llmGuess, 3);
      assert.equal(fmp.isStatistical, true);
      assert.equal(fmp.medianPrice, 4200);
      assert.equal(fmp.sampleCount, 3);
    });

    test("falls back to LLM estimated price when historical samples are insufficient (< 3)", () => {
      const historical = [4200];
      const llmGuess = 5000;

      const fmp = FmpCalculator.resolveFmp(historical, llmGuess, 3);
      assert.equal(fmp.isStatistical, false);
      assert.equal(fmp.medianPrice, 5000);
      assert.equal(fmp.sampleCount, 1);
    });
  });

  describe("3. Deal Score Formula", () => {
    test("calculates high deal score for deep discount with good condition", () => {
      const fmp = 5000;
      const realPrice = 3000; // 40% discount
      const condition = 10; // factor = 1.0

      const score = FmpCalculator.calculateDealScore(fmp, realPrice, condition);
      assert.equal(score, 40); // 40 * 1.0 = 40
    });

    test("reduces score for lower physical condition ratings", () => {
      const fmp = 5000;
      const realPrice = 3000; // 40% discount
      const condition = 5; // factor = 0.6 + 0.2 = 0.8

      const score = FmpCalculator.calculateDealScore(fmp, realPrice, condition);
      assert.equal(score, 32); // 40 * 0.8 = 32
    });

    test("returns 0 score when item is overpriced (realPrice >= fmp)", () => {
      const fmp = 4000;
      const realPrice = 4500;

      const score = FmpCalculator.calculateDealScore(fmp, realPrice, 8);
      assert.equal(score, 0);
    });
  });
});
