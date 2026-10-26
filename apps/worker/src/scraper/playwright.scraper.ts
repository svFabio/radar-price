import { chromium, Browser, BrowserContext, Page } from "playwright";
import fs from "fs/promises";
import path from "path";
import { RawScrapedListing } from "../analyzer/heuristic.filter.js";

export interface ScraperSearchOptions {
  query: string;
  city?: string;
  minPrice?: number | null;
  maxPrice?: number | null;
  limit?: number;
  maxScrolls?: number;
  minScrollDelayMs?: number;
  maxScrollDelayMs?: number;
}

export class PlaywrightMarketplaceScraper {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private cookiePath: string;

  constructor(cookiePath: string = "./storage/fb_cookies.json") {
    this.cookiePath = path.resolve(cookiePath);
  }

  async init(headless: boolean = true): Promise<void> {
    this.browser = await chromium.launch({
      headless,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-blink-features=AutomationControlled",
        "--disable-infobars",
      ],
    });

    this.context = await this.browser.newContext({
      userAgent:
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 800 },
      locale: "es-BO",
      timezoneId: "America/La_Paz",
    });

    // Load session cookies if saved
    try {
      const data = await fs.readFile(this.cookiePath, "utf-8");
      const cookies = JSON.parse(data);
      await this.context.addCookies(cookies);
      console.log(`[Scraper] Loaded ${cookies.length} session cookies from ${this.cookiePath}`);
    } catch {
      console.log("[Scraper] No existing cookies found. Running with guest context.");
    }
  }

  async scrapeSearch(options: ScraperSearchOptions): Promise<RawScrapedListing[]> {
    if (!this.context) {
      throw new Error("Scraper not initialized. Call init() first.");
    }

    const citySlug = options.city ? encodeURIComponent(options.city.toLowerCase().replace(/[^a-z0-9]/g, "")) : "lapaz";
    const encodedQuery = encodeURIComponent(options.query);
    let targetUrl = `https://www.facebook.com/marketplace/${citySlug}/search?query=${encodedQuery}`;

    if (options.minPrice) targetUrl += `&minPrice=${options.minPrice}`;
    if (options.maxPrice) targetUrl += `&maxPrice=${options.maxPrice}`;

    console.log(`[Scraper] Navigating to: ${targetUrl}`);
    const page: Page = await this.context.newPage();

    const listings: RawScrapedListing[] = [];

    try {
      await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 30000 });

      // Check for login wall or checkpoint
      const content = await page.content();
      if (content.includes("checkpoint") || content.includes("login_form")) {
        console.warn("[Scraper] Warning: Facebook requested login or checkpoint.");
      }

      // Smooth human scroll to load infinite scroll items with randomized jitter
      const maxScrolls = options.maxScrolls ?? 5;
      const minDelay = options.minScrollDelayMs ?? 1500;
      const maxDelay = options.maxScrollDelayMs ?? 3000;

      for (let i = 0; i < maxScrolls; i++) {
        // Vary scroll distance and add micro-movements
        const scrollAmount = 800 + Math.floor(Math.random() * 400);
        await page.mouse.wheel(0, scrollAmount);
        
        // Random human delay between minDelay and maxDelay
        const jitter = minDelay + Math.random() * (maxDelay - minDelay);
        await page.waitForTimeout(jitter);

        // Check if we already have enough items
        const currentItems = await page.$$("a[href*='/marketplace/item/']");
        if (options.limit && currentItems.length >= options.limit * 1.5) {
          break;
        }
      }

      // Parse marketplace items
      const rawElements = await page.$$("a[href*='/marketplace/item/']");
      console.log(`[Scraper] Found ${rawElements.length} potential listing links.`);

      const seenIds = new Set<string>();

      for (const el of rawElements) {
        if (options.limit && listings.length >= options.limit) break;

        const href = (await el.getAttribute("href")) || "";
        const match = href.match(/\/marketplace\/item\/(\d+)/);
        if (!match) continue;

        const fbItemId = match[1];
        if (seenIds.has(fbItemId)) continue;
        seenIds.add(fbItemId);

        const fullUrl = href.startsWith("http") ? href : `https://www.facebook.com${href}`;

        // Extract title, price and image
        const textContent = (await el.innerText()).split("\n").filter(Boolean);
        const imgEl = await el.$("img");
        let imgSrc = "";
        if (imgEl) {
          imgSrc = (await imgEl.getAttribute("src")) || "";
          if (!imgSrc || imgSrc.startsWith("data:")) {
            const srcset = await imgEl.getAttribute("srcset");
            if (srcset) {
              const parts = srcset.split(",");
              const last = parts[parts.length - 1]?.trim().split(" ")[0];
              if (last) imgSrc = last;
            }
          }
        }

        // Facebook usually renders: [Price, Title, Location]
        let priceNumber: number | null = null;
        let title = "Laptop";

        for (const line of textContent) {
          const cleanLine = line.trim();
          // Match Bolivian currency formats like "Bs 3,500" or "$ 500"
          const priceMatch = cleanLine.match(/(?:bs\.?|bob|\$)\s*([\d,.]+)/i) || cleanLine.match(/^([\d,.]+)$/);
          if (priceMatch && priceNumber === null) {
            priceNumber = parseFloat(priceMatch[1].replace(/,/g, ""));
          } else if (cleanLine.length > 5 && !cleanLine.toLowerCase().includes("la paz") && title === "Laptop") {
            title = cleanLine;
          }
        }

        listings.push({
          fbItemId,
          title,
          listedPrice: priceNumber,
          currency: "BOB",
          url: fullUrl,
          imageUrls: imgSrc ? [imgSrc] : [],
          location: options.city || "La Paz, Bolivia",
        });
      }
    } catch (error) {
      console.error("[Scraper] Error scraping Facebook Marketplace:", error);
    } finally {
      await page.close();
    }

    return listings;
  }

  async saveCookies(): Promise<void> {
    if (!this.context) return;
    try {
      const cookies = await this.context.cookies();
      await fs.mkdir(path.dirname(this.cookiePath), { recursive: true });
      await fs.writeFile(this.cookiePath, JSON.stringify(cookies, null, 2));
      console.log(`[Scraper] Saved ${cookies.length} cookies.`);
    } catch (e) {
      console.error("[Scraper] Failed to save cookies:", e);
    }
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
    }
  }
}
