import "dotenv/config";
import { WorkerPipeline } from "./pipeline.js";

export * from "./pipeline.js";

async function main() {
  const pipeline = new WorkerPipeline();
  await pipeline.run();
}

main().catch((err) => {
  console.error("❌ Fatal error in worker execution:", err);
  process.exit(1);
});
