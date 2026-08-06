import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../supabase/client";
import { AuthResult, User, UserProfile, UpdateProfileRequest, AuthService } from "../types";

const USER_STORAGE_KEY = "wastex.user.v1";

export class LocalAuthService implements AuthService {
  private user: User | null = null;
  private readonly apiClient: any;

  constructor(apiClientOverride?: any) {
    this.apiClient = apiClientOverride;
    void this.loadUserFromStorage();
  }

  private async loadUserFromStorage(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(USER_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.user = parsed as User;
      }
    } catch {
      this.user = null;
    }
    // Sesi yang dipulihkan dari storage bisa jadi tokennya sudah kedaluwarsa
    // (Supabase access token ~1 jam). Refresh di latar belakang agar status
    // "sudah login" tetap benar dan request auth tidak gagal 401.
    if (this.user?.accessToken) {
      void this.getValidAccessToken();
    }
  }

  private saveUserToStorage(user: User): void {
    try {
      AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    } catch {}
  }

  private clearUserStorage(): void {
    try {
      AsyncStorage.removeItem(USER_STORAGE_KEY);
    } catch {}
  }

  async signUp(
    email: string,
    password: string,
    displayName: string,
    data?: UpdateProfileRequest
  ): Promise<AuthResult> {
    // The backend /auth/register owns Supabase user creation. Calling
    // supabase.auth.signUp here as well caused a double sign-up: the second
    // call failed with "User already registered". Delegating to the backend
    // keeps registration idempotent (safe to retry) and lets the backend
    // recover accounts whose profile was never created.
    const client = this.apiClient || await import("../api").then((m) => m.apiClient);
    const profileResponse = await client.register({
      email,
      password,
      display_name: displayName,
      first_name: data?.firstName ?? null,
      last_name: data?.lastName ?? null,
      bio: data?.bio ?? null,
      phone: data?.phone ?? null,
    } as any);

    const userProfile: UserProfile = {
      id: profileResponse.profile.id,
      authUserId: profileResponse.user_id,
      displayName: profileResponse.profile.display_name,
      firstName: profileResponse.profile.first_name,
      lastName: profileResponse.profile.last_name,
      bio: profileResponse.profile.bio,
      phone: profileResponse.profile.phone,
      avatarUrl: profileResponse.profile.avatar_url,
      createdAt: profileResponse.profile.created_at,
      updatedAt: profileResponse.profile.updated_at,
    };

    const user: User = {
      id: profileResponse.user_id,
      email,
      accessToken: profileResponse.access_token ?? null,
      profile: userProfile,
    };
    this.user = user;
    this.saveUserToStorage(user);

    return {
      accessToken: user.accessToken!,
      userId: user.id,
      profile: userProfile,
    };
  }

  async signIn(email: string, password: string): Promise<AuthResult> {
    const client = this.apiClient || await import("../api").then((m) => m.apiClient);

    try {
      const response = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (response.data.user) {
        const profileResponse = await client.login({ email, password } as any);
        return this.persistSession(
          email,
          response.data.user.id,
          response.data.session?.access_token ?? profileResponse.access_token ?? null,
          response.data.session?.expires_at ?? null,
          profileResponse
        );
      }
    } catch {
      // Supabase unreachable (e.g. web dev without local Supabase) — fall back to backend login.
    }

    const profileResponse = await client.login({ email, password } as any);
    return this.persistSession(
      email,
      profileResponse.user_id,
      profileResponse.access_token ?? null,
      profileResponse.expires_at ?? null,
      profileResponse
    );
  }

  private persistSession(
    email: string,
    userId: string,
    accessToken: string | null,
    expiresAt: number | null,
    profileResponse: any
  ): AuthResult {
    const userProfile: UserProfile = {
      id: profileResponse.profile.id,
      authUserId: userId,
      displayName: profileResponse.profile.display_name,
      firstName: profileResponse.profile.first_name,
      lastName: profileResponse.profile.last_name,
      bio: profileResponse.profile.bio,
      phone: profileResponse.profile.phone,
      avatarUrl: profileResponse.profile.avatar_url,
      createdAt: profileResponse.profile.created_at,
      updatedAt: profileResponse.profile.updated_at,
    };

    const user: User = {
      id: userId,
      email,
      accessToken,
      expiresAt: expiresAt ?? null,
      profile: userProfile,
    };
    this.user = user;
    this.saveUserToStorage(user);

    return {
      accessToken: user.accessToken!,
      userId: user.id,
      profile: userProfile,
    };
  }

  async signOut(): Promise<void> {
    await supabase.auth.signOut();
    this.user = null;
    this.clearUserStorage();
  }

  getUser(): User | null {
    return this.user;
  }

  isLoggedIn(): boolean {
    return this.user !== null;
  }

  getAccessToken(): string | null {
    return this.user?.accessToken ?? null;
  }

  async getValidAccessToken(): Promise<string | null> {
    if (!this.user?.accessToken) return null;
    const nowSec = Math.floor(Date.now() / 1000);
    const expiresAt = this.user.expiresAt ?? null;
    // Tanpa informasi kedaluwarsa: jangan tebak, pakai token apa adanya.
    if (expiresAt === null || nowSec < expiresAt) return this.user.accessToken;

    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (error || !data.session?.access_token) {
        // Refresh gagal — sesi benar-benar mati, bersihkan state lokal.
        this.user = null;
        this.clearUserStorage();
        return null;
      }
      this.user = {
        ...this.user,
        accessToken: data.session.access_token,
        expiresAt: data.session.expires_at ?? null,
      };
      this.saveUserToStorage(this.user);
      return data.session.access_token;
    } catch {
      // Supabase tidak terjangkau — jangan logout paksa, biarkan request
      // backend mencoba dengan token lama (fallback backend login).
      return this.user?.accessToken ?? null;
    }
  }

  async updateProfile(data: UpdateProfileRequest): Promise<UserProfile> {
    if (!this.user) {
      throw new Error("Not logged in");
    }

    const client = this.apiClient || await import("../api").then((m) => m.apiClient);
    const response = await client.updateProfile(this.user.id, data) as any;

    const userProfile: UserProfile = {
      id: response.id,
      authUserId: this.user.id,
      displayName: response.display_name,
      firstName: response.first_name,
      lastName: response.last_name,
      bio: response.bio,
      phone: response.phone,
      avatarUrl: response.avatar_url,
      createdAt: response.created_at,
      updatedAt: response.updated_at,
    };

    this.user.profile = userProfile;
    this.saveUserToStorage(this.user);

    return userProfile;
  }

  async deleteAccount(): Promise<void> {
    if (!this.user) {
      throw new Error("Not logged in");
    }

    // Delete Supabase user
    await supabase.auth.admin.deleteUser(this.user.id);
    await this.signOut();
  }
}

// Factory and singleton (for production usage without mocking)
export function createAuthService(apiClientOverride?: any): AuthService {
  return new LocalAuthService(apiClientOverride);
}

export const auth = createAuthService();
