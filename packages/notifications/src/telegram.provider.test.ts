import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { TelegramNotificationProvider } from "./telegram.provider.js";
import { DealNotificationPayload } from "./adapter.interface.js";

describe("TelegramNotificationProvider - US-10.2 Inline Keyboards and Fault Tolerance", () => {
  const samplePayload: DealNotificationPayload = {
    dealTitle: "Lenovo Legion 5 RTX 3060",
    brand: "Lenovo",
    model: "Legion 5",
    specs: {
      cpu: "Ryzen 7 5800H",
      ramGb: 16,
      gpu: "RTX 3060",
      storageGb: 512,
    },
    listedPrice: 4200,
    realPrice: 4000,
    estimatedMarketPrice: 5500,
    currency: "BOB",
    dealScore: 92,
    conditionRating: 9,
    reasoning: "Excelente precio respecto al mercado boliviano",
    url: "https://www.facebook.com/marketplace/item/123456789/",
    imageUrls: ["https://example.com/photo1.jpg"],
    location: "La Paz, Bolivia",
    listingId: "listing-uuid-1234",
  };

  test("sends single deal alert with interactive inline keyboard buttons", async () => {
    let capturedUrl = "";
    let capturedBody: any = null;

    const mockFetch: typeof fetch = (async (url: any, init: any) => {
      capturedUrl = String(url);
      capturedBody = JSON.parse(init.body);
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ ok: true }),
        json: async () => ({ ok: true }),
      } as any;
    }) as any;

    const provider = new TelegramNotificationProvider({
      botToken: "test-bot-token",
      chatId: "test-chat-id",
      fetchFn: mockFetch,
    });

    const res = await provider.sendDealAlert(samplePayload);

    assert.equal(res.success, true);
    assert.match(capturedUrl, /sendPhoto/);
    assert.equal(capturedBody.chat_id, "test-chat-id");
    assert.equal(capturedBody.photo, "https://example.com/photo1.jpg");
    assert.match(capturedBody.caption, /Lenovo Legion 5 RTX 3060/);
    assert.match(capturedBody.caption, /Score: 92\/100/);

    // Verify Inline Keyboard Buttons
    assert.ok(capturedBody.reply_markup?.inline_keyboard);
    const keyboard = capturedBody.reply_markup.inline_keyboard;
    assert.equal(keyboard.length, 1);
    assert.equal(keyboard[0].length, 2);

    // Button 1: Marketplace direct link
    assert.equal(keyboard[0][0].text, "🔗 Ver en Marketplace");
    assert.equal(keyboard[0][0].url, samplePayload.url);

    // Button 2: Discard callback query with listing ID
    assert.equal(keyboard[0][1].text, "❌ Descartar");
    assert.equal(keyboard[0][1].callback_data, "ignore:listing-uuid-1234");
  });

  test("falls back to text message when photo delivery fails, maintaining inline keyboard", async () => {
    const capturedCalls: Array<{ url: string; body: any }> = [];

    const mockFetch: typeof fetch = (async (url: any, init: any) => {
      const urlStr = String(url);
      const body = JSON.parse(init.body);
      capturedCalls.push({ url: urlStr, body });

      if (urlStr.includes("sendPhoto")) {
        return {
          ok: false,
          status: 400,
          text: async () => "Bad Request: wrong file identifier",
        } as any;
      }

      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ ok: true }),
        json: async () => ({ ok: true }),
      } as any;
    }) as any;

    const provider = new TelegramNotificationProvider({
      botToken: "test-bot-token",
      chatId: "test-chat-id",
      fetchFn: mockFetch,
    });

    const res = await provider.sendDealAlert(samplePayload);

    assert.equal(res.success, true);
    assert.equal(capturedCalls.length, 2);
    assert.match(capturedCalls[0].url, /sendPhoto/);
    assert.match(capturedCalls[1].url, /sendMessage/);

    const textBody = capturedCalls[1].body;
    assert.match(textBody.text, /Lenovo Legion 5 RTX 3060/);
    assert.ok(textBody.reply_markup?.inline_keyboard);
    assert.equal(textBody.reply_markup.inline_keyboard[0][0].text, "🔗 Ver en Marketplace");
    assert.equal(textBody.reply_markup.inline_keyboard[0][1].text, "❌ Descartar");
    assert.equal(textBody.reply_markup.inline_keyboard[0][1].callback_data, "ignore:listing-uuid-1234");
  });

  test("runs in mock/simulation mode without crashing when botToken or chatId is not configured", async () => {
    let fetchCalled = false;
    const mockFetch: typeof fetch = (async () => {
      fetchCalled = true;
      return { ok: true } as any;
    }) as any;

    // Missing botToken
    const providerWithoutToken = new TelegramNotificationProvider({
      botToken: "",
      chatId: "12345",
      fetchFn: mockFetch,
    });

    const res1 = await providerWithoutToken.sendDealAlert(samplePayload);
    assert.equal(res1.success, true);
    assert.equal(fetchCalled, false, "Fetch should not be called in mock mode");

    const digestRes1 = await providerWithoutToken.sendDailyDigest([samplePayload]);
    assert.equal(digestRes1.success, true);
    assert.equal(fetchCalled, false);

    // Missing chatId
    const providerWithoutChatId = new TelegramNotificationProvider({
      botToken: "some-token",
      chatId: "",
      fetchFn: mockFetch,
    });

    const res2 = await providerWithoutChatId.sendDealAlert(samplePayload);
    assert.equal(res2.success, true);
    assert.equal(fetchCalled, false);
  });

  test("sendDailyDigest formats top deals with savings and specifications", async () => {
    let capturedBody: any = null;

    const mockFetch: typeof fetch = (async (_url: any, init: any) => {
      capturedBody = JSON.parse(init.body);
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ ok: true }),
      } as any;
    }) as any;

    const provider = new TelegramNotificationProvider({
      botToken: "test-bot-token",
      chatId: "test-chat-id",
      fetchFn: mockFetch,
    });

    const res = await provider.sendDailyDigest([samplePayload]);
    assert.equal(res.success, true);
    assert.match(capturedBody.text, /TOP 1 GANGAS DETECTADAS EN MARKETPLACE/);
    assert.match(capturedBody.text, /Lenovo Legion 5 RTX 3060/);
    assert.match(capturedBody.text, /4000 BOB/);
    assert.match(capturedBody.text, /~27% bajo mercado/);
    assert.match(capturedBody.text, /Ryzen 7 5800H/);
  });
});
