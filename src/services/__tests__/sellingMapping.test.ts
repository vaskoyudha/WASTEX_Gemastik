jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}));

import { BackendSellingKit } from "../types";

describe("sellingKitFromBackend", () => {
  const { sellingKitFromBackend } = require("../index");

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
  });
});
