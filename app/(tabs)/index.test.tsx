import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import HomeScreen from "./index";

const mockPush = jest.fn();
const mockUseImpactData = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
  useFocusEffect: (callback: () => void) => callback(),
}));

jest.mock("../../src/hooks/useImpactData", () => ({
  useImpactData: () => mockUseImpactData(),
}));

jest.mock("../../src/components/ui", () => {
  const ReactModule = require("react");
  const { Pressable } = require("react-native");

  return {
    Card: ({ children }: { children: React.ReactNode }) => ReactModule.createElement(ReactModule.Fragment, null, children),
    PressableScale: ({ children, onPress }: { children: React.ReactNode; onPress?: () => void }) =>
      ReactModule.createElement(Pressable, { onPress }, children),
  };
});

jest.mock("lucide-react-native", () => ({
  Bell: () => null,
  Camera: () => null,
  ChevronRight: () => null,
  Leaf: () => null,
  Lightbulb: () => null,
  PackageCheck: () => null,
  Recycle: () => null,
  Sparkles: () => null,
  Store: () => null,
  TrendingUp: () => null,
  Upload: () => null,
}));

const project = {
  id: "saved-project-1",
  savedAt: "2026-07-25T00:00:00.000Z",
  photoUri: "file://photo.jpg",
  material: { materialLabel: "Botol PET" },
  product: {
    id: "product-1",
    name: "Pot Botol PET",
    shortDescription: "Pot tanaman dari botol bekas.",
    estimatedCost: 15000,
  },
};

describe("HomeScreen recent history", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseImpactData.mockReturnValue({
      history: [project],
      summary: { totalWasteProcessed: 2, totalProductsMade: 1, estimatedEconomicValue: 15000 },
      loading: false,
    });
  });

  it("renders seeded history and routes by product id", async () => {
    const { getByText } = await render(<HomeScreen />);

    expect(getByText("Pot Botol PET")).toBeTruthy();
    fireEvent.press(getByText("Pot Botol PET"));

    expect(mockPush).toHaveBeenCalledWith("/product/product-1");
  });

  it("shows a useful first-scan action when history is empty", async () => {
    mockUseImpactData.mockReturnValue({
      history: [],
      summary: { totalWasteProcessed: 0, totalProductsMade: 0, estimatedEconomicValue: 0 },
      loading: false,
    });

    const { getByText } = await render(<HomeScreen />);

    expect(getByText("Mulai pemindaian pertama")).toBeTruthy();
  });
});
