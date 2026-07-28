// Mock @supabase/supabase-js before any imports
jest.mock("@supabase/supabase-js", () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(),
    auth: {
      signUp: jest.fn(),
      signInWithPassword: jest.fn(),
      signOut: jest.fn(),
      getUser: jest.fn(),
      signInWithIdP: jest.fn(),
    },
    channel: jest.fn(),
    removeChannel: jest.fn(),
    removeChannels: jest.fn(),
    rpc: jest.fn(),
    rest: {},
  })),
}));
