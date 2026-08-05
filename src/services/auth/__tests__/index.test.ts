jest.mock("@react-native-async-storage/async-storage", () => require("@react-native-async-storage/async-storage/jest/async-storage-mock"));

jest.mock("../../api", () => ({
  apiClient: {
    register: jest.fn(),
    login: jest.fn(),
    updateProfile: jest.fn(),
  },
}));

jest.mock("../../supabase/client", () => ({
  supabase: {
    auth: {
      signUp: jest.fn(),
      signInWithPassword: jest.fn(),
      signOut: jest.fn(),
      admin: { deleteUser: jest.fn() },
    },
  },
}));

import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAuthService } from "..";
import { apiClient } from "../../api";
import { supabase } from "../../supabase/client";

describe("AuthService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(AsyncStorage, "getItem").mockResolvedValue(null);
    jest.spyOn(AsyncStorage, "setItem").mockResolvedValue(true);
  });

  it("signs up and stores user", async () => {
    const mockSignUp = supabase.auth.signUp as jest.Mock;
    mockSignUp.mockReturnValue(
      Promise.resolve({
        data: { user: { id: "user-123", email: "test@example.com" }, session: { access_token: "abc123" } },
        error: null,
      })
    );

    (apiClient.register as jest.Mock).mockResolvedValue({
      access_token: "abc123",
      user_id: "user-123",
      profile: {
        id: "prof-123",
        auth_user_id: "user-123",
        display_name: "Test User",
        first_name: null,
        last_name: null,
        bio: null,
        phone: null,
        avatar_url: null,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: null,
      },
    });

    const authService = createAuthService(apiClient);
    const result = await authService.signUp("test@example.com", "password123", "Test User");

    expect(result.userId).toBe("user-123");
    expect(result.profile.displayName).toBe("Test User");
    expect(authService.isLoggedIn()).toBe(true);
    
    // Verify AsyncStorage was called
    expect(AsyncStorage.setItem).toHaveBeenCalled();
  });

  it("signs in successfully", async () => {
    const mockSignIn = supabase.auth.signInWithPassword as jest.Mock;
    mockSignIn.mockReturnValue(
      Promise.resolve({
        data: { user: { id: "user-123" }, session: { access_token: "xyz789" } },
        error: null,
      })
    );

    (apiClient.login as jest.Mock).mockResolvedValue({
      access_token: "xyz789",
      user_id: "user-123",
      profile: {
        id: "prof-123",
        auth_user_id: "user-123",
        display_name: "Test User",
        first_name: null,
        last_name: null,
        bio: null,
        phone: null,
        avatar_url: null,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: null,
      },
    });

    const authService = createAuthService(apiClient);
    const result = await authService.signIn("test@example.com", "password123");

    expect(result.userId).toBe("user-123");
    expect(authService.isLoggedIn()).toBe(true);
    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: "test@example.com",
      password: "password123",
    });
  });

  it("falls back to backend login when supabase is unreachable", async () => {
    (supabase.auth.signInWithPassword as jest.Mock).mockRejectedValue(
      new Error("network error")
    );

    (apiClient.login as jest.Mock).mockResolvedValue({
      access_token: "es256-token",
      user_id: "user-456",
      profile: {
        id: "prof-456",
        auth_user_id: "user-456",
        display_name: "Fallback User",
        first_name: null,
        last_name: null,
        bio: null,
        phone: null,
        avatar_url: null,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: null,
      },
    });

    const authService = createAuthService(apiClient);
    const result = await authService.signIn("test@example.com", "password123");

    expect(result.userId).toBe("user-456");
    expect(result.accessToken).toBe("es256-token");
    expect(result.profile.displayName).toBe("Fallback User");
    expect(authService.isLoggedIn()).toBe(true);
    expect(apiClient.login).toHaveBeenCalledWith({
      email: "test@example.com",
      password: "password123",
    });
  });

  it("signs out and clears storage", async () => {
    (supabase.auth.signUp as jest.Mock).mockReturnValue(
      Promise.resolve({ data: { user: { id: "user-123" } }, error: null })
    );

    (apiClient.register as jest.Mock).mockResolvedValue({
      access_token: "abc123",
      user_id: "user-123",
      profile: {
        id: "prof-123",
        auth_user_id: "user-123",
        display_name: "Test User",
        first_name: null,
        last_name: null,
        bio: null,
        phone: null,
        avatar_url: null,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: null,
      },
    });

    const authService = createAuthService(apiClient);
    await authService.signUp("test@example.com", "password123", "Test User");
    expect(authService.isLoggedIn()).toBe(true);
    
    (supabase.auth.signOut as jest.Mock).mockReturnValue(Promise.resolve());
    await authService.signOut();
    expect(authService.isLoggedIn()).toBe(false);
    expect(supabase.auth.signOut).toHaveBeenCalledWith();
  });

  it("getAccessToken returns token when logged in", async () => {
    const mockSignUp = supabase.auth.signUp as jest.Mock;
    mockSignUp.mockReturnValue(
      Promise.resolve({ data: { user: { id: "user-123" }, session: { access_token: "token123" } }, error: null })
    );
    (apiClient.register as jest.Mock).mockResolvedValue({
      access_token: "token123",
      user_id: "user-123",
      profile: { id: "prof-123", auth_user_id: "user-123", display_name: "Test", first_name: null, last_name: null, bio: null, phone: null, avatar_url: null, created_at: "2026-01-01T00:00:00Z", updated_at: null },
    });

    const authService = createAuthService(apiClient);
    await authService.signUp("test@example.com", "pass", "Test");
    expect(authService.getAccessToken()).toBe("token123");
  });

  it("isLoggedIn returns false when not logged in", () => {
    const authService = createAuthService(apiClient);
    expect(authService.isLoggedIn()).toBe(false);
  });

  it("getUser returns null when not logged in", () => {
    const authService = createAuthService(apiClient);
    expect(authService.getUser()).toBe(null);
  });
});