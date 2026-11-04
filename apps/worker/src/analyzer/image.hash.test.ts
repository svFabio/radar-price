import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { ImageHasher } from "./image.hash.js";
import { DealRanker, CandidateDeal } from "../ranking/deal.ranker.js";

describe("ImageHasher & Perceptual Image Deduplication (dHash)", () => {
  test("computes identical dHash for identical pixel matrices", () => {
    const matrixA = Array.from({ length: 8 }, () => [10, 20, 15, 30, 25, 40, 35, 50, 45]);
    const matrixB = Array.from({ length: 8 }, () => [10, 20, 15, 30, 25, 40, 35, 50, 45]);

    const hashA = ImageHasher.computeDHashFromMatrix(matrixA);
    const hashB = ImageHasher.computeDHashFromMatrix(matrixB);

    assert.equal(hashA, hashB);
    assert.equal(ImageHasher.hammingDistance(hashA, hashB), 0);
    assert.equal(ImageHasher.areImagesSimilar(hashA, hashB), true);
  });

  test("calculates correct Hamming distance between differing hashes", () => {
    const hash1 = "ffffffffffffffff";
    const hash2 = "fffffffffffffffe"; // Differs by 1 bit in last char (f vs e: 1111 vs 1110)

    const dist = ImageHasher.hammingDistance(hash1, hash2);
    assert.equal(dist, 1);
    assert.equal(ImageHasher.areImagesSimilar(hash1, hash2, 5), true);
  });

  test("flags completely different images as not similar", () => {
    const hashA = "0000000000000000";
    const hashB = "ffffffffffffffff";

    const dist = ImageHasher.hammingDistance(hashA, hashB);
    assert.equal(dist, 64);
    assert.equal(ImageHasher.areImagesSimilar(hashA, hashB, 10), false);
  });

  test("computes deterministic hash from buffer byte sampling", () => {
    const buffer1 = Buffer.from("simulated-jpeg-image-bytes-laptop-photo-1234567890");
    const buffer2 = Buffer.from("simulated-jpeg-image-bytes-laptop-photo-1234567890");

    const hash1 = ImageHasher.computeHashFromBuffer(buffer1);
    const hash2 = ImageHasher.computeHashFromBuffer(buffer2);

    assert.equal(hash1, hash2);
    assert.equal(hash1.length, 16);
  });

  test("DealRanker filters out duplicate listing with matching image hash", () => {
    const sharedPhotoHash = "a1b2c3d4e5f60718";

    const candidate1: CandidateDeal = {
      listing: {
        fbItemId: "item-original",
        title: "Asus ROG Strix G15",
        listedPrice: 4200,
        currency: "BOB",
        url: "https://fb.com/original",
        imageUrls: ["https://fb.com/photo1.jpg"],
        imageHashes: [sharedPhotoHash],
      },
      evaluation: {
        brand: "Asus",
        model: "ROG Strix",
        cpu: "Ryzen 7 6800H",
        ramGb: 16,
        gpu: "RTX 3060",
        realPrice: 4200,
        isDeal: true,
        dealScore: 90,
        reasoning: "Great value Asus laptop",
      },
    };

    // Seller reposted with slightly changed title or details, but identical photo
    const candidateRepost: CandidateDeal = {
      listing: {
        fbItemId: "item-repost",
        title: "OFERTA ASUS ROG GAMING",
        listedPrice: 4100,
        currency: "BOB",
        url: "https://fb.com/repost",
        imageUrls: ["https://fb.com/photo1_copy.jpg"],
        imageHashes: [sharedPhotoHash],
      },
      evaluation: {
        brand: "Asus",
        model: "ROG Gaming",
        cpu: "Ryzen 7 6800H",
        ramGb: 16,
        gpu: "RTX 3060",
        realPrice: 4100,
        isDeal: true,
        dealScore: 88,
        reasoning: "Reposted duplicate",
      },
    };

    const topDeals = DealRanker.selectTopDeals([candidate1, candidateRepost], 5);

    // Only the highest scoring deal should be retained; repost discarded via matching image hash
    assert.equal(topDeals.length, 1);
    assert.equal(topDeals[0].url, "https://fb.com/original");
  });
});
