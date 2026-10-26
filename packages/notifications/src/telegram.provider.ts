import { DealNotificationPayload, NotificationProvider } from "./adapter.interface.js";

export interface TelegramConfig {
  botToken: string;
  chatId: string;
}

export class TelegramNotificationProvider implements NotificationProvider {
  readonly channelName = "telegram";

  constructor(private readonly config: TelegramConfig) {}

  async sendDealAlert(payload: DealNotificationPayload): Promise<{ success: boolean; error?: string }> {
    if (!this.config.botToken || !this.config.chatId) {
      return { success: false, error: "Telegram botToken or chatId not configured" };
    }

    const message = this.formatSingleDealMessage(payload);
    const primaryPhoto = payload.imageUrls[0];

    try {
      if (primaryPhoto) {
        // Send as photo with caption
        const res = await fetch(`https://api.telegram.org/bot${this.config.botToken}/sendPhoto`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: this.config.chatId,
            photo: primaryPhoto,
            caption: message,
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [
                [{ text: "Ver en Facebook Marketplace", url: payload.url }]
              ]
            }
          }),
        });

        if (!res.ok) {
          const errData = await res.text();
          // Fallback to text message if photo fails
          return this.sendTextMessage(message, payload.url);
        }
        return { success: true };
      } else {
        return this.sendTextMessage(message, payload.url);
      }
    } catch (err: any) {
      return { success: false, error: err?.message || String(err) };
    }
  }

  async sendDailyDigest(deals: DealNotificationPayload[]): Promise<{ success: boolean; error?: string }> {
    if (!deals.length) {
      return { success: true };
    }

    let text = `🔥 *TOP ${deals.length} GANGAS DETECTADAS EN MARKETPLACE* 🔥\n\n`;

    deals.forEach((deal, idx) => {
      const price = deal.realPrice || deal.listedPrice || "Consultar";
      const saving =
        deal.estimatedMarketPrice && deal.realPrice
          ? Math.round(((deal.estimatedMarketPrice - deal.realPrice) / deal.estimatedMarketPrice) * 100)
          : null;

      text += `*#${idx + 1} — ${deal.dealTitle}*\n`;
      text += `💰 *Precio:* ${price} ${deal.currency}${saving ? ` (_~${saving}% bajo mercado_)` : ""}\n`;
      text += `⚙️ *Specs:* ${deal.specs.cpu || "N/A"} | ${deal.specs.ramGb ? `${deal.specs.ramGb}GB RAM` : "N/A"} | ${deal.specs.gpu || "GPU Integrada"}\n`;
      text += `⭐ *Puntaje ganga:* ${deal.dealScore.toFixed(0)}/100\n`;
      text += `🔗 [Ver Publicación](${deal.url})\n\n`;
    });

    return this.sendTextMessage(text);
  }

  private async sendTextMessage(text: string, directUrl?: string): Promise<{ success: boolean; error?: string }> {
    try {
      const body: any = {
        chat_id: this.config.chatId,
        text,
        parse_mode: "Markdown",
      };

      if (directUrl) {
        body.reply_markup = {
          inline_keyboard: [[{ text: "Ver en Facebook Marketplace", url: directUrl }]],
        };
      }

      const res = await fetch(`https://api.telegram.org/bot${this.config.botToken}/sendMessage`, {
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

  private formatSingleDealMessage(d: DealNotificationPayload): string {
    const price = d.realPrice ?? d.listedPrice ?? "Desconocido";
    const condition = d.conditionRating ? `${d.conditionRating}/10` : "No evaluado";

    return (
      `🎯 *NUEVA GANGA DETECTADA (Score: ${d.dealScore.toFixed(0)}/100)*\n\n` +
      `*${d.dealTitle}*\n` +
      `💰 *Precio Real:* ${price} ${d.currency}\n` +
      (d.estimatedMarketPrice ? `📊 *Precio Mercado Estimado:* ${d.estimatedMarketPrice} ${d.currency}\n` : "") +
      `\n` +
      `💻 *Especificaciones:* \n` +
      `• *CPU:* ${d.specs.cpu || "No especificado"}\n` +
      `• *RAM:* ${d.specs.ramGb ? `${d.specs.ramGb} GB` : "No especificado"}\n` +
      `• *GPU:* ${d.specs.gpu || "Integrada / No especificada"}\n` +
      `• *Almacenamiento:* ${d.specs.storageGb ? `${d.specs.storageGb} GB` : "No especificado"}\n` +
      `• *Estado Físico:* ${condition}\n` +
      `\n` +
      `📍 *Ubicación:* ${d.location || "La Paz, Bolivia"}\n` +
      (d.reasoning ? `💡 *Análisis IA:* ${d.reasoning}\n` : "")
    );
  }
}
