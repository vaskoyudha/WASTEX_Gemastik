import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { Pressable as MockPressable, Text as MockText } from "react-native";
import SellingScreen from "./selling";

const mockShareStory = jest.fn();
const mockShareFeed = jest.fn();
const mockShareOther = jest.fn();
const mockGetStoryAsset = jest.fn();

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

jest.mock("../../../src/services/api", () => ({
  apiClient: {
    getCompletionStoryAsset: (...args: unknown[]) => mockGetStoryAsset(...args),
  },
}));

jest.mock("../../../src/services/socialSharing", () => ({
  buildSocialCaption: () => "Vas Botol Estetik\n\nPesan sekarang!\n\n#WASTEX",
  InstagramShareConfigurationError: class extends Error {},
  NativeInstagramShareUnavailableError: class extends Error {},
  isShareCancellation: () => false,
  shareToInstagramStory: (...args: unknown[]) => mockShareStory(...args),
  shareToInstagramFeed: (...args: unknown[]) => mockShareFeed(...args),
  shareToOtherApps: (...args: unknown[]) => mockShareOther(...args),
}));

jest.mock("expo-clipboard", () => ({ setStringAsync: jest.fn() }));

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
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetStoryAsset.mockResolvedValue({
      completion_id: "c1",
      story_image_url: "https://example.test/completions/promos/c1-story.png",
    });
  });

  it("opens Instagram Story with the generated vertical asset", async () => {
    const { getByText } = await render(<SellingScreen />);

    expect(getByText("Poster Promosi AI")).toBeTruthy();
    expect(getByText("poster-image")).toBeTruthy();

    await fireEvent.press(getByText("Instagram Story"));
    expect(mockGetStoryAsset).toHaveBeenCalledWith("s1", "c1");
    expect(mockShareStory).toHaveBeenCalledWith(
      "https://example.test/completions/promos/c1-story.png",
      expect.stringContaining("#WASTEX"),
      undefined,
    );
  });

  it("offers direct Feed and other-app sharing", async () => {
    const { getByText } = await render(<SellingScreen />);

    await fireEvent.press(getByText("Instagram Feed"));
    expect(mockShareFeed).toHaveBeenCalledWith(
      "https://example.test/completions/promos/c1.png",
      expect.stringContaining("Pesan sekarang!"),
    );

    await fireEvent.press(getByText("Aplikasi Lain"));
    expect(mockShareOther).toHaveBeenCalled();
  });
});
