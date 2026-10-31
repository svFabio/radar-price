import Fastify, { FastifyInstance } from "fastify";
import { prisma as defaultPrisma } from "@radar/database";
import { WorkerPipeline } from "@radar/worker";

export interface AppOptions {
  prisma?: any;
  pipeline?: Pick<WorkerPipeline, "runTarget">;
  logger?: any;
}

export function buildApp(options: AppOptions = {}): FastifyInstance {
  const prisma = options.prisma ?? defaultPrisma;
  const pipeline = options.pipeline ?? new WorkerPipeline({ prisma });

  const app = Fastify({
    logger: options.logger ?? (process.env.NODE_ENV === "test" ? false : true),
  });

  // Health check
  app.get("/health", async () => {
    return { status: "ok", timestamp: new Date().toISOString() };
  });

  // List all search targets
  app.get("/api/targets", async () => {
    return prisma.searchTarget.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { listings: true },
        },
      },
    });
  });

  // Create a new search target
  app.post("/api/targets", async (req, reply) => {
    const body = req.body as any;

    if (!body || !body.name || !body.query) {
      return reply.status(400).send({ error: "name and query are required" });
    }

    const target = await prisma.searchTarget.create({
      data: {
        name: body.name,
        query: body.query,
        category: body.category || "electronics",
        minPrice: body.minPrice ? parseFloat(body.minPrice) : null,
        maxPrice: body.maxPrice ? parseFloat(body.maxPrice) : null,
        currency: body.currency || "BOB",
        location: body.location || "La Paz, Bolivia",
        keywordsInclude: body.keywordsInclude || [],
        keywordsExclude: body.keywordsExclude || [],
        intervalMinutes: body.intervalMinutes || 60,
      },
    });

    return reply.status(201).send(target);
  });

  // Delete a search target
  app.delete("/api/targets/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      await prisma.searchTarget.delete({ where: { id } });
      return { success: true };
    } catch {
      return reply.status(404).send({ error: "Target not found" });
    }
  });

  // Toggle active state of a search target (US-8.2)
  app.patch("/api/targets/:id/toggle", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as { active?: boolean } | undefined;

    const target = await prisma.searchTarget.findUnique({
      where: { id },
    });

    if (!target) {
      return reply.status(404).send({ error: "Target not found" });
    }

    const nextActive = typeof body?.active === "boolean" ? body.active : !target.active;

    const updated = await prisma.searchTarget.update({
      where: { id },
      data: { active: nextActive },
    });

    return reply.send(updated);
  });

  // Trigger manual immediate sweep for a specific target (US-8.2)
  app.post("/api/targets/:id/run", async (req, reply) => {
    const { id } = req.params as { id: string };
    const query = req.query as { async?: string };
    const body = (req.body || {}) as { async?: boolean };

    const target = await prisma.searchTarget.findUnique({
      where: { id },
    });

    if (!target) {
      return reply.status(404).send({ error: "Target not found" });
    }

    const isAsync = query?.async === "true" || body?.async === true;

    if (isAsync) {
      // Run background execution
      (async () => {
        try {
          await pipeline.runTarget(target);
        } catch (err) {
          app.log.error(err, `Error executing manual background sweep for target ${id}`);
        }
      })();

      return reply.status(202).send({
        success: true,
        message: "Sweep initiated in background",
        targetId: id,
      });
    }

    try {
      const summary = await pipeline.runTarget(target);
      return reply.send({
        success: true,
        message: "Sweep completed successfully",
        targetId: id,
        summary,
      });
    } catch (err: any) {
      app.log.error(err, `Error executing manual sweep for target ${id}`);
      return reply.status(500).send({
        error: "Sweep execution failed",
        details: err.message,
      });
    }
  });

  // Global counts and statistics (US-8.2)
  app.get("/api/stats", async () => {
    const [activeTargets, totalListings, totalDeals, totalAlerts] = await Promise.all([
      prisma.searchTarget.count({ where: { active: true } }),
      prisma.listing.count(),
      prisma.evaluation.count({ where: { isDeal: true } }),
      prisma.alert.count({ where: { status: "sent" } }),
    ]);

    return {
      activeTargets,
      totalListings,
      totalDeals,
      totalAlerts,
    };
  });

  // Get Top Deals
  app.get("/api/deals/top", async (req) => {
    const { limit = "10" } = req.query as { limit?: string };
    const parsedLimit = parseInt(limit, 10);
    const safeLimit = isNaN(parsedLimit) || parsedLimit <= 0 ? 10 : Math.min(parsedLimit, 50);

    const topEvaluations = await prisma.evaluation.findMany({
      where: {
        isDeal: true,
      },
      orderBy: {
        dealScore: "desc",
      },
      take: safeLimit,
      include: {
        listing: true,
      },
    });

    return topEvaluations;
  });

  return app;
}
