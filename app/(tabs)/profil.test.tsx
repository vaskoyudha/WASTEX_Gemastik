import React from "react";
import { Alert, Pressable as MockPressable, Text as MockText } from "react-native";
import { fireEvent, render } from "@testing-library/react-native";
import ProfilScreen from "./profil";

const mockClearAll = jest.fn();
const mockReplace = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn() }),
}));

jest.mock("../../src/services", () => ({
  impact: { clearAll: mockClearAll },
}));

jest.mock("../../src/components/ui", () => ({
  Button: ({ title, onPress }: { title: string; onPress: () => void }) => (
    <MockPressable onPress={onPress}><MockText>{title}</MockText></MockPressable>
  ),
  Card: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Header: ({ title }: { title: string }) => <MockText>{title}</MockText>,
}));

jest.mock("lucide-react-native", () => ({
  Award: () => null,
  Info: () => null,
  Shield: () => null,
  Trash2: () => null,
  User: () => null,
}));

describe("ProfilScreen clear-data action", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("asks for confirmation before clearing data", async () => {
    const alertSpy = jest.spyOn(Alert, "alert");
    const { getByText } = await render(<ProfilScreen />);

    fireEvent.press(getByText("Hapus Data Proyek & Reset"));

    expect(alertSpy).toHaveBeenCalledWith(
      "Hapus Semua Data",
      expect.any(String),
      expect.arrayContaining([
        expect.objectContaining({ text: "Batal" }),
        expect.objectContaining({ text: "Hapus Semua" }),
      ]),
    );
    expect(mockClearAll).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

});
