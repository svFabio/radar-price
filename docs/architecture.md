# Radar Price — Architecture Specification

High-performance, automated deal sniper and price intelligence system for Facebook Marketplace (with primary localization for Bolivia and LATAM markets).

---

## 1. System Overview

```mermaid
flowchart TD
    subgraph UI ["Client Layer"]
        Web["Web Dashboard (React/Vite)"]
    end

    subgraph CoreAPI ["API & Coordination"]
        API["API Gateway (Fastify/Express)"]
        DB[(PostgreSQL)]
        Queue["BullMQ / Redis"]
    end

    subgraph Workers ["Worker Engine"]
        Worker["Scraper Worker"]
        Playwright["Playwright + Stealth"]
        Session["Session / Cookie Manager"]
        Vision["Multimodal Vision Analyzer (Gemini / OpenAI)"]
        Ranker["Clustering & Value Ranker"]
    end

    subgraph Delivery ["Notification Adapters"]
        NotifService["Notification Service"]
        Telegram["Telegram Provider"]
        WhatsApp["WhatsApp Provider (Extensible)"]
    end

    Web -->|CRUD Search Targets & View Deals| API
    API -->|Persist state & targets| DB
    API -->|Enqueue search jobs| Queue
    Queue -->|Process job| Worker
    Worker -->|Execute browser session| Playwright
    Playwright -->|Cookies / Session| Session
    Playwright -->|Raw listings & image URLs| Worker
    Worker -->|1. Heuristic Filter| Worker
    Worker -->|2. Multimodal Extraction & Verification| Vision
    Vision -->|Extracted Specs & Real Price| Ranker
    Ranker -->|Persist Evaluated Deal| DB
    Ranker -->|Top Deals Alert| NotifService
    NotifService --> Telegram
    NotifService -.-> WhatsApp
```

---

## 2. Core Pillars & Design Decisions

### 2.1 The Two-Tier Filter (Cost & Latency Optimization)
Passing every raw scraped listing to a multimodal vision LLM is expensive and slow.
- **Tier 1 (Heuristic Engine - In-memory / CPU)**:
  - Filter out posts with keywords indicating buyer intent (`busco`, `compro`, `se busca`).
  - Filter out explicit junk (`repuestos`, `para piezas`, `bloqueado`, `iclou`).
  - Filter out extreme price outliers outside target search bounds (e.g. `price > maxPrice`).
  - Discard ~75% of noise without API calls.
- **Tier 2 (Multimodal AI Vision & OCR)**:
  - Download post images (up to 4 key images: screenshots of DxDiag, Windows specs, laptop chassis, stickers).
  - Extract structured JSON: exact CPU model, RAM amount, discrete GPU model, physical condition (1-10), and real price written in photos or text description.

### 2.2 Clustering & Arbitrage Ranking
- **Deduplication**: Match listings by title/model similarity and perceptual image hashing (`pHash`) to avoid repeated alerts when sellers repost identical items.
- **Fair Market Price (FMP) Baseline**: Compare the item against historical medians for the same hardware tier (e.g. RTX 3060 + Ryzen 7).
- **Deal Score Formulation**:
  $$\text{DealScore} = \left(\frac{\text{FairMarketPrice} - \text{RealPrice}}{\text{FairMarketPrice}}\right) \times 100 \times \text{ConditionFactor}$$

### 2.3 Pluggable Notification Architecture (Adapter Pattern)
- Decouple deal detection from notification delivery.
- Interface: `NotificationProvider`:
  - `TelegramNotificationProvider`: Default zero-cost, rich media delivery (photo albums, markdown specs, direct links).
  - `WhatsAppNotificationProvider`: Plug-in provider ready for WhatsApp Cloud API or local gateways (Evolution API).

---

## 3. Data Model (Prisma)

- **SearchTarget**: Query keywords, min/max price, location/coordinates, interval, status.
- **Listing**: Raw scraped post (external Facebook ID, title, listed price, URLs, images).
- **Evaluation**: Extracted hardware specs, real price, condition rating, deal score, AI reasoning.
- **Alert**: History of sent notifications to avoid alert spam.
