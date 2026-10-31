import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { isTargetDue, SweepScheduler } from "./scheduler.js";

describe("SweepScheduler (US-8.1)", () => {
  describe("1. isTargetDue evaluation", () => {
    const fixedNow = new Date("2026-10-30T12:00:00.000Z");

    test("returns false when active is false, regardless of lastRunAt", () => {
      assert.equal(
        isTargetDue({ active: false, intervalMinutes: 60, lastRunAt: null }, fixedNow),
        false
      );
      assert.equal(
        isTargetDue(
          {
            active: false,
            intervalMinutes: 10,
            lastRunAt: new Date("2026-10-30T10:00:00.000Z"),
          },
          fixedNow
        ),
        false
      );
    });

    test("returns true when active is true and lastRunAt is null (never executed)", () => {
      assert.equal(
        isTargetDue({ active: true, intervalMinutes: 60, lastRunAt: null }, fixedNow),
        true
      );
      assert.equal(
        isTargetDue({ active: true, intervalMinutes: 30, lastRunAt: undefined }, fixedNow),
        true
      );
    });

    test("returns false when lastRunAt + intervalMinutes is in the future", () => {
      const thirtyMinutesAgo = new Date("2026-10-30T11:30:00.000Z");
      assert.equal(
        isTargetDue(
          { active: true, intervalMinutes: 60, lastRunAt: thirtyMinutesAgo },
          fixedNow
        ),
        false
      );
    });

    test("returns true when lastRunAt + intervalMinutes <= now", () => {
      const sixtyMinutesAgo = new Date("2026-10-30T11:00:00.000Z");
      assert.equal(
        isTargetDue(
          { active: true, intervalMinutes: 60, lastRunAt: sixtyMinutesAgo },
          fixedNow
        ),
        true
      );

      const ninetyMinutesAgo = new Date("2026-10-30T10:30:00.000Z");
      assert.equal(
        isTargetDue(
          { active: true, intervalMinutes: 60, lastRunAt: ninetyMinutesAgo },
          fixedNow
        ),
        true
      );
    });

    test("defaults intervalMinutes to 60 if invalid or non-positive", () => {
      const fiftyMinutesAgo = new Date("2026-10-30T11:10:00.000Z");
      const seventyMinutesAgo = new Date("2026-10-30T10:50:00.000Z");

      assert.equal(
        isTargetDue({ active: true, intervalMinutes: 0, lastRunAt: fiftyMinutesAgo }, fixedNow),
        false
      );
      assert.equal(
        isTargetDue({ active: true, intervalMinutes: 0, lastRunAt: seventyMinutesAgo }, fixedNow),
        true
      );
    });
  });

  describe("2. Queue Prioritization & Overdue Filtering", () => {
    const fixedNow = new Date("2026-10-30T12:00:00.000Z");

    test("filters out non-due targets and sorts never-run targets first, then oldest overdue", async () => {
      const targets = [
        {
          id: "target-not-due",
          name: "Recent Target",
          active: true,
          intervalMinutes: 60,
          lastRunAt: new Date("2026-10-30T11:45:00.000Z"),
        },
        {
          id: "target-moderately-overdue",
          name: "Moderately Overdue",
          active: true,
          intervalMinutes: 60,
          lastRunAt: new Date("2026-10-30T10:30:00.000Z"),
        },
        {
          id: "target-never-run",
          name: "New Never Run Target",
          active: true,
          intervalMinutes: 60,
          lastRunAt: null,
        },
        {
          id: "target-very-overdue",
          name: "Very Overdue",
          active: true,
          intervalMinutes: 60,
          lastRunAt: new Date("2026-10-30T09:00:00.000Z"),
        },
      ];

      const mockPrisma = {
        searchTarget: {
          findMany: async ({ where }: any) => {
            if (where?.active) return targets;
            return [];
          },
        },
      };

      const scheduler = new SweepScheduler({
        prisma: mockPrisma,
        pipeline: {
          init: async () => {},
          close: async () => {},
          processTarget: async () => ({} as any),
        },
      });

      const due = await scheduler.getDueTargets(fixedNow);

      assert.equal(due.length, 3, "Only the 3 overdue/never-run targets should be returned");
      assert.equal(due[0].id, "target-never-run", "Never-run targets should come first");
      assert.equal(due[1].id, "target-very-overdue", "Longest overdue target comes next");
      assert.equal(due[2].id, "target-moderately-overdue", "Moderately overdue target comes last");
    });

    test("returns empty array when no targets are active or due", async () => {
      const mockPrisma = {
        searchTarget: {
          findMany: async () => [],
        },
      };

      const scheduler = new SweepScheduler({
        prisma: mockPrisma,
        pipeline: {
          init: async () => {},
          close: async () => {},
          processTarget: async () => ({} as any),
        },
      });

      const due = await scheduler.getDueTargets(fixedNow);
      assert.deepEqual(due, []);
    });
  });

  describe("3. Queue Execution & Human Jitter", () => {
    const fixedNow = new Date("2026-10-30T12:00:00.000Z");

    test("processes each due target and respects human delay configuration", async () => {
      const targets = [
        { id: "t1", name: "Target 1", active: true, intervalMinutes: 60, lastRunAt: null },
        { id: "t2", name: "Target 2", active: true, intervalMinutes: 60, lastRunAt: null },
      ];

      const processedIds: string[] = [];

      const mockPrisma = {
        searchTarget: {
          findMany: async () => targets,
          update: async () => {},
        },
      };

      const mockPipeline = {
        init: async () => {},
        close: async () => {},
        processTarget: async (target: any) => {
          processedIds.push(target.id);
          return {
            rawCount: 1,
            passedHeuristicsCount: 1,
            reusedEvaluationsCount: 0,
            newEvaluationsCount: 1,
            dispatchedAlertsCount: 0,
          };
        },
      };

      const scheduler = new SweepScheduler({
        prisma: mockPrisma,
        pipeline: mockPipeline,
        minHumanDelayMs: 5,
        maxHumanDelayMs: 15,
      });

      const processed = await scheduler.processQueue(fixedNow);

      assert.equal(processed, 2);
      assert.deepEqual(processedIds, ["t1", "t2"]);
    });

    test("handles errors in individual targets by updating lastRunAt to prevent endless retry loops", async () => {
      const targets = [
        { id: "failing-target", name: "Fails On Scrape", active: true, intervalMinutes: 60, lastRunAt: null },
        { id: "working-target", name: "Works Fine", active: true, intervalMinutes: 60, lastRunAt: null },
      ];

      let updatedId = "";
      let updatedLastRunAt: any = null;

      const mockPrisma = {
        searchTarget: {
          findMany: async () => targets,
          update: async ({ where, data }: any) => {
            updatedId = where.id;
            updatedLastRunAt = data.lastRunAt;
            return { id: where.id, ...data };
          },
        },
      };

      const processedIds: string[] = [];
      const mockPipeline = {
        init: async () => {},
        close: async () => {},
        processTarget: async (target: any) => {
          if (target.id === "failing-target") {
            throw new Error("Facebook connection timeout");
          }
          processedIds.push(target.id);
          return {} as any;
        },
      };

      const scheduler = new SweepScheduler({
        prisma: mockPrisma,
        pipeline: mockPipeline,
        minHumanDelayMs: 1,
        maxHumanDelayMs: 2,
      });

      const processed = await scheduler.processQueue(fixedNow);

      assert.equal(processed, 1);
      assert.deepEqual(processedIds, ["working-target"]);
      assert.equal(updatedId, "failing-target");
      assert.ok(updatedLastRunAt instanceof Date);
    });
  });

  describe("4. Lifecycle & Graceful Shutdown (Playwright Clean Close)", () => {
    test("initializes pipeline and closes scraper cleanly on stop()", async () => {
      let initialized = false;
      let closed = false;

      const mockPipeline = {
        init: async () => {
          initialized = true;
        },
        close: async () => {
          closed = true;
        },
        processTarget: async () => ({} as any),
      };

      const mockPrisma = {
        searchTarget: {
          findMany: async () => [],
        },
      };

      const scheduler = new SweepScheduler({
        prisma: mockPrisma,
        pipeline: mockPipeline,
        checkIntervalMs: 50,
      });

      const startPromise = scheduler.start();
      await new Promise((r) => setTimeout(r, 20));

      assert.equal(initialized, true, "Pipeline should be initialized on start");

      await scheduler.stop();
      await startPromise;

      assert.equal(closed, true, "Playwright scraper should be closed cleanly on stop");
    });
  });
});
