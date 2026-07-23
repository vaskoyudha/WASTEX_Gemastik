import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  WasteScannerService,
  RecommendationService,
  TutorialService,
  PricingService,
  SellingAssistantService,
  ImpactService,
  ScanResult,
  ProductRecommendation,
  ProductTutorial,
  PricingEstimate,
  SellingKit,
  SavedProject,
  ImpactSummary,
  MaterialType,
} from "./types";
import {
  MOCK_SCAN_RESULTS,
  MOCK_RECOMMENDATIONS,
  MOCK_TUTORIALS,
  MOCK_PRICING,
  MOCK_SELLING,
} from "../mocks/mockData";

const USE_MOCK = true;

const STORAGE_KEYS = {
  SAVED_PROJECTS: "@wastex_saved_projects_v1",
};

// ---- 1. Scanner Service ----
class MockScanner implements WasteScannerService {
  async scan(imageUri: string): Promise<ScanResult> {
    // Simulate AI latency
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Randomly pick one or default to plastik_pet
    const materials: MaterialType[] = [
      "plastik_pet",
      "plastik_hdpe",
      "kardus",
      "kaleng",
      "kaca",
      "sachet",
    ];
    const randomMaterial =
      materials[Math.floor(Math.random() * materials.length)];

    return (
      MOCK_SCAN_RESULTS[randomMaterial] || MOCK_SCAN_RESULTS.plastik_pet
    );
  }
}

// ---- 2. Recommendation Service ----
class MockRecommendation implements RecommendationService {
  async getRecommendations(
    material: ScanResult
  ): Promise<ProductRecommendation[]> {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return (
      MOCK_RECOMMENDATIONS[material.materialType] ||
      MOCK_RECOMMENDATIONS.plastik_pet
    );
  }

  async getProductById(productId: string): Promise<ProductRecommendation | null> {
    await new Promise((resolve) => setTimeout(resolve, 300));
    return (
      Object.values(MOCK_RECOMMENDATIONS)
        .flat()
        .find((product) => product.id === productId) || null
    );
  }
}

// ---- 3. Tutorial Service ----
class MockTutorial implements TutorialService {
  async getTutorial(productId: string): Promise<ProductTutorial> {
    await new Promise((resolve) => setTimeout(resolve, 800));
    return (
      MOCK_TUTORIALS[productId] || MOCK_TUTORIALS["prod_pet_1"]
    );
  }
}

// ---- 4. Pricing Service ----
class MockPricing implements PricingService {
  async estimatePrice(productId: string): Promise<PricingEstimate> {
    await new Promise((resolve) => setTimeout(resolve, 600));
    return (
      MOCK_PRICING[productId] || MOCK_PRICING["prod_pet_1"]
    );
  }
}

// ---- 5. Selling Assistant Service ----
class MockSelling implements SellingAssistantService {
  async getSellingKit(productId: string): Promise<SellingKit> {
    await new Promise((resolve) => setTimeout(resolve, 700));
    return (
      MOCK_SELLING[productId] || MOCK_SELLING["prod_pet_1"]
    );
  }
}

// ---- 6. Impact Service (AsyncStorage) ----
class LocalImpactService implements ImpactService {
  async saveProject(project: SavedProject): Promise<void> {
    const existing = await this.getHistory();
    const updated = [project, ...existing];
    await AsyncStorage.setItem(
      STORAGE_KEYS.SAVED_PROJECTS,
      JSON.stringify(updated)
    );
  }

  async getHistory(): Promise<SavedProject[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.SAVED_PROJECTS);
      if (!data) return [];
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  async getImpactSummary(): Promise<ImpactSummary> {
    const history = await this.getHistory();
    const totalWasteProcessed = history.length * 2; // e.g., 2 items per project
    const totalProductsMade = history.length;
    const estimatedEconomicValue = history.reduce(
      (sum, p) => sum + 15000,
      0
    ); // avg 15k per product

    return {
      totalWasteProcessed,
      totalProductsMade,
      estimatedEconomicValue,
    };
  }

  async deleteProject(id: string): Promise<void> {
    const history = await this.getHistory();
    const updated = history.filter((p) => p.id !== id);
    await AsyncStorage.setItem(
      STORAGE_KEYS.SAVED_PROJECTS,
      JSON.stringify(updated)
    );
  }

  async clearAll(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEYS.SAVED_PROJECTS);
  }
}

// ---- Exports Registry ----
export const scanner: WasteScannerService = new MockScanner();
export const recommendation: RecommendationService = new MockRecommendation();
export const tutorial: TutorialService = new MockTutorial();
export const pricing: PricingService = new MockPricing();
export const selling: SellingAssistantService = new MockSelling();
export const impact: ImpactService = new LocalImpactService();
