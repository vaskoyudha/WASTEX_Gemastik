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
  Difficulty,
  BackendDifficulty,
  BackendScanResult,
  BackendTutorial,
  BackendPricing,
  BackendSellingKit,
  Skill,
} from "./types";
import {
  MOCK_SCAN_RESULTS,
  MOCK_RECOMMENDATIONS,
  MOCK_TUTORIALS,
  MOCK_PRICING,
  MOCK_SELLING,
} from "../mocks/mockData";
import { apiClient } from "./api";
import { visualUrl } from "./api";

class MockScanner implements WasteScannerService {
  async scan(_imageUri: string): Promise<ScanResult> {
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

const DIFFICULTY_MAP: Record<BackendDifficulty, Difficulty> = {
  pemula: "mudah",
  menengah: "sedang",
  mahir: "sulit",
};

function skillToProduct(skill: Skill): ProductRecommendation {
  return {
    id: skill.id,
    name: skill.title,
    thumbnailUri: "",
    difficulty: DIFFICULTY_MAP[skill.difficulty] ?? "sedang",
    estimatedCost: skill.est_cost_idr ?? 0,
    estimatedTimeMinutes: (skill.steps?.length ?? 0) * 10 || 30,
    shortDescription: skill.description ?? "",
  };
}

/** Ambil URL visual untuk produk; fallback before_after -> mockup -> "" (tanpa gambar). */
async function productThumbnailUri(skillId: string): Promise<string> {
  for (const kind of ["before_after", "mockup"] as const) {
    try {
      const v = await apiClient.getVisual(skillId, kind);
      if (v?.image_path) return visualUrl(v.image_path);
    } catch {
      // visual belum ada — coba kind berikutnya
    }
  }
  return "";
}

class ApiScanner implements WasteScannerService {
  async scan(imageUri: string): Promise<ScanResult> {
    const result = (await apiClient.scan(imageUri)) as BackendScanResult;
    const material =
      result.identification?.material ?? result.material_options?.[0] ?? "plastik_pet";
    const base = MOCK_SCAN_RESULTS[material] || MOCK_SCAN_RESULTS.plastik_pet;
    return {
      ...base,
      condition: result.identification?.condition ?? base.condition,
      confidence: result.identification?.confidence ?? 0,
      needsVerification: result.status === "needs_manual_verification",
      scan_id: result.scan_id,
    };
  }

  async getMaterialInfo(materialType: MaterialType): Promise<ScanResult> {
    return MOCK_SCAN_RESULTS[materialType] || MOCK_SCAN_RESULTS.plastik_pet;
  }
}

class ApiRecommendation implements RecommendationService {
  async getRecommendations(material: ScanResult): Promise<ProductRecommendation[]> {
    const skills = (await apiClient.getProducts()) as Skill[];
    const matching = skills.filter((s) => s.material === material.materialType);
    const list = (matching.length > 0 ? matching : skills).map(skillToProduct);
    return Promise.all(list.map(async (p) => ({ ...p, thumbnailUri: await productThumbnailUri(p.id) })));
  }

  async getProductById(productId: string): Promise<ProductRecommendation | null> {
    try {
      const skill = (await apiClient.getProduct(productId)) as Skill;
      const product = skillToProduct(skill);
      product.thumbnailUri = await productThumbnailUri(productId);
      return product;
    } catch {
      return null;
    }
  }

  async getAllProducts(): Promise<ProductRecommendation[]> {
    const skills = (await apiClient.getProducts()) as Skill[];
    const list = skills.map(skillToProduct);
    return Promise.all(list.map(async (p) => ({ ...p, thumbnailUri: await productThumbnailUri(p.id) })));
  }
}

export function tutorialFromBackend(t: BackendTutorial): ProductTutorial {
  return {
    productId: t.skill_id,
    steps: t.steps.map((step) => ({
      order: step.order,
      title: `Langkah ${step.order}`,
      description: step.instruction,
      imageUri: '',
      safetyWarning: step.warning ?? undefined,
    })),
    beforeImageUri: '',
    afterImageUri: '',
    mockupImageUri: '',
    toolsAndMaterials: [
      ...(t.tools ?? []).map((tool) => tool.name),
      ...(t.additional_materials ?? []).map((m) => m.name),
    ],
    additionalMaterials: t.additional_materials ?? [],
  };
}

class ApiTutorial implements TutorialService {
  async getTutorial(productId: string): Promise<ProductTutorial> {
    const t = (await apiClient.getTutorial(productId)) as BackendTutorial;
    const tut = tutorialFromBackend(t);

    // Ambil visuals yang sudah digenerate (storyboard per step, before/after,
    // mockup, panel materials). Gagal diam-diam -> placeholder kosong seperti sebelumnya.
    const [storyboards, beforeAfter, mockup, materials] = await Promise.all([
      Promise.allSettled(
        (t.steps ?? []).map((s) => apiClient.getVisual(productId, "storyboard", s.order))
      ),
      apiClient.getVisual(productId, "before_after").catch(() => null),
      apiClient.getVisual(productId, "mockup").catch(() => null),
      apiClient.getVisual(productId, "materials").catch(() => null),
    ]);

    storyboards.forEach((res, i) => {
      if (res.status === "fulfilled" && res.value?.image_path && tut.steps[i]) {
        tut.steps[i].imageUri = visualUrl(res.value.image_path);
      }
    });
    if (beforeAfter?.image_path) {
      tut.beforeImageUri = visualUrl(beforeAfter.image_path);
      tut.afterImageUri = visualUrl(beforeAfter.image_path);
    }
    if (mockup?.image_path) {
      tut.mockupImageUri = visualUrl(mockup.image_path);
    }
    if (materials?.image_path) {
      tut.materialsImageUri = visualUrl(materials.image_path);
    }

    return tut;
  }
}

class ApiPricing implements PricingService {
  async estimatePrice(productId: string): Promise<PricingEstimate> {
    const p = (await apiClient.getPricing(productId)) as BackendPricing;
    return {
      productId: p.skill_id,
      materialCost: p.material_cost,
      additionalCost: p.labor_cost,
      suggestedSellPrice: p.suggested_price,
      estimatedProfit: p.suggested_price - p.total_cost,
      priceRangeLow: Math.round((p.suggested_price * 0.9) / 1000) * 1000,
      priceRangeHigh: Math.round((p.suggested_price * 1.1) / 1000) * 1000,
      notes: `Margin ${Math.round(p.profit_margin * 100)}% dari total biaya.`,
    };
  }
}

export function sellingKitFromBackend(kit: BackendSellingKit): SellingKit {
  return {
    productId: kit.skill_id,
    productName: kit.product_name,
    description: kit.description,
    captions: kit.captions ?? [],
    photoTips: kit.photo_tips ?? [],
    packagingIdeas: kit.packaging_ideas ?? [],
  };
}

class ApiSelling implements SellingAssistantService {
  async getSellingKit(productId: string): Promise<SellingKit> {
    const kit = (await apiClient.getSellingKit(productId)) as BackendSellingKit;
    return sellingKitFromBackend(kit);
  }
}

// Set EXPO_PUBLIC_USE_MOCK=false to call the real backend API.
export const USE_MOCK = process.env.EXPO_PUBLIC_USE_MOCK !== "false";

export const scanner: WasteScannerService = USE_MOCK ? new MockScanner() : new ApiScanner();
export const recommendation: RecommendationService = USE_MOCK
  ? new MockRecommendation()
  : new ApiRecommendation();
export const tutorial: TutorialService = USE_MOCK ? new MockTutorial() : new ApiTutorial();
export const pricing: PricingService = USE_MOCK ? new MockPricing() : new ApiPricing();
export const selling: SellingAssistantService = USE_MOCK
  ? new MockSelling()
  : new ApiSelling();
export { impact } from "./impact";
