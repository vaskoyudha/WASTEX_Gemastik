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

// ---- Backend-aligned types (for API integration) ----
export type BackendMaterial =
  | 'plastik_pet'
  | 'plastik_hdpe'
  | 'kardus'
  | 'kaleng'
  | 'kaca'
  | 'sachet';

export type BackendDifficulty = 'pemula' | 'menengah' | 'mahir';

export type SkillStatus = 'draft' | 'approved' | 'rejected' | 'needs_revision';

// ---- Scanner ----
export interface ScanResult {
  materialType: MaterialType;
  materialLabel: string;
  condition: string;
  confidence: number;
  riskLevel: RiskLevel;
  difficulty?: Difficulty;
  potentialValue?: "rendah" | "sedang" | "tinggi";
  safetyNotes: string[];
  potentialUses: string[];
}

export interface WasteScannerService {
  scan(imageUri: string): Promise<ScanResult>;
  getMaterialInfo(materialType: MaterialType): Promise<ScanResult>;
}

// ---- Backend Scanner ----
export interface MaterialIdentification {
  material: BackendMaterial;
  condition: string;
  confidence: number;
}

export interface BackendScanResult {
  scan_id: string;
  status: 'identified' | 'needs_manual_verification';
  identification?: MaterialIdentification;
  material_options?: BackendMaterial[];
  imageUri?: string;
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
  getProductById(productId: string): Promise<ProductRecommendation | null>;
  getAllProducts(): Promise<ProductRecommendation[]>;
}

// ---- Backend Recommendation ----
export interface ToolItem {
  name: string;
  optional: boolean;
}

export interface Step {
  order: number;
  instruction: string;
  warning?: string;
  visual_description?: string;
}

export interface Risk {
  hazard: string;
  mitigation: string;
}

export interface SolutionPackage {
  recommendation: string;
  steps: Step[];
  tools: ToolItem[];
  risks: Risk[];
  est_cost_idr?: number;
  est_price_idr?: number;
  marketing_copy?: string;
  est_time_minutes?: number;
  sources: string[];
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

// ---- Backend Selling ----
export interface BackendSellingKit {
  skill_id: string;
  product_name: string;
  description: string;
  captions: string[];
  photo_tips: string[];
  packaging_ideas: string[];
  hashtags: string[];
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

// ---- Backend Tutorial ----
export interface BackendTutorial {
  skill_id: string;
  title: string;
  description: string;
  difficulty: BackendDifficulty;
  materials: string[];
  tools: string[];
  steps: Step[];
  estimated_time: string;
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

// ---- Backend Pricing ----
export interface BackendPricing {
  skill_id: string;
  title: string;
  material_cost: number;
  labor_cost: number;
  total_cost: number;
  profit_margin: number;
  suggested_price: number;
  currency: string;
}

// ---- Backend Skills ----
export interface Skill {
  id: string;
  title: string;
  description: string;
  difficulty: BackendDifficulty;
  material: BackendMaterial;
  materials: string[];
  tools: string[];
  steps: Step[];
  risks: Risk[];
  est_cost_idr?: number;
  est_price_idr?: number;
  status: SkillStatus;
  author_id?: string;
  created_at: string;
  updated_at?: string;
}

// ---- Impact / History (local) ----
export interface SavedProject {
  id: string;
  savedAt: string;
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

// ---- Auth ----
export interface User {
  id: string;
  email: string;
  accessToken: string | null;
  profile: UserProfile | null;
}

export interface UserProfile {
  id: string;
  authUserId: string;
  displayName: string;
  firstName?: string | null;
  lastName?: string | null;
  bio?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
  createdAt: string;
  updatedAt?: string | null;
}

export interface UpdateProfileRequest {
  displayName?: string;
  firstName?: string | null;
  lastName?: string | null;
  bio?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
}

export interface AuthResult {
  accessToken: string;
  userId: string;
  profile: UserProfile;
}

export interface AuthService {
  signUp(email: string, password: string, displayName: string, data?: UpdateProfileRequest): Promise<AuthResult>;
  signIn(email: string, password: string): Promise<AuthResult>;
  signOut(): Promise<void>;
  getUser(): User | null;
  isLoggedIn(): boolean;
  getAccessToken(): string | null;
  updateProfile(data: UpdateProfileRequest): Promise<UserProfile>;
  deleteAccount(): Promise<void>;
}
