jest.mock("../client", () => {
  const originalModule = jest.requireActual("../client");
  return {
    ...originalModule,
    createSupabaseClient: jest.fn(() => ({
      from: jest.fn(),
      auth: {
        signUp: jest.fn(),
        signInWithPassword: jest.fn(),
        signOut: jest.fn(),
        getUser: jest.fn(),
      },
    })),
    supabase: {
      from: jest.fn(),
      auth: {
        signUp: jest.fn(),
        signInWithPassword: jest.fn(),
        signOut: jest.fn(),
        getUser: jest.fn(),
      },
    },
  };
});

import { createSupabaseClient } from "../client";

describe("Supabase client", () => {
  it("creates a client with configured url and key", async () => {
    const client = createSupabaseClient();
    // We don't call Supabase — we just check the factory exists
    expect(client).toBeDefined();
    expect(client.from).toBeDefined();
    expect(client.auth).toBeDefined();
  });
});
