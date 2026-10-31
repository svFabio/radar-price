import "dotenv/config";
import { fileURLToPath } from "node:url";
import { WorkerPipeline } from "./pipeline.js";

export * from "./pipeline.js";
export * from "./scheduler.js";

async function main() {
  const pipeline = new WorkerPipeline();
  await pipeline.run();
}

function isDirectExecution(): boolean {
  if (!process.argv[1]) return false;
  try {
    return fileURLToPath(import.meta.url) === process.argv[1];
  } catch {
    return false;
  }
}

if (process.env.NODE_ENV !== "test" && isDirectExecution()) {
  main().catch((err) => {
    console.error("❌ Fatal error in worker execution:", err);
    process.exit(1);
  });
}
