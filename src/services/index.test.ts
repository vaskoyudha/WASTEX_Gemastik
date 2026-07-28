import {
  USE_MOCK,
  scanner,
  recommendation,
  tutorial,
  pricing,
  selling,
} from ".";
import { MaterialType } from "./types";

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
}));

const ALL_MATERIALS: MaterialType[] = [
  "plastik_pet",
  "plastik_hdpe",
  "kardus",
  "kaleng",
  "kaca",
  "sachet",
];

describe("service registry integration (USE_MOCK)", () => {
  it("defaults to mock services unless EXPO_PUBLIC_USE_MOCK=false", () => {
    expect(USE_MOCK).toBe(true);
  });

  it.each(ALL_MATERIALS)(
    "serves material info and >=1 recommendation for %s",
    async (material) => {
      const info = await scanner.getMaterialInfo(material);

      expect(info.materialType).toBe(material);
      expect(["aman", "hati_hati", "berisiko"]).toContain(info.riskLevel);

      const products = await recommendation.getRecommendations(info);

      expect(products.length).toBeGreaterThanOrEqual(1);
      expect(products[0].id).toBeTruthy();
    }
  );

  it("serves tutorial, pricing, and selling kit with fallback for unknown ids", async () => {
    const [tutorialData, pricingData, sellingData] = await Promise.all([
      tutorial.getTutorial("unknown-product-id"),
      pricing.estimatePrice("unknown-product-id"),
      selling.getSellingKit("unknown-product-id"),
    ]);

    expect(tutorialData.steps.length).toBeGreaterThan(0);
    expect(tutorialData.steps[0].order).toBe(1);
    expect(pricingData.suggestedSellPrice).toBeGreaterThan(pricingData.materialCost);
    expect(sellingData.captions.length).toBeGreaterThan(0);
  });
});
