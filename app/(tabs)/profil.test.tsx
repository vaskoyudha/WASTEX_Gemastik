import React from "react";
import { Alert, Pressable as MockPressable, Text as MockText } from "react-native";
import { fireEvent, render } from "@testing-library/react-native";
import ProfilScreen from "./profil";

const mockClearAll = jest.fn();
const mockReplace = jest.fn();
const mockGetSkills = jest.fn();

const mockUser = {
  id: "u1",
  email: "user@test.com",
  accessToken: "token",
  profile: {
    id: "p1",
    authUserId: "u1",
    displayName: "Test User",
    firstName: "Test",
    lastName: "User",
    createdAt: "2026-01-01",
  },
};

jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn() }),
}));

jest.mock("../../src/services/auth", () => ({
  auth: {
    getUser: () => mockUser,
    updateProfile: jest.fn(),
    signOut: jest.fn(),
    deleteAccount: jest.fn(),
  },
}));

jest.mock("../../src/services", () => ({
  impact: { clearAll: mockClearAll },
}));

jest.mock("../../src/services/api", () => ({
  apiClient: { getSkills: (...args: unknown[]) => mockGetSkills(...args) },
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
  Edit: () => null,
  Info: () => null,
  LogOut: () => null,
  Save: () => null,
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

describe("ProfilScreen skill submissions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSkills.mockResolvedValue([
      { id: "k1", title: "Tas dari Plastik", status: "pending" },
      { id: "k2", title: "Vas Kaca", status: "approved" },
    ]);
  });

  it("renders user skill submissions with status", async () => {
    const { getByText } = await render(<ProfilScreen />);
    expect(await getByText("Skill Saya")).toBeTruthy();
    expect(getByText("Tas dari Plastik")).toBeTruthy();
    expect(getByText("Menunggu")).toBeTruthy();
    expect(getByText("Disetujui")).toBeTruthy();
    expect(mockGetSkills).toHaveBeenCalledWith({ mine: true });
  });
});
