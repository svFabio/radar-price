import "dotenv/config";
import Fastify from "fastify";
import { prisma } from "@radar/database";

const app = Fastify({ logger: true });

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

  if (!body.name || !body.query) {
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
  await prisma.searchTarget.delete({ where: { id } });
  return { success: true };
});

// Get Top Deals
app.get("/api/deals/top", async (req) => {
  const { limit = "10" } = req.query as { limit?: string };

  const topEvaluations = await prisma.evaluation.findMany({
    where: {
      isDeal: true,
    },
    orderBy: {
      dealScore: "desc",
    },
    take: parseInt(limit, 10),
    include: {
      listing: true,
    },
  });

  return topEvaluations;
});

const start = async () => {
  const port = parseInt(process.env.PORT || "3000", 10);
  try {
    await app.listen({ port, host: "0.0.0.0" });
    console.log(`Server listening on http://localhost:${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
