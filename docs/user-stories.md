# Radar Price — User Stories & Task Backlog

Structured backlog defining the functional requirements, acceptance criteria, and roadmap for the Facebook Marketplace Deal Sniper & Arbitrage platform.

---

## Progress Overview

| Epic | Scope | Status |
| :--- | :--- | :--- |
| **Epic 1: Extraction & Stealth** | Playwright scraper, cookies, session persistence, location handling | 🟡 In Progress (Core built, needs credentials test) |
| **Epic 2: Two-Tier Intelligence** | Heuristic noise filter + Gemini 2.0 Flash multimodal vision analyzer | 🟡 In Progress (Built, needs live API test) |
| **Epic 3: Clustering & Ranking** | Hardware tier clustering, deal scoring formula, Top 5/10 selection | 🟢 Done (Core algorithm implemented) |
| **Epic 4: Pluggable Delivery** | Notification Adapter, Telegram Bot rich cards/digest, WhatsApp stub | 🟢 Done (Telegram provider & adapter implemented) |
| **Epic 5: API & Coordination** | Fastify REST API, Prisma models, target management | 🟢 Done (Models and endpoints created) |
| **Epic 6: Web Dashboard** | React + Vite UI to manage targets, budgets, and view top deals | ⚪ Backlog |

---

## Epic 1: Extraction & Stealth Scraper Core

### US-1.1: Localized Search & Price Range Scraping
> **As an** arbitrageur monitoring deals in Bolivia,  
> **I want to** scrape Facebook Marketplace for specific queries in a chosen city within a price budget,  
> **So that** I only collect relevant listings without manual browsing.

- **Acceptance Criteria**:
  - [x] Scraper builds the localized URL: `https://facebook.com/marketplace/<city>/search?query=<q>&minPrice=<min>&maxPrice=<max>`.
  - [x] Extracts post `fbItemId`, title, displayed price, URL, and primary photo URL.
  - [ ] Handles pagination / infinite scroll with random human-like delays (jitter 1.5s - 3s).

### US-1.2: Session & Cookie Persistence
> **As an** automated worker,  
> **I want to** save and inject Facebook session cookies,  
> **So that** I don't trigger login checkpoints and can access authenticated Marketplace views.

- **Acceptance Criteria**:
  - [x] Cookie manager loads from `storage/fb_cookies.json` if available.
  - [x] Exports browser cookies on exit or manual dump.
  - [ ] Detects checkpoint / login redirect without crashing.

---

## Epic 2: Two-Tier Intelligence Pipeline

### US-2.1: Tier-1 Heuristic Filtering (Zero Token Cost)
> **As a** system operator,  
> **I want to** discard spam, buyer requests, and accessories in memory,  
> **So that** I don't waste LLM tokens or money on irrelevant posts.

- **Acceptance Criteria**:
  - [x] Filters out buyer intent patterns (`busco`, `compro`, `se busca`).
  - [x] Filters out junk/accessories (`repuesto`, `cargador`, `funda`, `pantalla rota`).
  - [x] Enforces min/max price boundaries with a 20% negotiation margin.

### US-2.2: Multimodal AI Spec & Real Price Extraction
> **As an** arbitrageur analyzing secondhand laptops,  
> **I want** an AI model to inspect listing photos and descriptions,  
> **So that** it accurately identifies CPU, RAM, discrete GPU, and the real price (bypassing fake "Bs 1" prices).

- **Acceptance Criteria**:
  - [x] Sends up to 3 listing photos (DxDiag screens, stickers, chassis) to Gemini 2.0 Flash.
  - [x] Enforces strict JSON Schema output (`brand`, `model`, `cpu`, `ramGb`, `gpu`, `realPrice`, `conditionRating`, `dealScore`, `reasoning`).
  - [x] Provides fallback mock evaluation when API key is missing.

---

## Epic 3: Clustering, Deduplication & Arbitrage Ranking

### US-3.1: Hardware Tier Clustering
> **As a** user viewing the Top Deals,  
> **I want** the system to group similar laptops into hardware tiers,  
> **So that** I don't receive 5 alerts for the exact same model from different sellers.

- **Acceptance Criteria**:
  - [x] Computes a normalized cluster key based on `brand-cpu-gpu`.
  - [x] Only picks the single best-value deal per cluster.

### US-3.2: Deal Score & Bargain Ranking
> **As an** arbitrageur looking for quick flips,  
> **I want** a formula that scores deals based on specs, condition, and market price difference,  
> **So that** the #1 spot is guaranteed to be the most profitable purchase.

- **Acceptance Criteria**:
  - [x] Compares real price against estimated market value.
  - [x] Produces a normalized score (0 to 100).
  - [x] Selects Top 5 / Top 10 highest-ranked candidates for digest alert.

---

## Epic 4: Pluggable Notification System

### US-4.1: Rich Telegram Alerts & Top 5 Digest
> **As an** investor/buyer on the move,  
> **I want to** receive Telegram cards with photos, specs, and direct Facebook links,  
> **So that** I can contact the seller immediately before someone else buys it.

- **Acceptance Criteria**:
  - [x] Sends individual deal alerts with photo caption and inline button linking to FB.
  - [x] Sends periodic Top 5 Daily/Hourly Digest with formatted specs and discount percentages.
  - [x] Gracefully falls back to text if photo fails to load.

### US-4.2: Extensible WhatsApp Notification Provider
> **As a** business operator planning to scale,  
> **I want** the notification layer decoupled behind an interface,  
> **So that** I can add WhatsApp Business / Cloud API alerts without rewriting the scraper.

- **Acceptance Criteria**:
  - [x] Generic `NotificationProvider` interface implemented.
  - [x] `WhatsAppNotificationProvider` stub ready for HTTP API integration.

---

## Epic 5: API & Search Target Coordination

### US-5.1: Search Target CRUD
> **As an** operator,  
> **I want** an API to define what to look for (e.g. "Laptops Gamer 2000-5000 Bs"),  
> **So that** the worker knows what queries to execute.

- **Acceptance Criteria**:
  - [x] `GET /api/targets`: Lists active search targets.
  - [x] `POST /api/targets`: Creates new target with keywords, price range, and interval.
  - [x] `GET /api/deals/top`: Returns currently stored top deals from PostgreSQL.

---

## Epic 6: Web Management Dashboard

### US-6.1: Search Target Manager UI
> **As a** non-technical user,  
> **I want** a clean web interface to set up new searches,  
> **So that** I don't have to edit code or JSON files to change my budget.

- **Acceptance Criteria**:
  - [ ] Form to create/edit search targets (query, min/max price, city, keywords).
  - [ ] Switch to pause/activate targets.

### US-6.2: Live Top Deals Feed
> **As a** buyer,  
> **I want** a grid or table showing the latest Top 5/10 deals with photos and spec tags,  
> **So that** I can browse opportunities from my desktop.

- **Acceptance Criteria**:
  - [ ] Card grid displaying photo, model, CPU, RAM, GPU tags, deal score badge, and FB link.
