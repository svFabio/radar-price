import "dotenv/config";
import { buildApp } from "./app.js";

export * from "./app.js";

const app = buildApp();

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
