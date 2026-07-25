import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { Pressable as MockPressable, Text as MockText } from "react-native";
import RekomendasiScreen from "./rekomendasi";

const mockPush = jest.fn();
const mockSetSelectedProduct = jest.fn();
const mockExecute = jest.fn();
const mockRefetch = jest.fn();
const product = {
  id: "pet-pot",
  name: "Pot Botol PET",
  thumbnailUri: "https://example.com/pot.png",
  difficulty: "mudah" as const,
  estimatedCost: 15000,
  estimatedTimeMinutes: 30,
  shortDescription: "Pot tanaman dari botol bekas.",
};

const mockServiceState = {
  data: [product],
  loading: false,
  error: null as Error | null,
};

jest.mock("expo-router", () => ({
  useRouter: () => ({ canGoBack: () => true, back: jest.fn(), push: mockPush }),
}));

jest.mock("../../src/store/useScanStore", () => ({
  useScanStore: (selector: (state: { scanResult: object; setSelectedProduct: typeof mockSetSelectedProduct }) => unknown) => selector({
    scanResult: {
      materialType: "plastik_pet",
      materialLabel: "Botol PET",
      condition: "Bersih",
      confidence: 0.9,
      riskLevel: "aman",
      safetyNotes: [],
      potentialUses: [],
    },
    setSelectedProduct: mockSetSelectedProduct,
  }),
}));

jest.mock("../../src/services/localState", () => ({
  bookmarks: { toggle: mockExecute },
}));

jest.mock("../../src/services", () => ({
  recommendation: {
    getRecommendations: mockExecute,
  },
}));

jest.mock("../../src/hooks/useServiceCall", () => ({
  useServiceCall: () => ({
    ...mockServiceState,
    execute: mockExecute,
    refetch: mockRefetch,
  }),
}));

jest.mock("../../src/components/ui", () => ({
  Badge: ({ label }: { label?: string }) => <MockText>{label ?? "Mudah"}</MockText>,
  Card: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  EmptyState: ({ title, actionLabel, onAction }: { title: string; actionLabel?: string; onAction?: () => void }) => (
    <>
      <MockText>{title}</MockText>
      {actionLabel && onAction ? <MockPressable onPress={onAction}><MockText>{actionLabel}</MockText></MockPressable> : null}
    </>
  ),
  Header: ({ title }: { title: string }) => <MockText>{title}</MockText>,
  LoadingSpinner: ({ message }: { message: string }) => <MockText>{message}</MockText>,
}));

jest.mock("lucide-react-native", () => ({
  Bookmark: () => null,
  ChevronRight: () => null,
  Clock: () => null,
  Tag: () => null,
}));

describe("RekomendasiScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockServiceState.data = [product];
    mockServiceState.error = null;
  });

  it("renders ProductCard recommendations and navigates with product id", async () => {
    const { getByText } = await render(<RekomendasiScreen />);

    expect(getByText("Pot Botol PET")).toBeTruthy();
    fireEvent.press(getByText("Pot Botol PET"));

    expect(mockSetSelectedProduct).toHaveBeenCalledWith(product);
    expect(mockPush).toHaveBeenCalledWith("../product/pet-pot");
  });

  it("renders EmptyState when recommendation service returns no products", async () => {
    mockServiceState.data = [];
    const { getByText } = await render(<RekomendasiScreen />);

    expect(getByText("Tidak Ada Rekomendasi")).toBeTruthy();
  });

  it("renders retry state when recommendation service fails", async () => {
    mockServiceState.error = new Error("service unavailable");
    const { getByText } = await render(<RekomendasiScreen />);

    expect(getByText("Rekomendasi Gagal Dimuat")).toBeTruthy();
    fireEvent.press(getByText("Coba Lagi"));
    expect(mockRefetch).toHaveBeenCalled();
  });
});
