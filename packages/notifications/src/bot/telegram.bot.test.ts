import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { TelegramBotListener } from "./telegram.bot.js";
import type { TelegramUpdate } from "./types.js";

describe("TelegramBotListener - US-10.1 Interactive Bot & US-10.2 Actions", () => {
  const sampleListings = [
    {
      id: "listing-1",
      title: "Asus TUF Gaming RTX 3050",
      listedPrice: 3800,
      currency: "BOB",
      url: "https://facebook.com/marketplace/item/111",
      imageUrls: ["https://example.com/asus.jpg"],
      location: "La Paz",
      status: "ALERTED",
      evaluation: {
        id: "eval-1",
        brand: "Asus",
        model: "TUF Gaming",
        cpu: "i5-11400H",
        ramGb: 16,
        gpu: "RTX 3050",
        storageGb: 512,
        realPrice: 3600,
        conditionRating: 9,
        isDeal: true,
        dealScore: 91,
        estimatedMarketPrice: 4800,
        reasoning: "Gran relación precio-calidad",
      },
    },
    {
      id: "listing-2",
      title: "HP Victus 15 Ryzen 5",
      listedPrice: 3200,
      currency: "BOB",
      url: "https://facebook.com/marketplace/item/222",
      imageUrls: [],
      location: "El Alto",
      status: "EVALUATED",
      evaluation: {
        id: "eval-2",
        brand: "HP",
        model: "Victus 15",
        cpu: "Ryzen 5 5600H",
        ramGb: 8,
        gpu: "GTX 1650",
        storageGb: 256,
        realPrice: 3100,
        conditionRating: 8,
        isDeal: true,
        dealScore: 84,
        estimatedMarketPrice: 4000,
        reasoning: "Buen precio de entrada gamer",
      },
    },
  ];

  const sampleTargets = [
    {
      id: "target-1",
      name: "Laptop Gamer La Paz",
      query: "laptop gamer",
      location: "La Paz, Bolivia",
      minPrice: 1500,
      maxPrice: 6000,
      currency: "BOB",
      active: true,
      lastRunAt: new Date("2026-10-30T15:00:00Z"),
    },
    {
      id: "target-2",
      name: "Thinkpad Baratas",
      query: "thinkpad",
      location: "La Paz, Bolivia",
      minPrice: 1000,
      maxPrice: 2500,
      currency: "BOB",
      active: false,
      lastRunAt: null,
    },
  ];

  function createMockDependencies() {
    const sentMessages: Array<{ method: string; body: any }> = [];

    const mockFetch: typeof fetch = (async (url: any, init: any) => {
      const urlStr = String(url);
      const body = init?.body ? JSON.parse(init.body) : null;
      const method = urlStr.split("/").pop() || "";
      sentMessages.push({ method, body });

      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true, result: [] }),
        text: async () => JSON.stringify({ ok: true }),
      } as any;
    }) as any;

    const mockPrisma: any = {
      listing: {
        findMany: async (args: any) => {
          let items = [...sampleListings];
          if (args?.take) items = items.slice(0, args.take);
          return items;
        },
        findUnique: async ({ where }: any) => {
          return sampleListings.find((l) => l.id === where.id) || null;
        },
        findFirst: async () => null,
        update: async ({ where, data }: any) => {
          return { id: where.id, ...data };
        },
        count: async () => 150,
      },
      evaluation: {
        count: async () => 18,
        findMany: async () => [
          {
            estimatedMarketPrice: 4800,
            realPrice: 3600,
            listing: { listedPrice: 3800, currency: "BOB" },
          },
          {
            estimatedMarketPrice: 4000,
            realPrice: 3100,
            listing: { listedPrice: 3200, currency: "BOB" },
          },
        ],
      },
      searchTarget: {
        findMany: async () => sampleTargets,
      },
    };

    return { mockFetch, mockPrisma, sentMessages };
  }

  test("comando /help muestra la lista de comandos disponibles", async () => {
    const { mockFetch, mockPrisma, sentMessages } = createMockDependencies();
    const bot = new TelegramBotListener(
      { botToken: "valid-token" },
      { prisma: mockPrisma, fetchFn: mockFetch }
    );

    const update: TelegramUpdate = {
      update_id: 1,
      message: {
        message_id: 10,
        chat: { id: 99999 },
        text: "/help",
        date: 12345678,
      },
    };

    await bot.handleUpdate(update);

    assert.equal(sentMessages.length, 1);
    assert.equal(sentMessages[0].method, "sendMessage");
    assert.equal(sentMessages[0].body.chat_id, 99999);
    assert.match(sentMessages[0].body.text, /\/top \[n\]/);
    assert.match(sentMessages[0].body.text, /\/targets/);
    assert.match(sentMessages[0].body.text, /\/stats/);
    assert.match(sentMessages[0].body.text, /\/help/);
  });

  test("comando /top consulta gangas en Prisma y responde con fotos, Markdown e Inline Keyboards", async () => {
    const { mockFetch, mockPrisma, sentMessages } = createMockDependencies();
    const bot = new TelegramBotListener(
      { botToken: "valid-token" },
      { prisma: mockPrisma, fetchFn: mockFetch }
    );

    const update: TelegramUpdate = {
      update_id: 2,
      message: {
        message_id: 11,
        chat: { id: 99999 },
        text: "/top",
        date: 12345678,
      },
    };

    await bot.handleUpdate(update);

    // 2 listings in sampleListings -> 2 messages sent
    assert.equal(sentMessages.length, 2);

    // Item 1 has photo -> sent via sendPhoto
    const firstMsg = sentMessages[0];
    assert.equal(firstMsg.method, "sendPhoto");
    assert.equal(firstMsg.body.photo, "https://example.com/asus.jpg");
    assert.match(firstMsg.body.caption, /Asus TUF Gaming RTX 3050/);
    assert.match(firstMsg.body.caption, /Score: 91\/100/);
    assert.match(firstMsg.body.caption, /3600 BOB/);
    assert.match(firstMsg.body.caption, /i5-11400H/);

    // Inline Keyboard validation
    const keyboard1 = firstMsg.body.reply_markup?.inline_keyboard;
    assert.ok(keyboard1);
    assert.equal(keyboard1[0][0].text, "🔗 Ver en Marketplace");
    assert.equal(keyboard1[0][0].url, "https://facebook.com/marketplace/item/111");
    assert.equal(keyboard1[0][1].text, "❌ Descartar");
    assert.equal(keyboard1[0][1].callback_data, "ignore:listing-1");

    // Item 2 has no photo -> sent via sendMessage
    const secondMsg = sentMessages[1];
    assert.equal(secondMsg.method, "sendMessage");
    assert.match(secondMsg.body.text, /HP Victus 15 Ryzen 5/);
    assert.equal(secondMsg.body.reply_markup.inline_keyboard[0][1].callback_data, "ignore:listing-2");
  });

  test("comando /top [n] respeta el parámetro de cantidad", async () => {
    let capturedTake = 0;
    const { mockFetch, mockPrisma } = createMockDependencies();
    mockPrisma.listing.findMany = async (args: any) => {
      capturedTake = args?.take;
      return [];
    };

    const bot = new TelegramBotListener(
      { botToken: "valid-token" },
      { prisma: mockPrisma, fetchFn: mockFetch }
    );

    const update: TelegramUpdate = {
      update_id: 3,
      message: {
        message_id: 12,
        chat: { id: 99999 },
        text: "/top 3",
        date: 12345678,
      },
    };

    await bot.handleUpdate(update);
    assert.equal(capturedTake, 3);
  });

  test("comando /targets muestra las campañas configuradas", async () => {
    const { mockFetch, mockPrisma, sentMessages } = createMockDependencies();
    const bot = new TelegramBotListener(
      { botToken: "valid-token" },
      { prisma: mockPrisma, fetchFn: mockFetch }
    );

    const update: TelegramUpdate = {
      update_id: 4,
      message: {
        message_id: 13,
        chat: { id: 99999 },
        text: "/targets",
        date: 12345678,
      },
    };

    await bot.handleUpdate(update);

    assert.equal(sentMessages.length, 1);
    const msg = sentMessages[0];
    assert.equal(msg.method, "sendMessage");
    assert.match(msg.body.text, /Campañas de Búsqueda Configuradas \(2\)/);
    assert.match(msg.body.text, /Laptop Gamer La Paz/);
    assert.match(msg.body.text, /1500 a 6000 BOB/);
    assert.match(msg.body.text, /Thinkpad Baratas/);
  });

  test("comando /stats informa analizadas, deals y ahorro acumulado", async () => {
    const { mockFetch, mockPrisma, sentMessages } = createMockDependencies();
    const bot = new TelegramBotListener(
      { botToken: "valid-token" },
      { prisma: mockPrisma, fetchFn: mockFetch }
    );

    const update: TelegramUpdate = {
      update_id: 5,
      message: {
        message_id: 14,
        chat: { id: 99999 },
        text: "/stats",
        date: 12345678,
      },
    };

    await bot.handleUpdate(update);

    assert.equal(sentMessages.length, 1);
    const msg = sentMessages[0];
    assert.equal(msg.method, "sendMessage");
    assert.match(msg.body.text, /Publicaciones analizadas:\* 150/);
    assert.match(msg.body.text, /Deals \/ Gangas encontradas:\* 18/);
    // Savings: (4800 - 3600) + (4000 - 3100) = 1200 + 900 = 2100 BOB
    assert.match(msg.body.text, /2\.100 BOB/);
  });

  test("callback query '❌ Descartar' actualiza el listing a IGNORED en DB", async () => {
    const { mockFetch, mockPrisma, sentMessages } = createMockDependencies();
    let updatedId = "";
    let updatedStatus = "";

    mockPrisma.listing.update = async ({ where, data }: any) => {
      updatedId = where.id;
      updatedStatus = data.status;
      return { id: where.id, ...data };
    };

    const bot = new TelegramBotListener(
      { botToken: "valid-token" },
      { prisma: mockPrisma, fetchFn: mockFetch }
    );

    const update: TelegramUpdate = {
      update_id: 6,
      callback_query: {
        id: "cb-query-99",
        from: { id: 12345, first_name: "Fabio" },
        message: {
          message_id: 888,
          chat: { id: 99999 },
          date: 12345678,
        },
        data: "ignore:listing-1",
      },
    };

    await bot.handleUpdate(update);

    // Verify DB update
    assert.equal(updatedId, "listing-1");
    assert.equal(updatedStatus, "IGNORED");

    // Verify Telegram answerCallbackQuery was called
    const answerCall = sentMessages.find((m) => m.method === "answerCallbackQuery");
    assert.ok(answerCall);
    assert.equal(answerCall.body.callback_query_id, "cb-query-99");
    assert.match(answerCall.body.text, /descartada con éxito/);

    // Verify editMessageReplyMarkup was called to update button state
    const editCall = sentMessages.find((m) => m.method === "editMessageReplyMarkup");
    assert.ok(editCall);
    assert.equal(editCall.body.chat_id, 99999);
    assert.equal(editCall.body.message_id, 888);
    assert.equal(editCall.body.reply_markup.inline_keyboard[0][0].text, "❌ Descartada");
  });

  test("manejo tolerante a fallos: sin token de Telegram entra en modo mock sin crashear", async () => {
    const { mockPrisma } = createMockDependencies();
    const bot = new TelegramBotListener(
      { botToken: "" },
      { prisma: mockPrisma }
    );

    assert.equal(bot.mock, true, "Bot must be in mock mode when token is missing");

    // start() should not throw or poll real network
    await bot.start();
    assert.equal(bot.isRunning, true);

    // handleUpdate() should work cleanly in mock mode without throwing
    const update: TelegramUpdate = {
      update_id: 7,
      message: {
        message_id: 15,
        chat: { id: 99999 },
        text: "/help",
        date: 12345678,
      },
    };

    await bot.handleUpdate(update);
    await bot.stop();
    assert.equal(bot.isRunning, false);
  });
});
