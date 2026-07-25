import { act, renderHook, waitFor } from "@testing-library/react-native";
import { useServiceCall } from "./useServiceCall";

describe("useServiceCall", () => {
  it("stores data and calls onSuccess when the service resolves", async () => {
    const service = jest.fn().mockResolvedValue("ok");
    const onSuccess = jest.fn();

    const { result } = await renderHook(() =>
      useServiceCall<string, [string]>(service, { onSuccess })
    );

    await act(async () => {
      const value = await result.current.execute("photo-uri");
      expect(value).toBe("ok");
    });

    expect(service).toHaveBeenCalledWith("photo-uri");
    expect(result.current.data).toBe("ok");
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(onSuccess).toHaveBeenCalledWith("ok");
  });

  it("stores error and calls onError when the service rejects", async () => {
    const error = new Error("boom");
    const service = jest.fn().mockRejectedValue(error);
    const onError = jest.fn();

    const { result } = await renderHook(() =>
      useServiceCall<string, [string]>(service, { onError })
    );

    await act(async () => {
      const value = await result.current.execute("bad-input");
      expect(value).toBeNull();
    });

    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe(error);
    expect(onError).toHaveBeenCalledWith(error);
  });

  it("refetches with the latest execute arguments", async () => {
    const service = jest.fn().mockResolvedValueOnce("first").mockResolvedValueOnce("second");

    const { result } = await renderHook(() => useServiceCall<string, [string]>(service));

    await act(async () => {
      await result.current.execute("latest");
    });

    await act(async () => {
      await result.current.refetch();
    });

    await waitFor(() => expect(result.current.data).toBe("second"));
    expect(service).toHaveBeenLastCalledWith("latest");
  });
});

