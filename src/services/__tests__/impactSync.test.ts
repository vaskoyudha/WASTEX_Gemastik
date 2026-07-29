import { impactEventFromProject } from "../impact/mapper";
import { SavedProject } from "../types";

const PROJECT: SavedProject = {
  id: "p1",
  savedAt: "2026-07-29T00:00:00Z",
  material: {
    materialType: "kaca",
    materialLabel: "Kaca",
    condition: "utuh",
    confidence: 0.9,
    riskLevel: "hati_hati",
    safetyNotes: [],
    potentialUses: [],
  },
  product: {
    id: "prod1",
    name: "Vas Kaca",
    thumbnailUri: "",
    difficulty: "sedang",
    estimatedCost: 12000,
    estimatedTimeMinutes: 45,
    shortDescription: "",
  },
  photoUri: "",
};

describe("impactEventFromProject", () => {
  it("maps a saved project to a backend impact event", () => {
    const event = impactEventFromProject(PROJECT);
    expect(event.material).toBe("kaca");
    expect(event.waste_kg).toBe(2);
    expect(event.est_value_idr).toBe(12000);
  });
});
