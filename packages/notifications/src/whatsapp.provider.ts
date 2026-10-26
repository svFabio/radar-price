import { DealNotificationPayload, NotificationProvider } from "./adapter.interface.js";

export interface WhatsAppConfig {
  apiUrl: string;
  apiKey?: string;
  recipientPhone: string;
}

export class WhatsAppNotificationProvider implements NotificationProvider {
  readonly channelName = "whatsapp";

  constructor(private readonly config: WhatsAppConfig) {}

  async sendDealAlert(payload: DealNotificationPayload): Promise<{ success: boolean; error?: string }> {
    if (!this.config.apiUrl || !this.config.recipientPhone) {
      return { success: false, error: "WhatsApp apiUrl or recipientPhone not configured" };
    }

    const message = this.formatWhatsAppMessage(payload);

    try {
      const res = await fetch(`${this.config.apiUrl}/messages/sendText`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(this.config.apiKey ? { Authorization: `Bearer ${this.config.apiKey}` } : {}),
        },
        body: JSON.stringify({
          number: this.config.recipientPhone,
          text: message,
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        return { success: false, error: `WhatsApp gateway error: ${errorText}` };
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || String(err) };
    }
  }

  async sendDailyDigest(deals: DealNotificationPayload[]): Promise<{ success: boolean; error?: string }> {
    if (!deals.length) return { success: true };

    let text = `*🔥 TOP ${deals.length} GANGAS EN MARKETPLACE 🔥*\n\n`;
    deals.forEach((d, idx) => {
      text += `*#${idx + 1} - ${d.dealTitle}*\n`;
      text += `💰 Precio: ${d.realPrice || d.listedPrice} ${d.currency}\n`;
      text += `🔗 ${d.url}\n\n`;
    });

    try {
      const res = await fetch(`${this.config.apiUrl}/messages/sendText`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(this.config.apiKey ? { Authorization: `Bearer ${this.config.apiKey}` } : {}),
        },
        body: JSON.stringify({
          number: this.config.recipientPhone,
          text,
        }),
      });

      return { success: res.ok };
    } catch (err: any) {
      return { success: false, error: err?.message || String(err) };
    }
  }

  private formatWhatsAppMessage(d: DealNotificationPayload): string {
    const price = d.realPrice ?? d.listedPrice ?? "Desconocido";
    return (
      `*🎯 GANGA DETECTADA (Score: ${d.dealScore.toFixed(0)}/100)*\n\n` +
      `*${d.dealTitle}*\n` +
      `💰 *Precio Real:* ${price} ${d.currency}\n` +
      `💻 *CPU:* ${d.specs.cpu || "N/A"} | *RAM:* ${d.specs.ramGb || "N/A"}GB | *GPU:* ${d.specs.gpu || "N/A"}\n` +
      `📍 *Ubicación:* ${d.location || "La Paz, Bolivia"}\n` +
      `🔗 *Link:* ${d.url}`
    );
  }
}
