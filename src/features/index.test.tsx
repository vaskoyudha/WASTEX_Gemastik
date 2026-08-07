import { render } from "@testing-library/react-native";
import { RiskBadge, ProductCard, TutorialStepCard, SafetyModal } from "./index";

jest.mock("lucide-react-native", () => ({
  AlertTriangle: () => null,
  ArrowUpRight: () => null,
  Clock: () => null,
  Leaf: () => null,
  ShieldCheck: () => null,
}));

jest.setTimeout(15000);

describe("Falih feature components", () => {
  it("renders the mapped risk label", async () => {
    const { getByText } = await render(<RiskBadge level="berisiko" />);

    expect(getByText("Berisiko")).toBeTruthy();
  });

  it("renders product details with formatted cost and difficulty", async () => {
    const { getByText } = await render(
      <ProductCard
        product={{
          id: "pet-pot",
          name: "Pot Botol PET",
          thumbnailUri: "https://example.com/pot.png",
          difficulty: "mudah",
          estimatedCost: 15000,
          estimatedTimeMinutes: 30,
          shortDescription: "Pot tanaman dari botol bekas.",
        }}
      />,
    );

    expect(getByText("Pot Botol PET")).toBeTruthy();
    expect(getByText("Rp 15.000")).toBeTruthy();
    expect(getByText("Mudah")).toBeTruthy();
    expect(getByText("30 menit")).toBeTruthy();
  });

  it("renders tutorial safety warning when provided", async () => {
    const { getByText } = await render(
      <TutorialStepCard
        step={{
          order: 1,
          title: "Bersihkan botol",
          description: "Cuci botol sebelum dipotong.",
          imageUri: "https://example.com/step.png",
          safetyWarning: "Gunakan sarung tangan.",
        }}
      />,
    );

    expect(getByText("1")).toBeTruthy();
    expect(getByText("Gunakan sarung tangan.")).toBeTruthy();
  });

  it("renders safety modal content and actions", async () => {
    const { getByText } = await render(
      <SafetyModal
        visible
        title="Perhatikan keselamatan"
        safetyNotes={["Jauhkan dari api."]}
        protectiveEquipment="Gunakan sarung tangan."
        onContinue={() => undefined}
        onBack={() => undefined}
      />,
    );

    expect(getByText("Perhatikan keselamatan")).toBeTruthy();
    expect(getByText(/Jauhkan dari api\./)).toBeTruthy();
    expect(getByText("Lanjutkan")).toBeTruthy();
    expect(getByText("Kembali")).toBeTruthy();
  });
});
