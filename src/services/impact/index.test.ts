import AsyncStorage from "@react-native-async-storage/async-storage";
import { HISTORY_STORAGE_KEY, LocalImpactService } from ".";
import { SavedProject } from "../types";

const mockStore: Record<string, string> = {};

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn((key: string) => Promise.resolve(mockStore[key] ?? null)),
  setItem: jest.fn((key: string, value: string) => {
    mockStore[key] = value;
    return Promise.resolve();
  }),
  removeItem: jest.fn((key: string) => {
    delete mockStore[key];
    return Promise.resolve();
  }),
}));

function makeProject(id: string, estimatedCost: number): SavedProject {
  return {
    id,
    savedAt: "2026-07-25T00:00:00.000Z",
    photoUri: `file://${id}.jpg`,
    material: {
      materialType: "plastik_pet",
      materialLabel: "Botol Plastik PET",
      condition: "Bersih",
      confidence: 0.91,
      riskLevel: "aman",
      safetyNotes: [],
      potentialUses: [],
    },
    product: {
      id: `product-${id}`,
      name: `Produk ${id}`,
      thumbnailUri: `file://${id}.png`,
      difficulty: "mudah",
      estimatedCost,
      estimatedTimeMinutes: 30,
      shortDescription: "Produk uji",
    },
  };
}

describe("LocalImpactService", () => {
  beforeEach(() => {
    Object.keys(mockStore).forEach((key) => delete mockStore[key]);
    jest.clearAllMocks();
  });

  it("stores projects with the contracted history key", async () => {
    const service = new LocalImpactService();

    await service.saveProject(makeProject("one", 10000));

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(HISTORY_STORAGE_KEY, expect.any(String));
    expect(HISTORY_STORAGE_KEY).toBe("wastex.history.v1");
  });

  it("summarizes impact from saved product estimated costs", async () => {
    const service = new LocalImpactService();

    await service.saveProject(makeProject("one", 10000));
    await service.saveProject(makeProject("two", 25000));

    const summary = await service.getImpactSummary();

    expect(summary.totalProductsMade).toBe(2);
    expect(summary.totalWasteProcessed).toBe(4);
    expect(summary.estimatedEconomicValue).toBe(35000);
  });

  it("returns empty history when stored JSON is corrupt", async () => {
    const service = new LocalImpactService();
    mockStore[HISTORY_STORAGE_KEY] = "{bad";

    await expect(service.getHistory()).resolves.toEqual([]);
  });

  it("migrates legacy history data to the contracted key", async () => {
    const service = new LocalImpactService();
    mockStore["@wastex_saved_projects_v1"] = JSON.stringify([makeProject("legacy", 18000)]);

    const history = await service.getHistory();

    expect(history).toHaveLength(1);
    expect(mockStore[HISTORY_STORAGE_KEY]).toBeTruthy();
    expect(mockStore["@wastex_saved_projects_v1"]).toBeUndefined();
  });

  it("deletes one project without clearing the whole history", async () => {
    const service = new LocalImpactService();

    await service.saveProject(makeProject("one", 10000));
    await service.saveProject(makeProject("two", 25000));
    await service.deleteProject("one");

    const history = await service.getHistory();

    expect(history).toHaveLength(1);
    expect(history[0].id).toBe("two");
  });

  it("clearAll removes both history keys and keeps onboarding state", async () => {
    const service = new LocalImpactService();
    mockStore["wastex.onboarded"] = "true";
    mockStore["@wastex_saved_projects_v1"] = JSON.stringify([makeProject("legacy", 18000)]);
    mockStore[HISTORY_STORAGE_KEY] = JSON.stringify([makeProject("one", 10000)]);
    await service.clearAll();

    expect(mockStore[HISTORY_STORAGE_KEY]).toBeUndefined();
    expect(mockStore["@wastex_saved_projects_v1"]).toBeUndefined();
    expect(mockStore["wastex.onboarded"]).toBe("true");
    await expect(service.getHistory()).resolves.toEqual([]);
    expect(AsyncStorage.removeItem).toHaveBeenCalledTimes(2);
    expect(AsyncStorage.removeItem).toHaveBeenNthCalledWith(1, HISTORY_STORAGE_KEY);
    expect(AsyncStorage.removeItem).toHaveBeenNthCalledWith(2, "@wastex_saved_projects_v1");
  });
});
