# Radar Price 🎯

Intelligent, automated deal monitoring and arbitrage engine for **Facebook Marketplace** (optimized for Bolivia & LATAM).

## Features
- **Headless Browser Stealth**: Automated extraction using Playwright with human jitter and cookie persistence.
- **Two-Tier Filtering**:
  - **Tier 1 (Heuristic)**: In-memory rejection of buyer requests ("busco", "compro"), accessories, broken items, and outlier prices.
  - **Tier 2 (Multimodal AI Vision)**: Powered by Gemini Flash / Vision to extract real hardware specs (CPU, RAM, GPU) and true prices from photos (DxDiag, stickers).
- **Clustering & Top 5 Arbitrage**: Groups equivalent hardware tiers together and selects the lowest price for the highest quality.
- **Pluggable Notifications**: Modular adapter pattern with ready-to-use Telegram Bot integration and extensible WhatsApp provider.
- **Full Architecture**: Documented in [`docs/architecture.md`](./docs/architecture.md).

## Quickstart
```bash
# 1. Start database & Redis
docker compose up -d

# 2. Configure environment
cp .env.example .env
# Fill in GEMINI_API_KEY and TELEGRAM_BOT_TOKEN / CHAT_ID

# 3. Generate Prisma client
pnpm prisma:generate

# 4. Run worker
pnpm dev:worker
```
