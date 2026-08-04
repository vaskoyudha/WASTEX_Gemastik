import { create } from "zustand";
import {
  ScanResult,
  ProductRecommendation,
  ProductTutorial,
  PricingEstimate,
  SellingKit,
  MaterialType,
} from "../services/types";

interface ScanStoreState {
  imageUri: string | null;
  scanResult: ScanResult | null;
  recommendations: ProductRecommendation[];
  selectedProduct: ProductRecommendation | null;
  selectedTutorial: ProductTutorial | null;
  selectedPricing: PricingEstimate | null;
  selectedSellingKit: SellingKit | null;

  // Actions
  setImageUri: (uri: string | null) => void;
  setScanResult: (result: ScanResult | null) => void;
  updateScanResultMaterial: (
    materialType: MaterialType,
    materialLabel: string
  ) => void;
  setRecommendations: (recommendations: ProductRecommendation[]) => void;
  setSelectedProduct: (product: ProductRecommendation | null) => void;
  setSelectedTutorial: (tutorial: ProductTutorial | null) => void;
  setSelectedPricing: (pricing: PricingEstimate | null) => void;
  setSelectedSellingKit: (kit: SellingKit | null) => void;
  resetSession: () => void;
}

export const useScanStore = create<ScanStoreState>((set) => ({
  imageUri: null,
  scanResult: null,
  recommendations: [],
  selectedProduct: null,
  selectedTutorial: null,
  selectedPricing: null,
  selectedSellingKit: null,

  setImageUri: (imageUri) => set({ imageUri }),
  setScanResult: (scanResult) => set({ scanResult }),

  updateScanResultMaterial: (materialType, materialLabel) =>
    set((state) => ({
      scanResult: state.scanResult
        ? {
            ...state.scanResult,
            materialType,
            materialLabel,
            confidence: 1.0, // Set to 1.0 after manual correction
            needsVerification: false,
          }
        : null,
    })),

  setRecommendations: (recommendations) => set({ recommendations }),
  setSelectedProduct: (selectedProduct) => set({ selectedProduct }),
  setSelectedTutorial: (selectedTutorial) => set({ selectedTutorial }),
  setSelectedPricing: (selectedPricing) => set({ selectedPricing }),
  setSelectedSellingKit: (selectedSellingKit) => set({ selectedSellingKit }),

  resetSession: () =>
    set({
      imageUri: null,
      scanResult: null,
      recommendations: [],
      selectedProduct: null,
      selectedTutorial: null,
      selectedPricing: null,
      selectedSellingKit: null,
    }),
}));
