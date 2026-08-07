const mockClipboard = jest.fn();
const mockDownload = jest.fn();
const mockShareSingle = jest.fn();
const mockShareOpen = jest.fn();

jest.mock("expo-clipboard", () => ({ setStringAsync: (...args: unknown[]) => mockClipboard(...args) }));
jest.mock("expo-file-system", () => ({
  File: class MockFile {
    static downloadFileAsync(...args: unknown[]) {
      return mockDownload(...args);
    }

    uri: string;

    constructor(_cache: unknown, name: string) {
      this.uri = `file:///cache/${name}`;
    }
  },
  Paths: { cache: "file:///cache" },
}));
jest.mock("react-native-share", () => ({
  __esModule: true,
  default: {
    shareSingle: (...args: unknown[]) => mockShareSingle(...args),
    open: (...args: unknown[]) => mockShareOpen(...args),
  },
  Social: {
    InstagramStories: "instagramstories",
    Instagram: "instagram",
  },
}));

import {
  buildSocialCaption,
  InstagramShareConfigurationError,
  shareToInstagramFeed,
  shareToInstagramStory,
} from "../socialSharing";

const KIT = {
  productId: "s1",
  productName: "Vas Botol Estetik",
  description: "Vas dari botol bekas.",
  captions: ["Pesan sekarang!"],
  photoTips: [],
  packagingIdeas: [],
  hashtags: ["#WASTEX", "#Upcycling"],
};

describe("socialSharing", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDownload.mockResolvedValue({ uri: "file:///cache/poster.png" });
    mockShareSingle.mockResolvedValue({ success: true });
  });

  it("builds one ready-to-paste social caption", () => {
    expect(buildSocialCaption(KIT)).toContain("Vas dari botol bekas.");
    expect(buildSocialCaption(KIT)).toContain("#WASTEX #Upcycling");
  });

  it("downloads and opens the Instagram Story composer", async () => {
    await shareToInstagramStory("https://example.test/story.png", "caption", "meta-123");

    expect(mockClipboard).toHaveBeenCalledWith("caption");
    expect(mockDownload).toHaveBeenCalled();
    expect(mockShareSingle).toHaveBeenCalledWith(
      expect.objectContaining({
        social: "instagramstories",
        appId: "meta-123",
        backgroundImage: "file:///cache/poster.png",
      }),
    );
  });

  it("requires a Meta App ID before opening Stories", async () => {
    await expect(
      shareToInstagramStory("https://example.test/story.png", "caption", undefined),
    ).rejects.toBeInstanceOf(InstagramShareConfigurationError);
    expect(mockShareSingle).not.toHaveBeenCalled();
  });

  it("downloads and opens the Instagram Feed composer", async () => {
    await shareToInstagramFeed("https://example.test/feed.png", "caption");
    expect(mockShareSingle).toHaveBeenCalledWith(
      expect.objectContaining({
        social: "instagram",
        url: "file:///cache/poster.png",
        type: "image/png",
      }),
    );
  });
});
