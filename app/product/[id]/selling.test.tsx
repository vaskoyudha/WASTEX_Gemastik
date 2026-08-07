import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { Pressable as MockPressable, Share, Text as MockText } from "react-native";
import SellingScreen from "./selling";

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ id: "s1", completionId: "c1" }),
  useRouter: () => ({ canGoBack: () => true, back: jest.fn(), replace: jest.fn() }),
}));

jest.mock("../../../src/hooks/useProductData", () => ({
  useProductData: () => ({
    product: { id: "s1", name: "Vas Botol", thumbnailUri: "" },
    tutData: { mockupImageUri: "" },
    sellData: {
      productId: "s1",
      productName: "Vas Botol Estetik",
      description: "Vas upcycle siap dijual.",
      captions: ["Pesan sekarang!"],
      photoTips: ["Gunakan cahaya alami."],
      packagingIdeas: ["Gunakan kertas bekas."],
      hashtags: ["#WASTEX"],
      completionId: "c1",
      promoImageUri: "https://example.test/completions/promos/c1.png",
    },
    loading: false,
    error: null,
    sellingLoading: false,
    sellingError: null,
    refetch: jest.fn(),
  }),
}));

jest.mock("../../../src/store/useScanStore", () => ({
  useScanStore: () => ({ scanResult: null, imageUri: null, resetSession: jest.fn() }),
}));

jest.mock("../../../src/services", () => ({
  impact: { saveProject: jest.fn() },
  scanner: { getMaterialInfo: jest.fn() },
}));

jest.mock("../../../src/components/ui", () => ({
  Header: ({ title }: { title: string }) => <MockText>{title}</MockText>,
  Button: ({ title, onPress }: { title: string; onPress?: () => void }) => (
    <MockPressable onPress={onPress}>
      <MockText>{title}</MockText>
    </MockPressable>
  ),
  Card: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  FitImage: () => <MockText>poster-image</MockText>,
  LoadingSpinner: ({ message }: { message: string }) => <MockText>{message}</MockText>,
}));

jest.mock("lucide-react-native", () => ({
  Copy: () => null,
  Share2: () => null,
  Check: () => null,
  BookmarkCheck: () => null,
}));

describe("SellingScreen", () => {
  it("shows and shares the personalized AI poster with selling copy", async () => {
    const share = jest.spyOn(Share, "share").mockResolvedValue({ action: Share.sharedAction });
    const { getByText } = await render(<SellingScreen />);

    expect(getByText("Poster Promosi AI")).toBeTruthy();
    expect(getByText("poster-image")).toBeTruthy();

    await fireEvent.press(getByText("Bagikan Semua"));
    expect(share).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("Vas upcycle siap dijual."),
        url: "https://example.test/completions/promos/c1.png",
      }),
    );
  });
});
