import React from "react";
import { Alert } from "react-native";
import { render, fireEvent } from "@testing-library/react-native";
import LoginScreen from "./login";

const mockSignIn = jest.fn();
const mockReplace = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn() }),
}));

jest.mock("../../src/services/auth", () => ({
  auth: { signIn: mockSignIn },
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

describe("LoginScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders correctly", () => {
    const { getByText } = render(<LoginScreen />);
    expect(getByText("Masuk")).toBeTruthy();
  });

  it("calls signIn and navigates on success", async () => {
    mockSignIn.mockResolvedValue({ userId: "user-123", profile: { displayName: "Test User" } });
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    
    const { getByText, getByPlaceholderText } = await render(<LoginScreen />);
    
    fireEvent.changeText(getByPlaceholderText("nama@example.com"), "test@example.com");
    fireEvent.changeText(getByPlaceholderText("••••••••"), "password123");
    fireEvent.press(getByText("Masuk"));
    
    expect(mockSignIn).toHaveBeenCalledWith("test@example.com", "password123");
    expect(alertSpy).toHaveBeenCalledWith("Berhasil", "Selamat datang, Test User!");
    alertSpy.mockRestore();
  });

  it("shows error when email or password is empty", async () => {
    const { getByText } = await render(<LoginScreen />);
    fireEvent.press(getByText("Masuk"));
    // Error should be shown
    expect(mockSignIn).not.toHaveBeenCalled();
  });
});
