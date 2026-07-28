import React from "react";
import { Alert } from "react-native";
import { render, fireEvent } from "@testing-library/react-native";
import RegisterScreen from "./register";

const mockSignUp = jest.fn();
const mockReplace = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn() }),
}));

jest.mock("../../src/services/auth", () => ({
  auth: { signUp: mockSignUp },
}));

jest.mock("../../src/components/ui", () => ({
  Header: ({ title, subtitle }: { title: string; subtitle?: string }) => (
    <>{title}{subtitle && <>{subtitle}</>}</>
  ),
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Button: ({ title, onPress, loading }: { title: string; onPress: () => void; loading?: boolean }) => (
    <button disabled={loading} onPress={onPress}>{title}</button>
  ),
}));

jest.mock("../../src/components/ui/Input", ({ label, ...props }: any) => (
  <input 
    data-testid={`input-${label}`} 
    placeholder={props.placeholder || ""} 
    value={props.value || ""} 
    onChangeText={props.onChangeText}
  />
));

describe("RegisterScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders correctly with all fields", () => {
    const { getByText } = render(<RegisterScreen />);
    expect(getByText("Daftar")).toBeTruthy();
  });

  it("calls signUp and navigates on success", async () => {
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    
    const { getByPlaceholderText, getByText } = await render(<RegisterScreen />);
    
    fireEvent.changeText(getByPlaceholderText("nama@example.com"), "test@example.com");
    fireEvent.changeText(getByPlaceholderText("Nama Anda"), "Test User");
    fireEvent.changeText(getByPlaceholderText("Opsional"), "First");
    fireEvent.changeText(getByPlaceholderText("Opsional"), "Last");
    fireEvent.changeText(getByPlaceholderText("Ceritakan tentang Anda (opsional)"), "Bio here");
    fireEvent.changeText(getByPlaceholderText("+62..."), "+62812345678");
    fireEvent.changeText(getByPlaceholderText("Minimal 8 karakter"), "password123");
    fireEvent.press(getByText("Daftar"));
    
    expect(mockSignUp).toHaveBeenCalledWith(
      "test@example.com",
      "password123",
      "Test User",
      {
        firstName: "First",
        lastName: "Last",
        bio: "Bio here",
        phone: "+62812345678",
      }
    );
    expect(alertSpy).toHaveBeenCalledWith("Berhasil", "Akun berhasil dibuat!");
    alertSpy.mockRestore();
  });

  it("shows validation error when required fields are missing", async () => {
    const { getByText } = await render(<RegisterScreen />);
    fireEvent.press(getByText("Daftar"));
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it("shows error when password is less than 8 characters", async () => {
    const { getByPlaceholderText, getByText } = await render(<RegisterScreen />);
    
    fireEvent.changeText(getByPlaceholderText("nama@example.com"), "test@example.com");
    fireEvent.changeText(getByPlaceholderText("Nama Anda"), "Test User");
    fireEvent.changeText(getByPlaceholderText("Minimal 8 karakter"), "short");
    fireEvent.press(getByText("Daftar"));
    
    expect(mockSignUp).not.toHaveBeenCalled();
  });
});
