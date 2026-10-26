#!/usr/bin/env bash
set -e

PROJECT_NUM=9
PROJECT_ID="PVT_kwHOCk-mm84BouTx"
STATUS_FIELD_ID="PVTSSF_lAHOCk-mm84BouTxzhnNDFg"
PRIORITY_FIELD_ID="PVTSSF_lAHOCk-mm84BouTxzhnNDWY"
OWNER="svFabio"

# Status Option IDs
STATUS_BACKLOG="f75ad846"
STATUS_IN_PROGRESS="47fc9ee4"
STATUS_DONE="98236657"

# Priority Option IDs
PRIORITY_P0="79628723"
PRIORITY_P1="0a877460"

create_item() {
  local title="$1"
  local status_opt="$2"
  local priority_opt="$3"
  local body="$4"

  echo "--> Creating draft issue: $title"
  item_id=$(gh project item-create "$PROJECT_NUM" --owner "$OWNER" --title "$title" --body "$body" --format json --jq '.id')
  
  # Set Status
  gh project item-edit --id "$item_id" --project-id "$PROJECT_ID" --field-id "$STATUS_FIELD_ID" --single-select-option-id "$status_opt"
  
  # Set Priority
  gh project item-edit --id "$item_id" --project-id "$PROJECT_ID" --field-id "$PRIORITY_FIELD_ID" --single-select-option-id "$priority_opt"
}

# Delete any draft issue created during the initial failed run
for id in $(gh project item-list "$PROJECT_NUM" --owner "$OWNER" --format json --jq '.items[].id'); do
  gh project item-delete "$PROJECT_NUM" --owner "$OWNER" --id "$id"
done

# Epic 1
create_item \
  "[EPIC 1] US-1.1: Localized Search & Price Range Scraping" \
  "$STATUS_IN_PROGRESS" \
  "$PRIORITY_P0" \
  "As an arbitrageur, I want to scrape Facebook Marketplace for specific queries in a chosen city within a price budget. Includes infinite scroll and human jitter."

create_item \
  "[EPIC 1] US-1.2: Session & Cookie Persistence (Anti-Checkpoint)" \
  "$STATUS_IN_PROGRESS" \
  "$PRIORITY_P0" \
  "As an automated worker, I want to inject saved Facebook cookies so I bypass login checkpoints and avoid triggering anti-bot security."

# Epic 2
create_item \
  "[EPIC 2] US-2.1: Tier-1 Heuristic Filtering (Zero Token Cost)" \
  "$STATUS_DONE" \
  "$PRIORITY_P0" \
  "As a system operator, I want to filter out buyer requests ('busco', 'compro') and junk accessories in memory without wasting LLM tokens."

create_item \
  "[EPIC 2] US-2.2: Multimodal AI Spec & Real Price Extraction (Gemini Flash)" \
  "$STATUS_IN_PROGRESS" \
  "$PRIORITY_P0" \
  "As an arbitrageur, I want Gemini 2.0 Flash to inspect listing photos (DxDiag, stickers) and extract real CPU, RAM, GPU, condition rating, and real BOB price."

# Epic 3
create_item \
  "[EPIC 3] US-3.1: Hardware Tier Clustering (Deduplication)" \
  "$STATUS_DONE" \
  "$PRIORITY_P1" \
  "As a user, I want the system to cluster similar laptop models together so I do not receive duplicate alerts for the same hardware tier."

create_item \
  "[EPIC 3] US-3.2: Deal Score & Bargain Ranking (Top 5)" \
  "$STATUS_DONE" \
  "$PRIORITY_P0" \
  "As an arbitrageur, I want an automated deal scoring formula that computes price-to-performance against fair market value and picks the Top 5 deals."

# Epic 4
create_item \
  "[EPIC 4] US-4.1: Telegram Rich Deal Cards & Periodic Top 5 Digest" \
  "$STATUS_DONE" \
  "$PRIORITY_P0" \
  "As a buyer on the move, I want formatted Telegram notifications with primary photos, hardware specs, price savings, and direct Facebook Marketplace links."

create_item \
  "[EPIC 4] US-4.2: Extensible WhatsApp Notification Provider Adapter" \
  "$STATUS_DONE" \
  "$PRIORITY_P1" \
  "As an operator planning to scale, I want a decoupled NotificationProvider interface ready to plug in WhatsApp Business or Cloud API without touching scraper logic."

# Epic 5
create_item \
  "[EPIC 5] US-5.1: Search Target CRUD & Fastify REST API" \
  "$STATUS_DONE" \
  "$PRIORITY_P0" \
  "As an operator, I want a REST API with Prisma and PostgreSQL to manage search targets (keywords, city, min/max price) and query top stored deals."

# Epic 6
create_item \
  "[EPIC 6] US-6.1: Search Target Manager UI (React Dashboard)" \
  "$STATUS_BACKLOG" \
  "$PRIORITY_P1" \
  "As a user, I want a web dashboard form to add, edit, pause, and delete search queries and price filters without touching code."

create_item \
  "[EPIC 6] US-6.2: Live Top Deals Feed UI (React Dashboard)" \
  "$STATUS_BACKLOG" \
  "$PRIORITY_P1" \
  "As a buyer, I want a visual card grid displaying the current Top 5/10 deals with photos, specs badges, and deal scores."

echo "All tasks successfully created in radar-price-kanb!"
