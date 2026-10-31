import "dotenv/config";
import { TelegramBotListener } from "@radar/notifications";

const bot = new TelegramBotListener({
  botToken: process.env.TELEGRAM_BOT_TOKEN || "",
  chatId: process.env.TELEGRAM_CHAT_ID,
});

async function main() {
  console.log("🤖 Starting Radar Price Interactive Telegram Bot...");
  await bot.start();
}

main().catch((err) => {
  console.error("❌ Fatal error in bot execution:", err);
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
