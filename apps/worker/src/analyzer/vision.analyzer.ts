import { GoogleGenAI, Type } from "@google/genai";
import { RawScrapedListing } from "./heuristic.filter.js";

export interface EvaluatedSpecs {
  brand?: string;
  model?: string;
  cpu?: string;
  ramGb?: number;
  storageGb?: number;
  gpu?: string;
  realPrice?: number;
  conditionRating?: number; // 1 to 10
  isDeal: boolean;
  dealScore: number; // 0 to 100
  estimatedMarketPrice?: number;
  reasoning: string;
}

export class VisionAnalyzer {
  private ai: GoogleGenAI | null = null;

  constructor(apiKey?: string) {
    const key = apiKey || process.env.GEMINI_API_KEY;
    if (key) {
      this.ai = new GoogleGenAI({ apiKey: key });
    }
  }

  async analyze(listing: RawScrapedListing): Promise<EvaluatedSpecs> {
    if (!this.ai) {
      // Fallback mock evaluation if API key is not configured yet
      return this.mockEvaluation(listing);
    }

    try {
      // Fetch up to 3 images as base64 for multimodal analysis
      const imageParts = await this.prepareImageParts(listing.imageUrls.slice(0, 3));

      const prompt = `
You are an expert hardware appraiser analyzing a secondhand laptop listing from Facebook Marketplace Bolivia.
Sellers often post fake prices in the title (like "Bs 1" or "Gratis"), and write the real price in the description or on the photos.
They also often take photos of DxDiag, Task Manager, or system properties stickers to show real specs.

Listing Title: "${listing.title}"
Listed Price: ${listing.listedPrice ?? "Unknown"} ${listing.currency}
Listing URL: ${listing.url}

TASKS:
1. Identify the exact Brand and Model of the laptop.
2. Read the photos and text to determine CPU (e.g. i7-11800H, Ryzen 5 5600H), RAM (in GB), discrete GPU (e.g. RTX 3060, GTX 1650, or Integrated), and Storage (in GB).
3. Determine the REAL price in BOB (Bolivianos). If the listed price is 0 or 1, look for the real price in stickers, text, or estimate it.
4. Estimate fair market value in Bolivia for this exact hardware configuration in used condition.
5. Rate physical condition (1-10) based on scratches, dents, hinges shown in photos.
6. Calculate a Deal Score (0-100) where 100 is an extraordinary bargain (much cheaper than market price) and 0 is overpriced/scam.
7. Return a short reasoning summary in Spanish explaining why this is or isn't a good buy.
`;

      const contents: any[] = [...imageParts, { text: prompt }];

      const response = await this.ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              brand: { type: Type.STRING },
              model: { type: Type.STRING },
              cpu: { type: Type.STRING },
              ramGb: { type: Type.INTEGER },
              storageGb: { type: Type.INTEGER },
              gpu: { type: Type.STRING },
              realPrice: { type: Type.NUMBER },
              conditionRating: { type: Type.INTEGER },
              isDeal: { type: Type.BOOLEAN },
              dealScore: { type: Type.NUMBER },
              estimatedMarketPrice: { type: Type.NUMBER },
              reasoning: { type: Type.STRING },
            },
            required: ["brand", "model", "isDeal", "dealScore", "reasoning"],
          },
        },
      });

      const parsed = JSON.parse(response.text || "{}");
      return {
        brand: parsed.brand,
        model: parsed.model,
        cpu: parsed.cpu,
        ramGb: parsed.ramGb,
        storageGb: parsed.storageGb,
        gpu: parsed.gpu,
        realPrice: parsed.realPrice || listing.listedPrice || undefined,
        conditionRating: parsed.conditionRating || 7,
        isDeal: parsed.isDeal ?? false,
        dealScore: parsed.dealScore ?? 50,
        estimatedMarketPrice: parsed.estimatedMarketPrice,
        reasoning: parsed.reasoning || "Análisis completado.",
      };
    } catch (err) {
      console.error("[VisionAnalyzer] Error analyzing listing with Gemini:", err);
      return this.mockEvaluation(listing);
    }
  }

  private async prepareImageParts(urls: string[]): Promise<any[]> {
    const parts: any[] = [];
    for (const url of urls) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 6000); // 6s timeout per image

        const res = await fetch(url, {
          signal: controller.signal,
          headers: { "User-Agent": "Mozilla/5.0" },
        });
        clearTimeout(timeout);

        if (res.ok) {
          const buffer = await res.arrayBuffer();
          // Skip oversized images (> 5MB)
          if (buffer.byteLength > 5 * 1024 * 1024) continue;

          const base64 = Buffer.from(buffer).toString("base64");
          const mimeType = res.headers.get("content-type") || "image/jpeg";
          parts.push({
            inlineData: {
              mimeType,
              data: base64,
            },
          });
        }
      } catch {
        // Skip unreadable, timed out, or inaccessible images
      }
    }
    return parts;
  }

  private mockEvaluation(listing: RawScrapedListing): EvaluatedSpecs {
    const price = listing.listedPrice || 3500;
    return {
      brand: "Generic",
      model: listing.title,
      cpu: "Procesador detectado",
      ramGb: 16,
      storageGb: 512,
      gpu: "Gráficos Dedicados",
      realPrice: price,
      conditionRating: 8,
      isDeal: price < 3000,
      dealScore: price < 3000 ? 85 : 45,
      estimatedMarketPrice: 3800,
      reasoning: "Evaluación preliminar heurística (sin API key de Gemini configurada).",
    };
  }
}
