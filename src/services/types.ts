// ---- Shared enums ----
export type MaterialType =
  | "plastik_pet"
  | "plastik_hdpe"
  | "kardus"
  | "kaleng"
  | "kaca"
  | "sachet";

export type RiskLevel = "aman" | "hati_hati" | "berisiko";

export type Difficulty = "mudah" | "sedang" | "sulit";

// ---- Scanner ----
export interface ScanResult {
  materialType: MaterialType;
  materialLabel: string;
  condition: string;
  confidence: number; // 0–1; <0.7 triggers manual correction
  riskLevel: RiskLevel;
  safetyNotes: string[];
  potentialUses: string[];
}

export interface WasteScannerService {
  scan(imageUri: string): Promise<ScanResult>;
}

// ---- Recommendation ----
export interface ProductRecommendation {
  id: string;
  name: string;
  thumbnailUri: string;
  difficulty: Difficulty;
  estimatedCost: number;
  estimatedTimeMinutes: number;
  shortDescription: string;
}

export interface RecommendationService {
  getRecommendations(material: ScanResult): Promise<ProductRecommendation[]>;
}

// ---- Tutorial ----
export interface TutorialStep {
  order: number;
  title: string;
  description: string;
  imageUri: string;
  safetyWarning?: string;
}

export interface ProductTutorial {
  productId: string;
  steps: TutorialStep[];
  beforeImageUri: string;
  afterImageUri: string;
  mockupImageUri: string;
  toolsAndMaterials: string[];
}

export interface TutorialService {
  getTutorial(productId: string): Promise<ProductTutorial>;
}

// ---- Pricing ----
export interface PricingEstimate {
  productId: string;
  materialCost: number;
  additionalCost: number;
  suggestedSellPrice: number;
  estimatedProfit: number;
  priceRangeLow: number;
  priceRangeHigh: number;
  notes: string;
}

export interface PricingService {
  estimatePrice(productId: string): Promise<PricingEstimate>;
}

// ---- Selling ----
export interface SellingKit {
  productId: string;
  productName: string;
  description: string;
  captions: string[];
  photoTips: string[];
  packagingIdeas: string[];
}

export interface SellingAssistantService {
  getSellingKit(productId: string): Promise<SellingKit>;
}

// ---- Impact / History (local) ----
export interface SavedProject {
  id: string;
  savedAt: string; // ISO date
  material: ScanResult;
  product: ProductRecommendation;
  photoUri: string;
}

export interface ImpactSummary {
  totalWasteProcessed: number;
  totalProductsMade: number;
  estimatedEconomicValue: number;
}

export interface ImpactService {
  saveProject(project: SavedProject): Promise<void>;
  getHistory(): Promise<SavedProject[]>;
  getImpactSummary(): Promise<ImpactSummary>;
  deleteProject(id: string): Promise<void>;
  clearAll(): Promise<void>;
}
