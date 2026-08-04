// With EXPO_PUBLIC_USE_MOCK=false the real ApiScanner code path runs.
// Static ES imports are hoisted past this statement, so the scanner used in the
// test is captured via jest.isolateModules + require below (which runs after
// module evaluation, when this env var is already set).
process.env.EXPO_PUBLIC_USE_MOCK = "false";

import type { WasteScannerService } from "../types";

const mockScan = jest.fn();
jest.mock("../api", () => ({
  apiClient: {
    scan: (...args: unknown[]) => mockScan(...args),
  },
}));
jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
}));

jest.isolateModules(() => {
  process.env.EXPO_PUBLIC_USE_MOCK = "false";
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { scanner } = require("../index");
  (globalThis as Record<string, unknown>).__testScanner = scanner;
});

describe("ApiScanner", () => {
  beforeEach(() => {
    mockScan.mockReset();
    mockScan.mockResolvedValue({
      scan_id: "11111111-2222-3333-4444-555555555555",
      status: "identified",
      identification: { material: "plastik_pet", condition: "bening", confidence: 0.9 },
    });
  });

  afterAll(() => {
    delete process.env.EXPO_PUBLIC_USE_MOCK;
    delete (globalThis as Record<string, unknown>).__testScanner;
  });

  it("propagates scan_id from the backend response", async () => {
    const scanner = (globalThis as Record<string, unknown>)
      .__testScanner as unknown as WasteScannerService;
    const result = await scanner.scan("file:///tmp/x.jpg");
    expect(result.scan_id).toBe("11111111-2222-3333-4444-555555555555");
    // controls the mock: with USE_MOCK=false the real ApiScanner code path runs
    expect(mockScan).toHaveBeenCalledWith("file:///tmp/x.jpg");
  });
});
