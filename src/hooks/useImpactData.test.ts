import { act, renderHook, waitFor } from "@testing-library/react-native";
import { useImpactData } from "./useImpactData";

const mockGetHistory = jest.fn();
const mockGetImpactSummary = jest.fn();
const mockDeleteProject = jest.fn();

jest.mock("expo-router", () => {
  const { useEffect } = jest.requireActual<typeof import("react")>("react");

  return {
    useFocusEffect: (callback: () => void) => {
      useEffect(() => callback(), [callback]);
    },
  };
});

jest.mock("../services", () => ({
  impact: {
    getHistory: () => mockGetHistory(),
    getImpactSummary: () => mockGetImpactSummary(),
    deleteProject: (id: string) => mockDeleteProject(id),
    clearAll: jest.fn(),
  },
}));

const historyItem = { id: "p1", product: { id: "prod_pet_1" } };
const summary = {
  totalWasteProcessed: 2,
  totalProductsMade: 1,
  estimatedEconomicValue: 12000,
};

describe("useImpactData", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetHistory.mockResolvedValue([historyItem]);
    mockGetImpactSummary.mockResolvedValue(summary);
    mockDeleteProject.mockResolvedValue(undefined);
  });

  it("loads history and summary on focus", async () => {
    const { result } = await renderHook(() => useImpactData());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.history).toEqual([historyItem]);
    expect(result.current.summary).toEqual(summary);
    expect(result.current.error).toBeNull();
  });

  it("refresh repopulates data after the service recovers", async () => {
    mockGetHistory.mockRejectedValueOnce(new Error("storage down"));

    const { result } = await renderHook(() => useImpactData());

    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.history).toEqual([]);

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.error).toBeNull();
    expect(result.current.history).toEqual([historyItem]);
  });

  it("deleteProject delegates to the service and reloads", async () => {
    const { result } = await renderHook(() => useImpactData());

    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.deleteProject("p1");
    });

    expect(mockDeleteProject).toHaveBeenCalledWith("p1");
    expect(mockGetHistory).toHaveBeenCalledTimes(2);
  });
});
