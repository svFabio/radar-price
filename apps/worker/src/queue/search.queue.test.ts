import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { SearchTargetQueue, SEARCH_QUEUE_NAME } from "./search.queue.js";

describe("BullMQ Search Queue & Distributed Processing", () => {
  test("defines standard queue name", () => {
    assert.equal(SEARCH_QUEUE_NAME, "radar-search-targets");
  });

  test("instantiates SearchTargetQueue with lazy connection", async () => {
    const searchQueue = new SearchTargetQueue({
      redisUrl: "redis://127.0.0.1:6379",
    });

    assert.ok(searchQueue.getBullQueue());
    assert.equal(searchQueue.getBullQueue().name, SEARCH_QUEUE_NAME);

    await searchQueue.close();
  });

  test("formats job data and default retry policy correctly", async () => {
    let capturedName = "";
    let capturedData: any = null;
    let capturedOpts: any = null;

    const mockBullQueue: any = {
      add: async (name: string, data: any, opts: any) => {
        capturedName = name;
        capturedData = data;
        capturedOpts = opts;
        return { id: "job-123", name, data };
      },
      close: async () => {},
    };

    const searchQueue = new SearchTargetQueue({ redisUrl: "redis://127.0.0.1:6379" });
    (searchQueue as any).queue = mockBullQueue;

    const job = await searchQueue.addTargetJob("target-99", "api", { priority: 1 });

    assert.equal(capturedName, "sweep-target-99");
    assert.equal(capturedData.targetId, "target-99");
    assert.equal(capturedData.triggerSource, "api");
    assert.ok(capturedData.timestamp);
    assert.equal(capturedOpts.attempts, 3);
    assert.equal(capturedOpts.priority, 1);
    assert.equal(job.id, "job-123");

    await searchQueue.close();
  });
});
