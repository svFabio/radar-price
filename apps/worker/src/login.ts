import "dotenv/config";
import { PlaywrightMarketplaceScraper } from "./scraper/playwright.scraper.js";

async function main() {
  const cookiePath = process.env.FACEBOOK_SESSION_COOKIE_PATH || "./storage/fb_cookies.json";
  const scraper = new PlaywrightMarketplaceScraper(cookiePath);
  
  const success = await scraper.saveSessionInteractive(120000);
  if (success) {
    console.log("🎉 Cookies successfully captured! You can now run the worker in headless mode.");
    process.exit(0);
  } else {
    console.warn("⚠️ Login timed out or was not completed. Please try again.");
    process.exit(1);
  }
}

main();
