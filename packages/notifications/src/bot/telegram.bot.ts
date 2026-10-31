import { prisma as defaultPrisma } from "@radar/database";
import type {
  TelegramBotConfig,
  TelegramBotDependencies,
  TelegramUpdate,
  InlineKeyboardMarkup,
} from "./types.js";

export class TelegramBotListener {
  private botToken: string;
  private pollingTimeoutSec: number;
  private pollingIntervalMs: number;
  private isMockMode: boolean;
  private running = false;
  private lastUpdateId = 0;
  private prisma: any;
  private fetchApi: typeof fetch;
  private abortController: AbortController | null = null;

  constructor(config: TelegramBotConfig = {}, deps: TelegramBotDependencies = {}) {
    this.botToken = config.botToken || process.env.TELEGRAM_BOT_TOKEN || "";
    this.pollingTimeoutSec = config.pollingTimeoutSec ?? 30;
    this.pollingIntervalMs = config.pollingIntervalMs ?? 1000;
    this.isMockMode = Boolean(config.mockMode || !this.botToken);

    this.prisma = deps.prisma ?? defaultPrisma;
    this.fetchApi = deps.fetchFn ?? globalThis.fetch;

    if (this.isMockMode) {
      console.warn("[TelegramBotListener] No TELEGRAM_BOT_TOKEN provided. Running in mock/simulation mode.");
    }
  }

  get mock(): boolean {
    return this.isMockMode;
  }

  get isRunning(): boolean {
    return this.running;
  }

  async start(): Promise<void> {
    this.running = true;
    if (this.isMockMode) {
      console.log("[TelegramBotListener] Started in mock mode. Real polling skipped.");
      return;
    }

    console.log("[TelegramBotListener] Starting Telegram long polling loop...");
    this.abortController = new AbortController();
    this.pollLoop().catch((err) => {
      console.error("[TelegramBotListener] Unexpected error in polling loop:", err);
    });
  }

  async stop(): Promise<void> {
    this.running = false;
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    console.log("[TelegramBotListener] Stopped.");
  }

  private async pollLoop(): Promise<void> {
    while (this.running) {
      try {
        const url = `https://api.telegram.org/bot${this.botToken}/getUpdates?offset=${this.lastUpdateId}&timeout=${this.pollingTimeoutSec}`;
        const res = await this.fetchApi(url, {
          signal: this.abortController?.signal,
        });

        if (!res.ok) {
          console.error(`[TelegramBotListener] getUpdates returned HTTP ${res.status}`);
          await this.delay(this.pollingIntervalMs * 2);
          continue;
        }

        const data: any = await res.json();
        if (data && Array.isArray(data.result)) {
          for (const update of data.result) {
            this.lastUpdateId = Math.max(this.lastUpdateId, update.update_id + 1);
            await this.handleUpdate(update);
          }
        }
      } catch (err: any) {
        if (err?.name === "AbortError" || !this.running) {
          break;
        }
        console.error("[TelegramBotListener] Error while polling updates:", err?.message || err);
        await this.delay(this.pollingIntervalMs * 2);
      }

      if (this.running) {
        await this.delay(this.pollingIntervalMs);
      }
    }
  }

  async handleUpdate(update: TelegramUpdate): Promise<void> {
    try {
      if (update.message?.text) {
        await this.handleMessage(update.message);
      } else if (update.callback_query) {
        await this.handleCallbackQuery(update.callback_query);
      }
    } catch (err: any) {
      console.error("[TelegramBotListener] Error handling update:", err?.message || err);
    }
  }

  private async handleMessage(message: NonNullable<TelegramUpdate["message"]>): Promise<void> {
    const rawText = message.text?.trim() || "";
    const chatId = message.chat.id;

    if (rawText.startsWith("/start") || rawText.startsWith("/help")) {
      await this.handleHelpCommand(chatId);
    } else if (rawText.startsWith("/top")) {
      await this.handleTopCommand(chatId, rawText);
    } else if (rawText.startsWith("/targets")) {
      await this.handleTargetsCommand(chatId);
    } else if (rawText.startsWith("/stats")) {
      await this.handleStatsCommand(chatId);
    } else if (rawText.startsWith("/")) {
      await this.sendMessage(
        chatId,
        "❓ *Comando no reconocido.*\n\nEscribe /help para ver la lista de comandos disponibles."
      );
    }
  }

  private async handleHelpCommand(chatId: number | string): Promise<void> {
    const text =
      `🤖 *Radar Price Bot — Comandos Disponibles*\n\n` +
      `• /top [n] — Consulta las N mejores gangas activas (ej. \`/top 3\`, default 5)\n` +
      `• /targets — Muestra las campañas de búsqueda configuradas\n` +
      `• /stats — Informa el total de publicaciones analizadas, deals y ahorro estimado\n` +
      `• /help — Muestra este menú de ayuda\n`;

    await this.sendMessage(chatId, text);
  }

  private async handleTopCommand(chatId: number | string, text: string): Promise<void> {
    const match = text.match(/^\/top(?:@\w+)?(?:\s+(\d+))?/i);
    let count = 5;
    if (match && match[1]) {
      const parsed = parseInt(match[1], 10);
      if (!isNaN(parsed) && parsed > 0) {
        count = Math.min(parsed, 20);
      }
    }

    const activeDeals = await this.prisma.listing.findMany({
      where: {
        status: { not: "IGNORED" },
        evaluation: {
          isDeal: true,
        },
      },
      include: {
        evaluation: true,
        searchTarget: true,
      },
      orderBy: {
        evaluation: {
          dealScore: "desc",
        },
      },
      take: count,
    });

    if (!activeDeals || activeDeals.length === 0) {
      await this.sendMessage(chatId, "ℹ️ No se encontraron gangas activas en este momento.");
      return;
    }

    for (let idx = 0; idx < activeDeals.length; idx++) {
      const item = activeDeals[idx];
      const ev = item.evaluation;
      const price = ev?.realPrice ?? item.listedPrice ?? "Consultar";
      const saving =
        ev?.estimatedMarketPrice && price && typeof price === "number"
          ? Math.round(((ev.estimatedMarketPrice - price) / ev.estimatedMarketPrice) * 100)
          : null;
      const condition = ev?.conditionRating ? `${ev.conditionRating}/10` : "No evaluado";

      const caption =
        `🎯 *TOP #${idx + 1} — GANGA ACTIVA (Score: ${ev?.dealScore ? ev.dealScore.toFixed(0) : "N/A"}/100)*\n\n` +
        `*${item.title}*\n` +
        `💰 *Precio:* ${price} ${item.currency}${saving ? ` (_~${saving}% bajo mercado_)` : ""}\n` +
        (ev?.estimatedMarketPrice ? `📊 *Precio Mercado Estimado:* ${ev.estimatedMarketPrice} ${item.currency}\n` : "") +
        `\n` +
        `💻 *Especificaciones:*\n` +
        `• *CPU:* ${ev?.cpu || "No especificado"}\n` +
        `• *RAM:* ${ev?.ramGb ? `${ev.ramGb} GB` : "No especificado"}\n` +
        `• *GPU:* ${ev?.gpu || "Integrada / No especificada"}\n` +
        `• *Almacenamiento:* ${ev?.storageGb ? `${ev.storageGb} GB` : "No especificado"}\n` +
        `• *Estado Físico:* ${condition}\n` +
        `\n` +
        `📍 *Ubicación:* ${item.location || "La Paz, Bolivia"}\n` +
        (ev?.reasoning ? `💡 *Análisis IA:* ${ev.reasoning}\n` : "");

      const replyMarkup: InlineKeyboardMarkup = {
        inline_keyboard: [
          [
            { text: "🔗 Ver en Marketplace", url: item.url },
            { text: "❌ Descartar", callback_data: `ignore:${item.id}` },
          ],
        ],
      };

      const primaryPhoto = item.imageUrls && item.imageUrls.length > 0 ? item.imageUrls[0] : null;
      if (primaryPhoto) {
        await this.sendPhoto(chatId, primaryPhoto, caption, replyMarkup);
      } else {
        await this.sendMessage(chatId, caption, replyMarkup);
      }
    }
  }

  private async handleTargetsCommand(chatId: number | string): Promise<void> {
    const targets = await this.prisma.searchTarget.findMany({
      orderBy: { createdAt: "desc" },
    });

    if (!targets || targets.length === 0) {
      await this.sendMessage(chatId, "ℹ️ No hay campañas de búsqueda configuradas.");
      return;
    }

    let text = `🎯 *Campañas de Búsqueda Configuradas (${targets.length})*\n\n`;
    for (const t of targets) {
      const statusIcon = t.active ? "🟢" : "🔴";
      const statusLabel = t.active ? "Activa" : "Pausada";
      const min = t.minPrice ?? 0;
      const max = t.maxPrice ? `${t.maxPrice} ${t.currency}` : "Sin tope";
      const priceRange = t.minPrice || t.maxPrice ? `${min} a ${max}` : "Precio libre";

      text += `${statusIcon} *${t.name}* (${statusLabel})\n`;
      text += `   • *Búsqueda:* "${t.query}" en ${t.location}\n`;
      text += `   • *Rango:* ${priceRange}\n`;
      if (t.lastRunAt) {
        text += `   • *Último escaneo:* ${new Date(t.lastRunAt).toLocaleString("es-BO")}\n`;
      }
      text += `\n`;
    }

    await this.sendMessage(chatId, text);
  }

  private async handleStatsCommand(chatId: number | string): Promise<void> {
    const totalListings = await this.prisma.listing.count();
    const totalDeals = await this.prisma.evaluation.count({
      where: { isDeal: true },
    });

    const dealEvaluations = await this.prisma.evaluation.findMany({
      where: {
        isDeal: true,
        estimatedMarketPrice: { not: null },
      },
      select: {
        estimatedMarketPrice: true,
        realPrice: true,
        listing: {
          select: {
            listedPrice: true,
            currency: true,
          },
        },
      },
    });

    let totalSavings = 0;
    let currency = "BOB";
    for (const ev of dealEvaluations) {
      const currentPrice = ev.realPrice ?? ev.listing?.listedPrice ?? 0;
      if (ev.estimatedMarketPrice && ev.estimatedMarketPrice > currentPrice) {
        totalSavings += ev.estimatedMarketPrice - currentPrice;
      }
      if (ev.listing?.currency) {
        currency = ev.listing.currency;
      }
    }

    const text =
      `📊 *Estadísticas de Radar Price*\n\n` +
      `• 📥 *Publicaciones analizadas:* ${totalListings.toLocaleString("es-BO")}\n` +
      `• 🎯 *Deals / Gangas encontradas:* ${totalDeals.toLocaleString("es-BO")}\n` +
      `• 💰 *Ahorro estimado acumulado:* ~${Math.round(totalSavings).toLocaleString("es-BO")} ${currency}\n`;

    await this.sendMessage(chatId, text);
  }

  private async handleCallbackQuery(query: NonNullable<TelegramUpdate["callback_query"]>): Promise<void> {
    const data = query.data || "";

    if (data.startsWith("ignore:")) {
      const targetId = data.slice("ignore:".length);
      let updated = false;

      try {
        const listing = await this.prisma.listing.findUnique({ where: { id: targetId } });
        if (listing) {
          await this.prisma.listing.update({
            where: { id: targetId },
            data: { status: "IGNORED" },
          });
          updated = true;
        } else {
          const byFallback = await this.prisma.listing.findFirst({
            where: { OR: [{ url: targetId }, { fbItemId: targetId }] },
          });
          if (byFallback) {
            await this.prisma.listing.update({
              where: { id: byFallback.id },
              data: { status: "IGNORED" },
            });
            updated = true;
          }
        }
      } catch (err: any) {
        console.error("[TelegramBotListener] Error discarding listing in DB:", err?.message || err);
      }

      if (updated) {
        await this.answerCallbackQuery(query.id, "❌ Oferta descartada con éxito.");
        if (query.message?.chat?.id && query.message?.message_id) {
          await this.editMessageReplyMarkup(query.message.chat.id, query.message.message_id, {
            inline_keyboard: [[{ text: "❌ Descartada", callback_data: "noop" }]],
          });
        }
      } else {
        await this.answerCallbackQuery(query.id, "Oferta no encontrada o ya descartada.");
      }
    } else {
      await this.answerCallbackQuery(query.id);
    }
  }

  async sendMessage(
    chatId: number | string,
    text: string,
    replyMarkup?: InlineKeyboardMarkup
  ): Promise<{ success: boolean; error?: string }> {
    if (this.isMockMode) {
      console.log(`[TelegramBotListener Mock] sendMessage to ${chatId}: ${text}`);
      return { success: true };
    }

    try {
      const body: any = {
        chat_id: chatId,
        text,
        parse_mode: "Markdown",
      };
      if (replyMarkup) {
        body.reply_markup = replyMarkup;
      }

      const res = await this.fetchApi(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errText = await res.text();
        return { success: false, error: `Telegram API error: ${errText}` };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || String(err) };
    }
  }

  async sendPhoto(
    chatId: number | string,
    photoUrl: string,
    caption: string,
    replyMarkup?: InlineKeyboardMarkup
  ): Promise<{ success: boolean; error?: string }> {
    if (this.isMockMode) {
      console.log(`[TelegramBotListener Mock] sendPhoto to ${chatId} (${photoUrl}): ${caption}`);
      return { success: true };
    }

    try {
      const res = await this.fetchApi(`https://api.telegram.org/bot${this.botToken}/sendPhoto`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          photo: photoUrl,
          caption,
          parse_mode: "Markdown",
          reply_markup: replyMarkup,
        }),
      });

      if (!res.ok) {
        await res.text();
        // Fallback to text message if photo delivery fails
        return this.sendMessage(chatId, caption, replyMarkup);
      }
      return { success: true };
    } catch (err: any) {
      return this.sendMessage(chatId, caption, replyMarkup);
    }
  }

  async answerCallbackQuery(
    callbackQueryId: string,
    text?: string
  ): Promise<{ success: boolean; error?: string }> {
    if (this.isMockMode) {
      console.log(`[TelegramBotListener Mock] answerCallbackQuery id=${callbackQueryId} text=${text}`);
      return { success: true };
    }

    try {
      const res = await this.fetchApi(`https://api.telegram.org/bot${this.botToken}/answerCallbackQuery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callback_query_id: callbackQueryId,
          text,
        }),
      });
      return { success: res.ok };
    } catch (err: any) {
      return { success: false, error: err?.message || String(err) };
    }
  }

  async editMessageReplyMarkup(
    chatId: number | string,
    messageId: number,
    replyMarkup: InlineKeyboardMarkup
  ): Promise<{ success: boolean; error?: string }> {
    if (this.isMockMode) {
      console.log(`[TelegramBotListener Mock] editMessageReplyMarkup chat=${chatId} msg=${messageId}`);
      return { success: true };
    }

    try {
      const res = await this.fetchApi(`https://api.telegram.org/bot${this.botToken}/editMessageReplyMarkup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: messageId,
          reply_markup: replyMarkup,
        }),
      });
      return { success: res.ok };
    } catch (err: any) {
      return { success: false, error: err?.message || String(err) };
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
