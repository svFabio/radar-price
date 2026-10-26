#!/usr/bin/env bash
set -e

REPO="svFabio/radar-price"
PROJECT_NUM=9
PROJECT_ID="PVT_kwHOCk-mm84BouTx"
STATUS_FIELD_ID="PVTSSF_lAHOCk-mm84BouTxzhnNDFg"
PRIORITY_FIELD_ID="PVTSSF_lAHOCk-mm84BouTxzhnNDWY"
OWNER="svFabio"

STATUS_BACKLOG="f75ad846"
STATUS_IN_PROGRESS="47fc9ee4"
STATUS_DONE="98236657"

PRIORITY_P0="79628723"
PRIORITY_P1="0a877460"

echo "=== 1. Creating User Story Issues (#1 to #11) ==="

create_story() {
  local title="$1"
  local label="$2"
  local status_opt="$3"
  local priority_opt="$4"
  local body="$5"

  echo "--> Creating Story: $title"
  issue_url=$(gh issue create --repo "$REPO" --title "$title" --label "$label" --body "$body" --project "radar-price-kanb")
  issue_num=$(echo "$issue_url" | grep -oE '[0-9]+$')
  echo "    Created #$issue_num: $issue_url"

  # Find Project Item ID for this newly added issue
  item_id=$(gh project item-list "$PROJECT_NUM" --owner "$OWNER" --format json --jq ".items[] | select(.content.number == $issue_num) | .id")

  if [ -n "$item_id" ]; then
    gh project item-edit --id "$item_id" --project-id "$PROJECT_ID" --field-id "$STATUS_FIELD_ID" --single-select-option-id "$status_opt" > /dev/null
    gh project item-edit --id "$item_id" --project-id "$PROJECT_ID" --field-id "$PRIORITY_FIELD_ID" --single-select-option-id "$priority_opt" > /dev/null
  fi
}

# 1
create_story \
  "US-1.1: Localized Search & Price Range Scraping" \
  "scraper" \
  "$STATUS_IN_PROGRESS" \
  "$PRIORITY_P0" \
  "As an arbitrageur, I want to scrape Facebook Marketplace for specific queries in a chosen city within a price budget.\n\n### Acceptance Criteria\n- [x] Scraper builds localized URL for city and price limits.\n- [x] Extracts post ID, title, price, URL, and image URLs.\n- [ ] Infinite scroll with human-like jitter delays."

# 2
create_story \
  "US-1.2: Session & Cookie Persistence (Anti-Checkpoint)" \
  "scraper" \
  "$STATUS_IN_PROGRESS" \
  "$PRIORITY_P0" \
  "As an automated worker, I want to save and inject Facebook cookies to bypass login checkpoints.\n\n### Acceptance Criteria\n- [x] Cookie loader from JSON storage.\n- [x] Auto-save cookies on session update.\n- [ ] Checkpoint detection and warning."

# 3
create_story \
  "US-2.1: Tier-1 Heuristic Filtering (Zero Token Cost)" \
  "ai" \
  "$STATUS_DONE" \
  "$PRIORITY_P0" \
  "As a system operator, I want to discard buyer requests ('busco', 'compro') and accessories in memory.\n\n### Acceptance Criteria\n- [x] Filters buyer intent regexes.\n- [x] Filters junk accessories.\n- [x] Enforces price threshold."

# 4
create_story \
  "US-2.2: Multimodal AI Spec & Real Price Extraction (Gemini Flash)" \
  "ai" \
  "$STATUS_IN_PROGRESS" \
  "$PRIORITY_P0" \
  "As an arbitrageur, I want Gemini 2.0 Flash to inspect listing photos and extract true CPU, RAM, GPU, and real price in BOB.\n\n### Acceptance Criteria\n- [x] Gemini Flash structured JSON output.\n- [x] Photo base64 downloader and injector.\n- [ ] Live verification with real Facebook listings."

# 5
create_story \
  "US-3.1: Hardware Tier Clustering (Deduplication)" \
  "ranking" \
  "$STATUS_DONE" \
  "$PRIORITY_P1" \
  "As a user, I want the system to group similar laptops into hardware tiers so I do not receive duplicate alerts for the same model.\n\n### Acceptance Criteria\n- [x] Clustering by brand-cpu-gpu key.\n- [x] Single best deal selected per cluster."

# 6
create_story \
  "US-3.2: Deal Score & Bargain Ranking (Top 5)" \
  "ranking" \
  "$STATUS_DONE" \
  "$PRIORITY_P0" \
  "As an arbitrageur, I want an automated deal scoring formula that computes price-to-performance against fair market value.\n\n### Acceptance Criteria\n- [x] Deal score (0-100) calculation.\n- [x] Top 5 / Top 10 digest selector."

# 7
create_story \
  "US-4.1: Telegram Rich Deal Cards & Periodic Top 5 Digest" \
  "notifications" \
  "$STATUS_DONE" \
  "$PRIORITY_P0" \
  "As a buyer on the move, I want rich Telegram notifications with primary photos, specs, and direct Facebook Marketplace links.\n\n### Acceptance Criteria\n- [x] Single deal photo caption alert.\n- [x] Daily Top 5 Digest message."

# 8
create_story \
  "US-4.2: Extensible WhatsApp Notification Provider Adapter" \
  "notifications" \
  "$STATUS_DONE" \
  "$PRIORITY_P1" \
  "As an operator planning to scale, I want a decoupled NotificationProvider interface ready to plug in WhatsApp.\n\n### Acceptance Criteria\n- [x] NotificationProvider interface.\n- [x] WhatsAppNotificationProvider stub implementation."

# 9
create_story \
  "US-5.1: Search Target CRUD & Fastify REST API" \
  "api" \
  "$STATUS_DONE" \
  "$PRIORITY_P0" \
  "As an operator, I want a REST API with Prisma and PostgreSQL to manage search targets and query stored deals.\n\n### Acceptance Criteria\n- [x] Fastify API endpoints.\n- [x] Prisma database client and models."

# 10
create_story \
  "US-6.1: Search Target Manager UI (React Dashboard)" \
  "frontend" \
  "$STATUS_BACKLOG" \
  "$PRIORITY_P1" \
  "As a user, I want a web dashboard form to add, edit, pause, and delete search queries and price filters.\n\n### Acceptance Criteria\n- [ ] Search target creation form.\n- [ ] Active/paused status toggle."

# 11
create_story \
  "US-6.2: Live Top Deals Feed UI (React Dashboard)" \
  "frontend" \
  "$STATUS_BACKLOG" \
  "$PRIORITY_P1" \
  "As a buyer, I want a visual card grid displaying the current Top 5/10 deals with photos, specs badges, and deal scores.\n\n### Acceptance Criteria\n- [ ] Grid of cards with photo and spec chips.\n- [ ] Direct Facebook link button."

echo "=== 2. Creating Parent Epics (#12 to #17) ==="

create_epic() {
  local title="$1"
  local label="$2"
  local status_opt="$3"
  local priority_opt="$4"
  local body="$5"

  echo "--> Creating Epic: $title"
  issue_url=$(gh issue create --repo "$REPO" --title "$title" --label "epic,$label" --body "$body" --project "radar-price-kanb")
  issue_num=$(echo "$issue_url" | grep -oE '[0-9]+$')
  echo "    Created Epic #$issue_num: $issue_url"

  item_id=$(gh project item-list "$PROJECT_NUM" --owner "$OWNER" --format json --jq ".items[] | select(.content.number == $issue_num) | .id")

  if [ -n "$item_id" ]; then
    gh project item-edit --id "$item_id" --project-id "$PROJECT_ID" --field-id "$STATUS_FIELD_ID" --single-select-option-id "$status_opt" > /dev/null
    gh project item-edit --id "$item_id" --project-id "$PROJECT_ID" --field-id "$PRIORITY_FIELD_ID" --single-select-option-id "$priority_opt" > /dev/null
  fi
}

create_epic \
  "[EPIC 1] Scraper & Stealth Extraction Core" \
  "scraper" \
  "$STATUS_IN_PROGRESS" \
  "$PRIORITY_P0" \
  "### Sub-issues\n- [ ] #1\n- [ ] #2"

create_epic \
  "[EPIC 2] Two-Tier Intelligence Pipeline" \
  "ai" \
  "$STATUS_IN_PROGRESS" \
  "$PRIORITY_P0" \
  "### Sub-issues\n- [x] #3\n- [ ] #4"

create_epic \
  "[EPIC 3] Clustering, Deduplication & Arbitrage Ranking" \
  "ranking" \
  "$STATUS_DONE" \
  "$PRIORITY_P0" \
  "### Sub-issues\n- [x] #5\n- [x] #6"

create_epic \
  "[EPIC 4] Pluggable Notification System" \
  "notifications" \
  "$STATUS_DONE" \
  "$PRIORITY_P0" \
  "### Sub-issues\n- [x] #7\n- [x] #8"

create_epic \
  "[EPIC 5] API & Search Target Coordination" \
  "api" \
  "$STATUS_DONE" \
  "$PRIORITY_P0" \
  "### Sub-issues\n- [x] #9"

create_epic \
  "[EPIC 6] Web Management Dashboard" \
  "frontend" \
  "$STATUS_BACKLOG" \
  "$PRIORITY_P1" \
  "### Sub-issues\n- [ ] #10\n- [ ] #11"

echo "=== 3. Creating Development Branches for In-Progress Tasks ==="
gh issue develop 1 --repo "$REPO" --name "feat/us-1.1-scraping-core" || true
gh issue develop 2 --repo "$REPO" --name "feat/us-1.2-cookie-persistence" || true
gh issue develop 4 --repo "$REPO" --name "feat/us-2.2-gemini-vision" || true

echo "=== All Epics, Stories, and Linked Branches are Configured! ==="
