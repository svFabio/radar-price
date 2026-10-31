import "dotenv/config";
import { TelegramBotListener } from "./telegram.bot.js";

const bot = new TelegramBotListener({
  botToken: process.env.TELEGRAM_BOT_TOKEN || "",
  chatId: process.env.TELEGRAM_CHAT_ID,
});

async function main() {
  console.log("==========================================");
  console.log("🤖 RADAR PRICE — Telegram Interactive Bot");
  console.log("==========================================");
  await bot.start();
}

main().catch((err) => {
  console.error("❌ Fatal error in bot runner:", err);
  process.exit(1);
});

process.on("SIGINT", async () => {
  console.log("\n🛑 Stopping Telegram Bot...");
  await bot.stop();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\n🛑 Stopping Telegram Bot...");
  await bot.stop();
  process.exit(0);
});
