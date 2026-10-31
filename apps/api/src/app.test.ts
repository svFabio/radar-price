import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "./app.js";

describe("API Control and Trigger Endpoints (US-8.2)", () => {
  describe("1. Basic Endpoints & Health", () => {
    test("GET /health returns status ok", async () => {
      const app = buildApp({
        prisma: {},
        pipeline: { runTarget: async () => ({} as any) },
      });

      const res = await app.inject({
        method: "GET",
        url: "/health",
      });

      assert.equal(res.statusCode, 200);
      const body = res.json();
      assert.equal(body.status, "ok");
      assert.ok(body.timestamp);
    });

    test("GET /api/targets returns targets list from database", async () => {
      const targets = [{ id: "t1", name: "Target 1", query: "laptop" }];
      const mockPrisma = {
        searchTarget: {
          findMany: async () => targets,
        },
      };

      const app = buildApp({
        prisma: mockPrisma,
        pipeline: { runTarget: async () => ({} as any) },
      });

      const res = await app.inject({
        method: "GET",
        url: "/api/targets",
      });

      assert.equal(res.statusCode, 200);
      assert.deepEqual(res.json(), targets);
    });

    test("POST /api/targets validates required fields", async () => {
      const app = buildApp({
        prisma: {},
        pipeline: { runTarget: async () => ({} as any) },
      });

      const res = await app.inject({
        method: "POST",
        url: "/api/targets",
        payload: { name: "Missing Query" },
      });

      assert.equal(res.statusCode, 400);
      assert.equal(res.json().error, "name and query are required");
    });
  });

  describe("2. PATCH /api/targets/:id/toggle", () => {
    test("returns 404 when target does not exist", async () => {
      const mockPrisma = {
        searchTarget: {
          findUnique: async () => null,
        },
      };

      const app = buildApp({
        prisma: mockPrisma,
        pipeline: { runTarget: async () => ({} as any) },
      });

      const res = await app.inject({
        method: "PATCH",
        url: "/api/targets/non-existent-id/toggle",
      });

      assert.equal(res.statusCode, 404);
      assert.equal(res.json().error, "Target not found");
    });

    test("toggles active boolean from true to false when no payload provided", async () => {
      const existing = { id: "t1", name: "Laptop Gamer", active: true };
      let updatedData: any = null;

      const mockPrisma = {
        searchTarget: {
          findUnique: async ({ where }: any) => (where.id === "t1" ? existing : null),
          update: async ({ where, data }: any) => {
            updatedData = data;
            return { ...existing, ...data };
          },
        },
      };

      const app = buildApp({
        prisma: mockPrisma,
        pipeline: { runTarget: async () => ({} as any) },
      });

      const res = await app.inject({
        method: "PATCH",
        url: "/api/targets/t1/toggle",
      });

      assert.equal(res.statusCode, 200);
      assert.equal(updatedData.active, false);
      assert.equal(res.json().active, false);
    });

    test("toggles active boolean from false to true when no payload provided", async () => {
      const existing = { id: "t2", name: "ThinkPad", active: false };
      let updatedData: any = null;

      const mockPrisma = {
        searchTarget: {
          findUnique: async ({ where }: any) => (where.id === "t2" ? existing : null),
          update: async ({ where, data }: any) => {
            updatedData = data;
            return { ...existing, ...data };
          },
        },
      };

      const app = buildApp({
        prisma: mockPrisma,
        pipeline: { runTarget: async () => ({} as any) },
      });

      const res = await app.inject({
        method: "PATCH",
        url: "/api/targets/t2/toggle",
      });

      assert.equal(res.statusCode, 200);
      assert.equal(updatedData.active, true);
      assert.equal(res.json().active, true);
    });

    test("sets explicit active boolean when payload is provided", async () => {
      const existing = { id: "t3", name: "MacBook", active: true };
      let updatedData: any = null;

      const mockPrisma = {
        searchTarget: {
          findUnique: async () => existing,
          update: async ({ data }: any) => {
            updatedData = data;
            return { ...existing, ...data };
          },
        },
      };

      const app = buildApp({
        prisma: mockPrisma,
        pipeline: { runTarget: async () => ({} as any) },
      });

      const res = await app.inject({
        method: "PATCH",
        url: "/api/targets/t3/toggle",
        payload: { active: false },
      });

      assert.equal(res.statusCode, 200);
      assert.equal(updatedData.active, false);
      assert.equal(res.json().active, false);
    });
  });

  describe("3. POST /api/targets/:id/run", () => {
    test("returns 404 when target does not exist", async () => {
      const mockPrisma = {
        searchTarget: {
          findUnique: async () => null,
        },
      };

      const app = buildApp({
        prisma: mockPrisma,
        pipeline: { runTarget: async () => ({} as any) },
      });

      const res = await app.inject({
        method: "POST",
        url: "/api/targets/missing-id/run",
      });

      assert.equal(res.statusCode, 404);
      assert.equal(res.json().error, "Target not found");
    });

    test("executes immediate sweep on-demand and returns 200 with process summary", async () => {
      const target = { id: "target-run-1", name: "RTX 3060", active: true };
      let executedTarget: any = null;

      const mockPrisma = {
        searchTarget: {
          findUnique: async ({ where }: any) =>
            where.id === "target-run-1" ? target : null,
        },
      };

      const mockPipeline = {
        runTarget: async (t: any) => {
          executedTarget = t;
          return {
            rawCount: 15,
            passedHeuristicsCount: 10,
            reusedEvaluationsCount: 4,
            newEvaluationsCount: 6,
            dispatchedAlertsCount: 2,
          };
        },
      };

      const app = buildApp({
        prisma: mockPrisma,
        pipeline: mockPipeline,
      });

      const res = await app.inject({
        method: "POST",
        url: "/api/targets/target-run-1/run",
      });

      assert.equal(res.statusCode, 200);
      assert.equal(executedTarget.id, "target-run-1");
      const body = res.json();
      assert.equal(body.success, true);
      assert.equal(body.targetId, "target-run-1");
      assert.equal(body.summary.dispatchedAlertsCount, 2);
    });

    test("accepts async=true query param to run in background and returns 202", async () => {
      const target = { id: "target-async", name: "Async Run Target", active: true };
      let pipelineStarted = false;

      const mockPrisma = {
        searchTarget: {
          findUnique: async () => target,
        },
      };

      const mockPipeline = {
        runTarget: async () => {
          pipelineStarted = true;
          return {} as any;
        },
      };

      const app = buildApp({
        prisma: mockPrisma,
        pipeline: mockPipeline,
      });

      const res = await app.inject({
        method: "POST",
        url: "/api/targets/target-async/run?async=true",
      });

      assert.equal(res.statusCode, 202);
      const body = res.json();
      assert.equal(body.success, true);
      assert.equal(body.targetId, "target-async");
      assert.equal(body.message, "Sweep initiated in background");
      assert.equal(pipelineStarted, true);
    });

    test("returns 500 when pipeline execution throws an error", async () => {
      const target = { id: "target-error", name: "Failing Target", active: true };

      const mockPrisma = {
        searchTarget: {
          findUnique: async () => target,
        },
      };

      const mockPipeline = {
        runTarget: async () => {
          throw new Error("Chromium launch crashed");
        },
      };

      const app = buildApp({
        prisma: mockPrisma,
        pipeline: mockPipeline,
      });

      const res = await app.inject({
        method: "POST",
        url: "/api/targets/target-error/run",
      });

      assert.equal(res.statusCode, 500);
      const body = res.json();
      assert.equal(body.error, "Sweep execution failed");
      assert.equal(body.details, "Chromium launch crashed");
    });
  });

  describe("4. GET /api/stats", () => {
    test("returns general counts for active targets, listings, deals, and alerts", async () => {
      const mockPrisma = {
        searchTarget: {
          count: async ({ where }: any) => {
            if (where?.active) return 7;
            return 10;
          },
        },
        listing: {
          count: async () => 142,
        },
        evaluation: {
          count: async ({ where }: any) => {
            if (where?.isDeal) return 23;
            return 80;
          },
        },
        alert: {
          count: async ({ where }: any) => {
            if (where?.status === "sent") return 19;
            return 25;
          },
        },
      };

      const app = buildApp({
        prisma: mockPrisma,
        pipeline: { runTarget: async () => ({} as any) },
      });

      const res = await app.inject({
        method: "GET",
        url: "/api/stats",
      });

      assert.equal(res.statusCode, 200);
      const stats = res.json();
      assert.equal(stats.activeTargets, 7);
      assert.equal(stats.totalListings, 142);
      assert.equal(stats.totalDeals, 23);
      assert.equal(stats.totalAlerts, 19);
    });
  });

  describe("5. GET /api/deals/top", () => {
    test("handles invalid non-numeric limit safely by falling back to default 10", async () => {
      let capturedArgs: any;
      const mockPrisma = {
        evaluation: {
          findMany: async (args: any) => {
            capturedArgs = args;
            if (Number.isNaN(args?.take)) {
              throw new Error("PrismaClientValidationError: take must not be NaN");
            }
            return [{ id: "deal-1", dealScore: 95 }];
          },
        },
      };

      const app = buildApp({ prisma: mockPrisma });

      const res = await app.inject({
        method: "GET",
        url: "/api/deals/top?limit=invalid_number",
      });

      assert.equal(res.statusCode, 200);
      assert.equal(capturedArgs.take, 10);
    });

    test("clamps negative or zero limit to default 10", async () => {
      let capturedArgs: any;
      const mockPrisma = {
        evaluation: {
          findMany: async (args: any) => {
            capturedArgs = args;
            return [];
          },
        },
      };

      const app = buildApp({ prisma: mockPrisma });

      const res = await app.inject({
        method: "GET",
        url: "/api/deals/top?limit=-5",
      });

      assert.equal(res.statusCode, 200);
      assert.equal(capturedArgs.take, 10);
    });

    test("caps excessive limit to maximum of 50", async () => {
      let capturedArgs: any;
      const mockPrisma = {
        evaluation: {
          findMany: async (args: any) => {
            capturedArgs = args;
            return [];
          },
        },
      };

      const app = buildApp({ prisma: mockPrisma });

      const res = await app.inject({
        method: "GET",
        url: "/api/deals/top?limit=250",
      });

      assert.equal(res.statusCode, 200);
      assert.equal(capturedArgs.take, 50);
    });
  });
});
