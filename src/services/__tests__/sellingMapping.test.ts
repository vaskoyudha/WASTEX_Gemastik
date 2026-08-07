jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}));

import { BackendCompletionSellingKit, BackendSellingKit } from "../types";

describe("sellingKitFromBackend", () => {
  const { completionSellingKitFromBackend, sellingKitFromBackend } = require("../index");

  it("maps backend snake_case kit to frontend SellingKit", () => {
    const backend: BackendSellingKit = {
      skill_id: "s1",
      product_name: "Vas Botol Estetik",
      description: "Vas cantik dari botol PET bekas.",
      captions: ["Dari sampah jadi cuan!"],
      photo_tips: ["Cahaya alami"],
      packaging_ideas: ["Koran bekas"],
      hashtags: ["#wastex"],
    };
    const kit = sellingKitFromBackend(backend);
    expect(kit.productId).toBe("s1");
    expect(kit.productName).toBe("Vas Botol Estetik");
    expect(kit.captions).toEqual(["Dari sampah jadi cuan!"]);
    expect(kit.photoTips).toEqual(["Cahaya alami"]);
    expect(kit.packagingIdeas).toEqual(["Koran bekas"]);
    expect(kit.hashtags).toEqual(["#wastex"]);
  });

  it("maps personalized completion promo fields", () => {
    const backend: BackendCompletionSellingKit = {
      skill_id: "s1",
      completion_id: "c1",
      product_name: "Vas Botol Estetik",
      description: "Vas cantik dari botol PET bekas.",
      captions: ["Siap dibagikan"],
      photo_tips: [],
      packaging_ideas: [],
      hashtags: ["#wastex"],
      promo_image_url: "https://example.test/promo.png",
    };

    const kit = completionSellingKitFromBackend(backend);
    expect(kit.completionId).toBe("c1");
    expect(kit.promoImageUri).toBe("https://example.test/promo.png");
  });
});
