import {
  WasteScannerService,
  RecommendationService,
  TutorialService,
  PricingService,
  SellingAssistantService,
  ScanResult,
  ProductRecommendation,
  ProductTutorial,
  PricingEstimate,
  SellingKit,
  MaterialType,
} from "./types";
import {
  MOCK_SCAN_RESULTS,
  MOCK_RECOMMENDATIONS,
  MOCK_TUTORIALS,
  MOCK_PRICING,
  MOCK_SELLING,
} from "../mocks/mockData";

class MockScanner implements WasteScannerService {
  async scan(imageUri: string): Promise<ScanResult> {
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const materials: MaterialType[] = [
      "plastik_pet",
      "plastik_hdpe",
      "kardus",
      "kaleng",
      "kaca",
      "sachet",
    ];
    const randomMaterial = materials[Math.floor(Math.random() * materials.length)];

    return MOCK_SCAN_RESULTS[randomMaterial] || MOCK_SCAN_RESULTS.plastik_pet;
  }

  async getMaterialInfo(materialType: MaterialType): Promise<ScanResult> {
    return MOCK_SCAN_RESULTS[materialType] || MOCK_SCAN_RESULTS.plastik_pet;
  }
}

class MockRecommendation implements RecommendationService {
  async getRecommendations(material: ScanResult): Promise<ProductRecommendation[]> {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return MOCK_RECOMMENDATIONS[material.materialType] || MOCK_RECOMMENDATIONS.plastik_pet;
  }

  async getProductById(productId: string): Promise<ProductRecommendation | null> {
    await new Promise((resolve) => setTimeout(resolve, 300));
    return (
      Object.values(MOCK_RECOMMENDATIONS)
        .flat()
        .find((product) => product.id === productId) || null
    );
  }

  async getAllProducts(): Promise<ProductRecommendation[]> {
    return Object.values(MOCK_RECOMMENDATIONS).flat();
  }
}

class MockTutorial implements TutorialService {
  async getTutorial(productId: string): Promise<ProductTutorial> {
    await new Promise((resolve) => setTimeout(resolve, 800));
    return MOCK_TUTORIALS[productId] || MOCK_TUTORIALS["prod_pet_1"];
  }
}

class MockPricing implements PricingService {
  async estimatePrice(productId: string): Promise<PricingEstimate> {
    await new Promise((resolve) => setTimeout(resolve, 600));
    return MOCK_PRICING[productId] || MOCK_PRICING["prod_pet_1"];
  }
}

class MockSelling implements SellingAssistantService {
  async getSellingKit(productId: string): Promise<SellingKit> {
    await new Promise((resolve) => setTimeout(resolve, 700));
    return MOCK_SELLING[productId] || MOCK_SELLING["prod_pet_1"];
  }
}

export const scanner: WasteScannerService = new MockScanner();
export const recommendation: RecommendationService = new MockRecommendation();
export const tutorial: TutorialService = new MockTutorial();
export const pricing: PricingService = new MockPricing();
export const selling: SellingAssistantService = new MockSelling();
export { impact } from "./impact";
